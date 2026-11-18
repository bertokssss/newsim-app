import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  computeEndDate,
  findScheduleConflict,
  formatSchedule,
  getCourseTotalDays,
  isAdminContext,
  parseClockToIso,
  requestMeta,
  requireAdmin,
  SCHEDULE_SELECT,
  toManilaDateAndMinutes,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'SCHEDULE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();
    const { ip, userAgent } = requestMeta(request);

    if (id.startsWith('modular:')) {
      return NextResponse.json({
        success: true,
        data: { id, status: String(body.status || 'SCHEDULED').toUpperCase() },
      });
    }

    // Fetch existing schedule
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('schedules')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.courseId !== undefined) updates.course_id = body.courseId;
    if (body.instructorId !== undefined) updates.instructor_id = body.instructorId || null;
    if (body.room !== undefined) updates.room = (body.room || 'Main Hall').trim();
    if (body.capacity !== undefined) updates.capacity = Math.min(Math.max(1, parseInt(body.capacity, 10) || 24), 24);
    if (body.status !== undefined) {
      const sVal = String(body.status).toUpperCase();
      updates.status = sVal;
      if (sVal === 'COMPLETED') {
        updates.completion_confirmed_by = ctx.user.id;
        updates.completion_confirmed_at = new Date().toISOString();
      }
    }
    if (body.date !== undefined || body.startTime !== undefined || body.endTime !== undefined) {
      const exStart = toManilaDateAndMinutes(existing.start_at);
      const exEnd = toManilaDateAndMinutes(existing.end_at);
      const resolvedDate = String(body.date || exStart?.dateStr || '').trim();
      const resolvedStartTime = String(body.startTime || exStart?.timeLabel || '08:00 AM').trim();
      const resolvedEndTime = String(body.endTime || exEnd?.timeLabel || '12:00 PM').trim();

      if (resolvedDate) {
        const startCheckIso = parseClockToIso(resolvedDate, resolvedStartTime);
        const endCheckIso = parseClockToIso(resolvedDate, resolvedEndTime);
        if (new Date(endCheckIso).getTime() <= new Date(startCheckIso).getTime()) {
          return NextResponse.json(
            { success: false, error: 'Invalid session duration: End time must be later than start time.' },
            { status: 400 }
          );
        }

        const { data: courseRow } = await supabaseAdmin
          .from('courses')
          .select('id, category, duration_hours, theory_days, practical_days')
          .eq('id', updates.course_id || existing.course_id)
          .maybeSingle();

        const totalDays = courseRow ? getCourseTotalDays(courseRow) : 1;
        const calculatedEndDateStr = computeEndDate(resolvedDate, totalDays);
        updates.start_at = startCheckIso;
        updates.end_at = parseClockToIso(calculatedEndDateStr, resolvedEndTime);
      }
    }

    const finalStartAt = (updates.start_at || existing.start_at) as string;
    const finalEndAt = (updates.end_at || existing.end_at) as string;
    const finalRoom = (updates.room || existing.room || 'Main Hall') as string;
    const finalInstructorId = updates.instructor_id !== undefined ? updates.instructor_id : existing.instructor_id;

    const startAtMs = new Date(finalStartAt).getTime();
    const endAtMs = new Date(finalEndAt).getTime();

    if (isNaN(startAtMs) || isNaN(endAtMs) || endAtMs <= startAtMs) {
      return NextResponse.json(
        { success: false, error: 'Invalid session duration: End time must be later than start time.' },
        { status: 400 }
      );
    }

    // Only run conflict check if active or scheduled (skip check if being marked completed or cancelled)
    const finalStatus = (updates.status || existing.status || 'SCHEDULED') as string;
    if (finalStatus !== 'CANCELLED' && finalStatus !== 'COMPLETED') {
      const { data: otherSchedules, error: checkErr } = await supabaseAdmin
        .from('schedules')
        .select('id, room, start_at, end_at, instructor_id, status, courses(code, name), instructors:instructors(profiles(first_name, last_name))')
        .neq('id', id)
        .neq('status', 'CANCELLED');

      if (checkErr) throw checkErr;

      const conflictMsg = findScheduleConflict({
        startAt: finalStartAt,
        endAt: finalEndAt,
        room: finalRoom,
        instructorId: finalInstructorId as string | null,
        existingSchedules: otherSchedules || [],
      });

      if (conflictMsg) {
        return NextResponse.json({ success: false, error: conflictMsg }, { status: 409 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('schedules')
      .update(updates)
      .eq('id', id)
      .select(SCHEDULE_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'SCHEDULE_UPDATED',
      entityType: 'SCHEDULE',
      entityId: id,
      details: body,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, data: formatSchedule(data) });
  } catch (error) {
    console.error('Failed to update schedule:', error);
    return NextResponse.json({ success: false, error: 'Failed to update schedule' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'SCHEDULE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const { ip, userAgent } = requestMeta(request);
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    if (id.startsWith('modular:')) {
      const parts = id.split(':');
      const courseId = parts[1];
      if (courseId) {
        await supabaseAdmin.from('course_instructors').delete().eq('course_id', courseId);
        await supabaseAdmin.from('batches').update({ instructor_id: null }).eq('course_id', courseId);
      }
      return NextResponse.json({
        success: true,
        message: 'Full Modular course assignment removed',
      });
    }

    const { data: schedule, error: getError } = await supabaseAdmin
      .from('schedules')
      .select('id, room, start_at')
      .eq('id', id)
      .maybeSingle();

    if (getError || !schedule) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    if (permanent) {
      const { error: delError } = await supabaseAdmin
        .from('schedules')
        .delete()
        .eq('id', id);

      if (delError) throw delError;

      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'SCHEDULE_DELETED',
        entityType: 'SCHEDULE',
        entityId: id,
        details: { room: schedule.room, start_at: schedule.start_at, permanent: true },
        ip,
        userAgent,
      });

      return NextResponse.json({ success: true, message: 'Schedule session permanently deleted' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('schedules')
      .update({ status: 'CANCELLED' })
      .eq('id', id);

    if (updateError) throw updateError;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'SCHEDULE_CANCELLED',
      entityType: 'SCHEDULE',
      entityId: id,
      details: { room: schedule.room, start_at: schedule.start_at },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, message: 'Schedule session successfully cancelled' });
  } catch (error) {
    console.error('Failed to cancel schedule:', error);
    return NextResponse.json({ success: false, error: 'Failed to cancel schedule' }, { status: 500 });
  }
}
