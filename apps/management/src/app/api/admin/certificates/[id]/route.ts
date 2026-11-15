import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  CERTIFICATE_SELECT,
  formatCertificate,
  isAdminContext,
  requestMeta,
  requireAdmin,
  toDbCertificateStatus,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'CERTIFICATE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, action } = body;
    const { ip, userAgent } = requestMeta(request);

    const { data: existing } = await supabaseAdmin
      .from('certificates')
      .select('*, courses(training_center_id)')
      .eq('id', id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Certificate not found' }, { status: 404 });
    }

    const existingCourse = Array.isArray(existing.courses) ? existing.courses[0] : existing.courses;
    if (ctx.centerId && existingCourse?.training_center_id && existingCourse.training_center_id !== ctx.centerId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Certificate belongs to another training center' },
        { status: 403 }
      );
    }

    const existingStatus = String(existing.status || '').toUpperCase();
    const updates: Record<string, unknown> = {};
    if (status) updates.status = toDbCertificateStatus(status);
    if (action === 'REISSUE') {
      updates.status = toDbCertificateStatus('ISSUED');
      updates.issued_at = new Date().toISOString();
      updates.issued_by = ctx.user.id;
      updates.claimed_at = null;
    } else if (action === 'REVOKE' || status === 'REVOKED') {
      updates.status = 'REVOKED';
    } else if (action === 'CLAIM' || status === 'CLAIMED') {
      if (existingStatus === 'REVOKED') {
        return NextResponse.json(
          { success: false, error: 'Cannot claim a revoked certificate. Reissue first if eligible.' },
          { status: 400 }
        );
      }
      if (existingStatus === 'CLAIMED' || existing.claimed_at) {
        return NextResponse.json(
          { success: false, error: 'Certificate has already been claimed.' },
          { status: 409 }
        );
      }
      updates.status = 'CLAIMED';
      updates.claimed_at = new Date().toISOString();
      updates.released_by = ctx.user.id;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid update fields supplied' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('certificates')
      .update(updates)
      .eq('id', id)
      .select(CERTIFICATE_SELECT)
      .single();

    if (error) throw error;

    const auditAction =
      action === 'REISSUE'
        ? 'CERTIFICATE_REISSUED'
        : action === 'REVOKE' || status === 'REVOKED'
        ? 'CERTIFICATE_REVOKED'
        : action === 'CLAIM' || status === 'CLAIMED'
        ? 'CERTIFICATE_CLAIMED'
        : 'CERTIFICATE_STATUS_CHANGED';

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: auditAction,
      entityType: 'CERTIFICATE',
      entityId: id,
      details: {
        certificateNo: existing.certificate_number,
        reason: body.reason || 'Administrative action',
        ...updates,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, data: formatCertificate(data) });
  } catch (error) {
    console.error('Failed to update certificate:', error);
    return NextResponse.json({ success: false, error: 'Failed to update certificate' }, { status: 500 });
  }
}
