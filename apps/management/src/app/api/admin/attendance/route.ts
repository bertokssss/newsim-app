import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, calculateTraineeCourseGrade } from '@newsim/database';
import {
  ATTENDANCE_SELECT,
  formatAttendance,
  isAdminContext,
  matchesSearch,
  requestMeta,
  requireAdmin,
  unwrap,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'ATTENDANCE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '';
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search')?.toLowerCase() || '';
    const courseId = searchParams.get('courseId') || 'ALL';
    const scheduleId = searchParams.get('scheduleId') || 'ALL';

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select(ATTENDANCE_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw error;

    let records = (data || [])
      .filter((row: any) => {
        if (!ctx.centerId) return true;
        const schedule = unwrap(row.schedules);
        const course = unwrap(row.courses);
        const rowCenterId = schedule?.training_center_id || course?.training_center_id;
        return !rowCenterId || rowCenterId === ctx.centerId;
      })
      .map(formatAttendance);

    if (date) records = records.filter((r: any) => r.date === date);
    if (status !== 'ALL') records = records.filter((r: any) => r.status === status.toUpperCase());
    if (courseId !== 'ALL') {
      records = records.filter((r: any) =>
        r.courseId === courseId ||
        (r.courseCode && r.courseCode.toLowerCase() === courseId.toLowerCase())
      );
    }
    if (scheduleId !== 'ALL') {
      records = records.filter((r: any) => r.scheduleId === scheduleId);
    }
    if (search) {
      records = records.filter((r: any) =>
        matchesSearch(
          [r.traineeName, r.traineeSrn, r.courseTitle, r.courseCode, r.sessionCode, r.instructorName, r.room],
          search
        )
      );
    }

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('Failed to load attendance:', error);
    return NextResponse.json({ success: false, error: 'Failed to load attendance' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'ATTENDANCE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { scheduleId, traineeId, status, remarks } = body;
    const { ip, userAgent } = requestMeta(request);

    if (!scheduleId || !traineeId) {
      return NextResponse.json(
        { success: false, error: 'Schedule and trainee are required' },
        { status: 400 }
      );
    }

    // Resolve course_id, session_date, and batch_id from schedule & enrollment so grading engine stays connected
    const { data: schedRow } = await supabaseAdmin
      .from('schedules')
      .select('id, course_id, start_at')
      .eq('id', scheduleId)
      .maybeSingle();

    const resolvedCourseId = schedRow?.course_id || body.courseId || null;
    const resolvedSessionDate =
      body.sessionDate ||
      (schedRow?.start_at ? String(schedRow.start_at).slice(0, 10) : new Date().toISOString().slice(0, 10));

    let resolvedBatchId: string | null = body.batchId || null;
    if (!resolvedBatchId && resolvedCourseId) {
      const { data: enrRow } = await supabaseAdmin
        .from('enrollments')
        .select('batch_id')
        .eq('trainee_id', traineeId)
        .eq('course_id', resolvedCourseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedBatchId = enrRow?.batch_id || null;
    }

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .insert({
        schedule_id: scheduleId,
        course_id: resolvedCourseId,
        batch_id: resolvedBatchId,
        session_date: resolvedSessionDate,
        check_in_at: `${resolvedSessionDate}T08:00:00Z`,
        trainee_id: traineeId,
        status: (status || 'PRESENT').toUpperCase(),
        remarks: remarks || '',
        recorded_by: ctx.user.id,
      })
      .select(ATTENDANCE_SELECT)
      .single();

    if (error) throw error;

    if (resolvedCourseId) {
      try {
        await calculateTraineeCourseGrade({ traineeId, courseId: resolvedCourseId });
      } catch (gradeErr) {
        console.warn('Attendance grade sync notice:', gradeErr);
      }
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'ATTENDANCE_RECORDED',
      entityType: 'ATTENDANCE',
      entityId: data.id,
      details: { traineeId, status: data.status },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, record: formatAttendance(data) });
  } catch (error) {
    console.error('Failed to record attendance:', error);
    return NextResponse.json({ success: false, error: 'Failed to record attendance' }, { status: 500 });
  }
}
