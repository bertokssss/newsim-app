import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, assignScheduleSubstitute, removeScheduleSubstitute } from '@newsim/database';
import { isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

const NETWORK_ERROR_MESSAGE =
  'Could not reach the database (network issue). Please check your connection and try again.';

function isNetworkError(error: any) {
  const msg = `${error?.message || ''} ${error?.details || ''}`;
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR/i.test(msg);
}

function errorResponse(error: any, fallback: string) {
  if (isNetworkError(error)) {
    return NextResponse.json({ success: false, error: NETWORK_ERROR_MESSAGE }, { status: 503 });
  }
  return NextResponse.json({ success: false, error: error?.message || fallback }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'SCHEDULE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id: scheduleId } = await params;
    const body = await request.json();
    const { substituteInstructorId } = body;

    if (!scheduleId || !substituteInstructorId) {
      return NextResponse.json(
        { success: false, error: 'Schedule ID and substitute instructor ID are required' },
        { status: 400 }
      );
    }

    if (scheduleId.startsWith('modular:')) {
      const parts = scheduleId.split(':');
      const courseId = parts[1];
      if (courseId) {
        await supabaseAdmin.from('course_instructors').delete().eq('course_id', courseId);
        await supabaseAdmin.from('course_instructors').upsert(
          {
            course_id: courseId,
            instructor_id: substituteInstructorId,
            assigned_at: new Date().toISOString(),
          },
          { onConflict: 'course_id,instructor_id' }
        );
        await supabaseAdmin
          .from('batches')
          .update({ instructor_id: substituteInstructorId, updated_at: new Date().toISOString() })
          .eq('course_id', courseId);
      }
      return NextResponse.json({
        success: true,
        message: 'Academic Record Reviewer reassigned for Full Modular course.',
      });
    }

    // Check schedule exists
    const { data: schedule, error: schedErr } = await supabaseAdmin
      .from('schedules')
      .select('id, course_id, instructor_id, start_at, end_at, courses(name)')
      .eq('id', scheduleId)
      .maybeSingle();

    if (schedErr) throw schedErr;
    if (!schedule) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    if (schedule.instructor_id === substituteInstructorId) {
      return NextResponse.json(
        { success: false, error: 'Substitute instructor cannot be the same as the originally assigned instructor' },
        { status: 400 }
      );
    }

    // Check if substitute is on approved leave
    const sDate = schedule.start_at ? schedule.start_at.split('T')[0] : '';
    const eDate = schedule.end_at ? schedule.end_at.split('T')[0] : sDate;

    const { data: subLeaves, error: leavesErr } = await supabaseAdmin
      .from('instructor_leaves')
      .select('id, start_date, end_date, leave_type')
      .eq('instructor_id', substituteInstructorId)
      .eq('status', 'APPROVED')
      .lte('start_date', eDate)
      .gte('end_date', sDate);

    if (leavesErr) throw leavesErr;

    if (subLeaves && subLeaves.length > 0) {
      const l = subLeaves[0];
      return NextResponse.json(
        {
          success: false,
          error: `Cannot assign substitute: Selected substitute instructor is also on approved leave from ${l.start_date} to ${l.end_date}. Please choose another available instructor.`,
        },
        { status: 409 }
      );
    }

    const updated = await assignScheduleSubstitute(scheduleId, substituteInstructorId, ctx.user.id);

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'SCHEDULE_SUBSTITUTE_ASSIGNED',
      entityType: 'SCHEDULE',
      entityId: scheduleId,
      details: {
        scheduleId,
        originalInstructorId: schedule.instructor_id,
        substituteInstructorId,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Substitute instructor assigned successfully! Operations can proceed without waiting.',
    });
  } catch (error: any) {
    console.error('Failed to assign substitute instructor:', error);
    return errorResponse(error, 'Failed to assign substitute instructor');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'SCHEDULE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id: scheduleId } = await params;
    const updated = await removeScheduleSubstitute(scheduleId, ctx.user.id);

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'SCHEDULE_SUBSTITUTE_REMOVED',
      entityType: 'SCHEDULE',
      entityId: scheduleId,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Substitute instructor assignment removed.',
    });
  } catch (error: any) {
    console.error('Failed to remove substitute instructor:', error);
    return errorResponse(error, 'Failed to remove substitute instructor');
  }
}
