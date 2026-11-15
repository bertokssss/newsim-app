import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, dispatchNotificationEvent, NOTIFICATION_EVENTS } from '@newsim/database';
import { createForbiddenResponse } from '@newsim/auth';
import {
  formatPayment,
  isAdminContext,
  PAYMENT_SELECT,
  requestMeta,
  requireAdmin,
  toDbEnrollmentStatus,
  toDbPaymentStatus,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'PAYMENT_VERIFY', requireFinancial: true });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, remarks, action } = body;
    const { ip, userAgent } = requestMeta(request);

    const { data: existing } = await supabaseAdmin.from('payments').select('*').eq('id', id).maybeSingle();
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    const isApproval = status === 'VERIFIED' || status === 'PAID' || action === 'APPROVE';
    if (isApproval) {
      const perms = ctx.user.permissions || [];
      if (!perms.includes('ALL') && !perms.includes('PAYMENT_VERIFY')) {
        return createForbiddenResponse('Permission denied: PAYMENT_VERIFY permission required to approve or verify payments.');
      }
    }
    const isRejection = status === 'REJECTED' || status === 'FAILED' || action === 'REJECT';
    const now = new Date().toISOString();

    const dbStatus = isApproval ? 'PAID' : (isRejection ? 'FAILED' : toDbPaymentStatus(status));
    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({
        status: dbStatus,
        verified_by: ctx.user.id,
        verified_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select(PAYMENT_SELECT)
      .single();

    if (error) throw error;

    // Locate the associated enrollment
    let targetEnrollmentId = existing.enrollment_id;
    if (!targetEnrollmentId && existing.trainee_id) {
      const { data: enrRow } = await supabaseAdmin
        .from('enrollments')
        .select('id')
        .eq('trainee_id', existing.trainee_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (enrRow) {
        targetEnrollmentId = enrRow.id;
        await supabaseAdmin.from('payments').update({ enrollment_id: targetEnrollmentId }).eq('id', id);
      }
    }

    if (isApproval && targetEnrollmentId) {
      // Rule: Approving on the payment side marks enrollment as ENROLLED
      const enrUpdates: Record<string, any> = {
        status: 'ENROLLED',
        enrolled_at: now,
        reviewed_by: ctx.user.id,
        reviewed_at: now,
        updated_at: now,
      };
      if (remarks) {
        enrUpdates.review_notes = remarks;
      }

      await supabaseAdmin
        .from('enrollments')
        .update(enrUpdates)
        .eq('id', targetEnrollmentId);

      // Activate trainee profile
      if (existing.trainee_id) {
        await supabaseAdmin
          .from('trainees')
          .update({
            enrollment_status: 'ACTIVE',
            updated_at: now,
          })
          .eq('profile_id', existing.trainee_id);
      }

      // Role-Aware Notifications per Section 11
      try {
        let enrCourseId: string | undefined;
        let enrBatchId: string | undefined;
        if (targetEnrollmentId) {
          const { data: enrMeta } = await supabaseAdmin
            .from('enrollments')
            .select('course_id, batch_id')
            .eq('id', targetEnrollmentId)
            .maybeSingle();
          enrCourseId = enrMeta?.course_id || undefined;
          enrBatchId = enrMeta?.batch_id || undefined;
        }

        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.PAYMENT_CONFIRMED,
          traineeId: existing.trainee_id,
          courseId: enrCourseId,
          batchId: enrBatchId,
          entityType: 'PAYMENT',
          entityId: id,
          metadata: {
            paymentNumber: existing.reference_number || `PAY-${id.slice(0, 8).toUpperCase()}`,
            amount: existing.amount,
          },
        });
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.ENROLLMENT_ACTIVATED,
          traineeId: existing.trainee_id,
          courseId: enrCourseId,
          batchId: enrBatchId,
          entityType: 'ENROLLMENT',
          entityId: targetEnrollmentId,
        });
      } catch (notifyErr) {
        console.warn('Notification dispatch notice:', notifyErr);
      }
    } else if (isRejection && targetEnrollmentId) {
      try {
        await supabaseAdmin.rpc('cancel_batch_enrollment', {
          p_enrollment_id: targetEnrollmentId,
          p_new_status: 'REJECTED',
        });
      } catch {}

      await supabaseAdmin
        .from('enrollments')
        .update({
          status: 'REJECTED',
          review_notes: remarks ? `[REFUNDABLE] ${remarks}` : '[REFUNDABLE] Tuition payment rejected. Settled amount is eligible for refund.',
          reviewed_by: ctx.user.id,
          reviewed_at: now,
          updated_at: now,
        })
        .eq('id', targetEnrollmentId);

      // Explicitly mark payment as REFUNDED in DB to confirm refundable status
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'REFUNDED',
          updated_at: now,
        })
        .eq('id', id);
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: isApproval ? 'PAYMENT_APPROVED_AND_ENROLLED' : 'PAYMENT_REJECTED',
      entityType: 'PAYMENT',
      entityId: id,
      details: { amount: existing.amount, status: dbStatus, remarks, enrollmentId: targetEnrollmentId },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, data: formatPayment(data) });
  } catch (error) {
    console.error('Failed to update payment:', error);
    return NextResponse.json({ success: false, error: 'Failed to update payment' }, { status: 500 });
  }
}
