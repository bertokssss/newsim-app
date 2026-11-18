import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  formatSchedule,
  isAdminContext,
  parseClockToIso,
  requestMeta,
  requireAdmin,
  SCHEDULE_SELECT,
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
    if (body.date && body.startTime) updates.start_at = parseClockToIso(body.date, body.startTime);
    if (body.date && body.endTime) updates.end_at = parseClockToIso(body.date, body.endTime);

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

      for (const other of (otherSchedules || [])) {
        if (!other.start_at || !other.end_at) continue;
        const exStartMs = new Date(other.start_at).getTime();
        const exEndMs = new Date(other.end_at).getTime();

        const overlaps = startAtMs < exEndMs && endAtMs > exStartMs;
        if (!overlaps) continue;

        const courseRel = Array.isArray(other.courses) ? other.courses[0] : other.courses;
        const courseLabel = courseRel?.code ? `${courseRel.code} - ${courseRel.name || ''}` : courseRel?.name || 'Session';
        const timeLabel = `${new Date(other.start_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} to ${new Date(other.end_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

        if (other.room && other.room.toLowerCase().trim() === finalRoom.toLowerCase().trim()) {
          return NextResponse.json(
            {
              success: false,
              error: `Classroom Conflict: "${finalRoom}" is already occupied by ${courseLabel} from ${timeLabel}.`,
            },
            { status: 409 }
          );
        }

        if (finalInstructorId && other.instructor_id && other.instructor_id === finalInstructorId) {
          const insRel = Array.isArray(other.instructors) ? other.instructors[0] : other.instructors;
          const insProf = Array.isArray(insRel?.profiles) ? insRel.profiles[0] : insRel?.profiles;
          const insName = insProf ? `${insProf.first_name} ${insProf.last_name}`.trim() : 'The assigned instructor';

          return NextResponse.json(
            {
              success: false,
              error: `Instructor Overlap Conflict: ${insName} is already assigned to ${courseLabel} in ${other.room || 'another room'} from ${timeLabel}.`,
            },
            { status: 409 }
          );
        }
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
