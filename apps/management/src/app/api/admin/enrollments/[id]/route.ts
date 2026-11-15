import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, dispatchNotificationEvent, NOTIFICATION_EVENTS } from '@newsim/database';
import {
  ENROLLMENT_SELECT,
  formatEnrollment,
  isAdminContext,
  requestMeta,
  requireAdmin,
  toDbEnrollmentStatus,
  toDbPaymentStatus,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'ENROLLMENT_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .select(ENROLLMENT_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
    }
    if (ctx.centerId && data.training_center_id && data.training_center_id !== ctx.centerId) {
      return NextResponse.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: formatEnrollment(data, { includeFinancial: ctx.hasFinancialAccess }) });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'ENROLLMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, paymentStatus, reviewNotes, action } = body;
    const { ip, userAgent } = requestMeta(request);

    // Fetch existing enrollment to verify center and get trainee info
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('enrollments')
      .select('*, courses(name, code), batches(batch_code)')
      .eq('id', id)
      .maybeSingle();

    if (existErr || !existing) {
      return NextResponse.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
    }

    if (ctx.centerId && existing.training_center_id && existing.training_center_id !== ctx.centerId) {
      return NextResponse.json({ success: false, error: 'Enrollment not found in your assigned training center' }, { status: 403 });
    }

    const now = new Date().toISOString();
    let targetStatus = status ? toDbEnrollmentStatus(status) : null;

    if (paymentStatus && !ctx.hasFinancialAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Financial permission required to modify payment status' },
        { status: 403 }
      );
    }

    if (action === 'APPROVE' || targetStatus === 'ENROLLED' || targetStatus === 'ACTIVE') {
      // SECTION 40: Payment-dependent activation enforcement
      // An enrollment MUST NOT transition to ENROLLED/ACTIVE status without verified payment
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('status')
        .eq('enrollment_id', id);

      const latestPayment = payments && payments.length > 0 ? payments[payments.length - 1] : null;
      const isPaid = latestPayment && ['PAID', 'VERIFIED', 'COMPLETED'].includes(String(latestPayment.status).toUpperCase());
      const reqPaid = ctx.hasFinancialAccess && paymentStatus && ['PAID', 'VERIFIED', 'COMPLETED'].includes(String(paymentStatus).toUpperCase());

      if (!isPaid && !reqPaid) {
        return NextResponse.json({
          success: false,
          error: 'Cannot activate enrollment: Payment has not been verified. Trainee payment must be settled before enrollment approval.',
          code: 'PAYMENT_REQUIRED',
        }, { status: 400 });
      }

      targetStatus = 'ENROLLED';
    } else if (action === 'REJECT') {
      targetStatus = 'REJECTED';
    }

    const updates: Record<string, unknown> = {
      updated_at: now,
    };

    if (reviewNotes !== undefined) {
      updates.review_notes = reviewNotes;
    }

    if (targetStatus) {
      updates.status = targetStatus;
      updates.reviewed_by = ctx.user.id;
      updates.reviewed_at = now;

      if (targetStatus === 'ENROLLED' || targetStatus === 'ACTIVE') {
        updates.enrolled_at = now;
      }
      if (targetStatus === 'COMPLETED') {
        updates.completed_at = now;
      }

      // If rejected, safely free seat in batch via RPC and mark tuition as refundable
      if (targetStatus === 'REJECTED' || targetStatus === 'CANCELLED') {
        await supabaseAdmin.rpc('cancel_batch_enrollment', {
          p_enrollment_id: id,
          p_new_status: targetStatus,
        });

        const refundNote = reviewNotes ? `[REFUNDABLE] ${reviewNotes}` : '[REFUNDABLE] Enrollment rejected. Tuition fee is eligible for full refund.';
        updates.review_notes = refundNote;

        // Mark associated payment as REFUNDED for registrar processing / PayMongo reversal
        await supabaseAdmin
          .from('payments')
          .update({
            status: 'REFUNDED',
            updated_at: now,
          })
          .eq('enrollment_id', id);
      }
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('enrollments')
      .update(updates)
      .eq('id', id)
      .select(ENROLLMENT_SELECT)
      .maybeSingle();

    if (updateErr) throw updateErr;

    // Optional payment status update (only for authorized financial personnel)
    if (paymentStatus && ctx.hasFinancialAccess) {
      await supabaseAdmin
        .from('payments')
        .update({
          status: toDbPaymentStatus(paymentStatus),
          updated_at: now,
        })
        .eq('enrollment_id', id);
    }

    // Role-Aware Notifications per Section 11 Recipient Matrix
    const traineeId = existing.trainee_id;
    const courseTitle = existing.courses?.name || 'Maritime Training Program';
    const batchCode = existing.batches?.batch_code || '';

    if (targetStatus === 'ENROLLED' || targetStatus === 'APPROVED') {
      try {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.ENROLLMENT_ACTIVATED,
          traineeId,
          batchId: existing.batch_id,
          courseId: existing.course_id,
          entityType: 'ENROLLMENT',
          entityId: id,
          metadata: {
            courseName: courseTitle,
            batchName: batchCode,
          },
        });
      } catch (nErr) {
        console.warn('Failed to send enrollment activated notification:', nErr);
      }
    } else if (targetStatus === 'REJECTED') {
      try {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.ENROLLMENT_REJECTED,
          traineeId,
          batchId: existing.batch_id,
          courseId: existing.course_id,
          entityType: 'ENROLLMENT',
          entityId: id,
          metadata: {
            courseName: courseTitle,
            batchName: batchCode,
            reason: reviewNotes || 'Application criteria not met',
          },
        });
      } catch (nErr) {
        console.warn('Failed to send enrollment rejection notification:', nErr);
      }
    }

    // Audit Logging
    await writeAdminAudit({
      actorId: ctx.user.id,
      action: targetStatus === 'ENROLLED' ? 'ENROLLMENT_APPROVED' : (targetStatus === 'REJECTED' ? 'ENROLLMENT_REJECTED' : 'ENROLLMENT_STATUS_CHANGED'),
      entityType: 'ENROLLMENT',
      entityId: id,
      details: {
        previousStatus: existing.status,
        newStatus: targetStatus,
        reviewNotes: reviewNotes || null,
        batchCode,
      },
      ip,
      userAgent,
    });

    const { data: refreshed } = await supabaseAdmin
      .from('enrollments')
      .select(ENROLLMENT_SELECT)
      .eq('id', id)
      .single();

    return NextResponse.json({ success: true, data: formatEnrollment(refreshed || updated, { includeFinancial: ctx.hasFinancialAccess }) });
  } catch (error: any) {
    console.error('Failed to update enrollment:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update enrollment' }, { status: 500 });
  }
}
