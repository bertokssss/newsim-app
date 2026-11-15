import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, calculateTraineeCourseGrade } from '@newsim/database';
import {
  ATTENDANCE_SELECT,
  formatAttendance,
  isAdminContext,
  requestMeta,
  requireAdmin,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'ATTENDANCE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, remarks } = body;
    const { ip, userAgent } = requestMeta(request);

    const { data: existing } = await supabaseAdmin.from('attendance').select('*').eq('id', id).maybeSingle();
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Attendance record not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .update({
        status: status ? String(status).toUpperCase() : existing.status,
        remarks: remarks ?? existing.remarks,
        recorded_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(ATTENDANCE_SELECT)
      .single();

    if (error) throw error;

    const formatted = formatAttendance(data);
    const resolvedCourseId = existing.course_id || formatted.courseId;
    if (existing.trainee_id && resolvedCourseId) {
      try {
        await calculateTraineeCourseGrade({
          traineeId: existing.trainee_id,
          courseId: resolvedCourseId,
        });
      } catch (gradeErr) {
        console.warn('Attendance update grade sync notice:', gradeErr);
      }
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'ATTENDANCE_MODIFIED',
      entityType: 'ATTENDANCE',
      entityId: id,
      details: { previousStatus: existing.status, newStatus: status, reason: remarks },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Failed to update attendance:', error);
    return NextResponse.json({ success: false, error: 'Failed to update attendance' }, { status: 500 });
  }
}
