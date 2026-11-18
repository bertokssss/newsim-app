import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, calculateTraineeCourseGrade } from '@newsim/database';
import {
  ATTENDANCE_SELECT,
  formatAttendance,
  isAdminContext,
  isFullModularCourseRow,
  matchesSearch,
  requestMeta,
  requireAdmin,
  unwrap,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

const ACTIVE_ENROLLMENT_STATUSES = ['ENROLLED', 'ONGOING', 'COMPLETED', 'ACTIVE', 'APPROVED'];

function formatProfileNameShort(profile: any): string {
  if (!profile) return '';
  return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
}

function formatClockTime(isoOrNull: string | null | undefined, fallback: string): string {
  if (!isoOrNull) return fallback;
  const d = new Date(isoOrNull);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function pickScheduleInstructor(sched: any, batch: any, courseInstructor: any) {
  const schedInst = unwrap(sched?.instructors);
  const schedProf = unwrap(schedInst?.profiles);
  const batchInst = unwrap(batch?.instructors);
  const batchProf = unwrap(batchInst?.profiles);
  const ciProf = courseInstructor?.profile || null;
  const name =
    formatProfileNameShort(schedProf) ||
    formatProfileNameShort(batchProf) ||
    formatProfileNameShort(ciProf) ||
    'Assigned Instructor';
  const avatarUrl = schedProf?.avatar_url || batchProf?.avatar_url || ciProf?.avatar_url || null;
  const instructorId = sched?.instructor_id || batch?.instructor_id || courseInstructor?.instructorId || '';
  return { instructorId, instructorName: name, instructorAvatarUrl: avatarUrl };
}

function pickPrimaryScheduleForEnrollment(courseSchedules: any[], batchId: string | null): any | null {
  if (!courseSchedules || courseSchedules.length === 0) return null;
  const batchMatches = batchId
    ? courseSchedules.filter((s: any) => !s.batch_id || s.batch_id === batchId)
    : courseSchedules;
  const pool = batchMatches.length > 0 ? batchMatches : courseSchedules;
  return (
    pool.find((s: any) => ['ONGOING', 'SCHEDULED'].includes(String(s.status || '').toUpperCase())) ||
    pool[0] ||
    null
  );
}

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

    const [attRes, enrRes, schedRes, ciRes] = await Promise.all([
      supabaseAdmin
        .from('attendance')
        .select(ATTENDANCE_SELECT)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('enrollments')
        .select(
          'id, trainee_id, course_id, batch_id, status, enrolled_at, created_at, training_center_id, trainees(profile_id, trainee_number, srn, profiles(first_name, last_name, avatar_url)), courses(id, code, name, category, practical_days, training_center_id), batches(id, batch_code, instructor_id, instructors(profiles(first_name, last_name, avatar_url)))'
        )
        .in('status', ACTIVE_ENROLLMENT_STATUSES)
        .not('course_id', 'is', null)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('schedules')
        .select(
          'id, course_id, batch_id, start_at, end_at, room, instructor_id, status, training_center_id, instructors(profiles(first_name, last_name, avatar_url))'
        )
        .neq('status', 'CANCELLED')
        .order('start_at', { ascending: true }),
      supabaseAdmin
        .from('course_instructors')
        .select('course_id, instructor_id, instructors(profile_id, profiles(first_name, last_name, avatar_url))'),
    ]);

    if (attRes.error) throw attRes.error;
    if (enrRes.error) throw enrRes.error;

    const loggedRecords = (attRes.data || [])
      .filter((row: any) => {
        if (!ctx.centerId) return true;
        const schedule = unwrap(row.schedules);
        const course = unwrap(row.courses);
        const rowCenterId = schedule?.training_center_id || course?.training_center_id;
        return !rowCenterId || rowCenterId === ctx.centerId;
      })
      .map(formatAttendance);

    // Index schedules and course instructors
    const schedulesByCourse = new Map<string, any[]>();
    const scheduleById = new Map<string, any>();
    (schedRes.data || []).forEach((s: any) => {
      if (!s.id || !s.course_id) return;
      scheduleById.set(s.id, s);
      const list = schedulesByCourse.get(s.course_id) || [];
      list.push(s);
      schedulesByCourse.set(s.course_id, list);
    });

    const courseInstructorMap = new Map<string, { instructorId: string; profile: any }>();
    (ciRes.data || []).forEach((ci: any) => {
      if (!ci.course_id || courseInstructorMap.has(ci.course_id)) return;
      const inst = unwrap(ci.instructors);
      const prof = unwrap(inst?.profiles);
      courseInstructorMap.set(ci.course_id, {
        instructorId: ci.instructor_id || inst?.profile_id || '',
        profile: prof || null,
      });
    });

    // Track already-logged trainee pairs so we do not duplicate existing attendance rows
    const loggedCourseTrainees = new Set<string>();
    const loggedScheduleTrainees = new Set<string>();
    const loggedCourseDateTrainees = new Set<string>();
    loggedRecords.forEach((r: any) => {
      if (r.courseId && r.traineeId) {
        loggedCourseTrainees.add(`${r.courseId}:${r.traineeId}`);
        if (r.date) {
          loggedCourseDateTrainees.add(`${r.courseId}:${r.date}:${r.traineeId}`);
        }
      }
      if (r.scheduleId && r.traineeId) {
        loggedScheduleTrainees.add(`${r.scheduleId}:${r.traineeId}`);
      }
    });

    const selectedScheduleObj = scheduleId !== 'ALL' ? scheduleById.get(scheduleId) || null : null;
    const seenEnrolledCourseTrainees = new Set<string>();
    const pendingEnrolledRecords: any[] = [];

    (enrRes.data || []).forEach((enr: any) => {
      const course = unwrap(enr.courses);
      if (!course?.id || !enr.trainee_id) return;
      // Only courses with practical components belong on practical attendance rosters
      if (isFullModularCourseRow(course)) return;

      if (ctx.centerId) {
        const rowCenterId = enr.training_center_id || course.training_center_id;
        if (rowCenterId && rowCenterId !== ctx.centerId) return;
      }

      const pairKey = `${course.id}:${enr.trainee_id}`;
      if (seenEnrolledCourseTrainees.has(pairKey)) return;
      seenEnrolledCourseTrainees.add(pairKey);

      if (selectedScheduleObj) {
        if (selectedScheduleObj.course_id !== course.id) return;
        const schedDate = selectedScheduleObj.start_at ? String(selectedScheduleObj.start_at).slice(0, 10) : '';
        if (
          loggedScheduleTrainees.has(`${selectedScheduleObj.id}:${enr.trainee_id}`) ||
          (schedDate && loggedCourseDateTrainees.has(`${course.id}:${schedDate}:${enr.trainee_id}`))
        ) {
          return;
        }
      } else {
        if (loggedCourseTrainees.has(pairKey)) return;
      }

      const trainee = unwrap(enr.trainees);
      const traineeProfile = unwrap(trainee?.profiles);
      const batch = unwrap(enr.batches);
      const targetSched =
        selectedScheduleObj ||
        pickPrimaryScheduleForEnrollment(schedulesByCourse.get(course.id) || [], enr.batch_id || null);

      const dateStr = targetSched?.start_at
        ? String(targetSched.start_at).slice(0, 10)
        : enr.enrolled_at || enr.created_at
          ? String(enr.enrolled_at || enr.created_at).slice(0, 10)
          : new Date().toISOString().slice(0, 10);

      const sessionCode = targetSched?.id
        ? `SES-${String(targetSched.id).slice(0, 8).toUpperCase()}`
        : batch?.batch_code
          ? `SES-${batch.batch_code}`
          : 'PRACTICAL-PENDING';

      const instMeta = pickScheduleInstructor(targetSched, batch, courseInstructorMap.get(course.id));
      const traineeName = formatProfileNameShort(traineeProfile) || 'Enrolled Trainee';

      pendingEnrolledRecords.push({
        id: `enrolled-${enr.id}`,
        hasAttendanceRecord: false,
        enrollmentId: enr.id,
        date: dateStr,
        scheduleId: targetSched?.id || '',
        batchId: enr.batch_id || batch?.id || '',
        batchCode: batch?.batch_code || '',
        sessionCode,
        courseId: course.id,
        courseCode: course.code || '',
        courseTitle: course.name || '',
        traineeId: enr.trainee_id,
        traineeName,
        traineeAvatarUrl: traineeProfile?.avatar_url || null,
        traineeSrn: trainee?.srn || trainee?.trainee_number || '',
        instructorId: instMeta.instructorId,
        instructorName: instMeta.instructorName,
        instructorAvatarUrl: instMeta.instructorAvatarUrl,
        room: targetSched?.room || 'Simulation Suite',
        startTime: formatClockTime(targetSched?.start_at, '08:00 AM'),
        endTime: formatClockTime(targetSched?.end_at, '05:00 PM'),
        status: 'NOT_MARKED',
        remarks: targetSched?.id
          ? 'Enrolled (practical course) — awaiting roll call'
          : 'Enrolled (practical course) — practical schedule pending',
        updatedBy: '',
        updatedAt: enr.enrolled_at || enr.created_at,
      });
    });

    let records = [...loggedRecords, ...pendingEnrolledRecords];

    if (date) records = records.filter((r: any) => r.date === date);
    if (status !== 'ALL') records = records.filter((r: any) => r.status === status.toUpperCase());
    if (courseId !== 'ALL') {
      records = records.filter(
        (r: any) =>
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
    const { scheduleId, courseId, traineeId, status, remarks } = body;
    const { ip, userAgent } = requestMeta(request);

    if ((!scheduleId && !courseId) || !traineeId) {
      return NextResponse.json(
        { success: false, error: 'Course or schedule and trainee are required' },
        { status: 400 }
      );
    }

    // Resolve course_id, session_date, and batch_id from schedule & enrollment so grading engine stays connected
    let schedRow: any = null;
    if (scheduleId) {
      const { data: sData } = await supabaseAdmin
        .from('schedules')
        .select('id, course_id, batch_id, start_at')
        .eq('id', scheduleId)
        .maybeSingle();
      schedRow = sData || null;
    }

    const resolvedCourseId = schedRow?.course_id || courseId || null;
    const resolvedSessionDate =
      body.sessionDate ||
      (schedRow?.start_at
        ? String(schedRow.start_at).slice(0, 10)
        : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()));

    let resolvedBatchId: string | null = body.batchId || schedRow?.batch_id || null;
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

    // Update existing row if already created for same trainee + course + session_date/schedule
    let existingQuery = supabaseAdmin
      .from('attendance')
      .select('id')
      .eq('trainee_id', traineeId);
    if (scheduleId) {
      existingQuery = existingQuery.eq('schedule_id', scheduleId);
    } else if (resolvedCourseId) {
      existingQuery = existingQuery.eq('course_id', resolvedCourseId).eq('session_date', resolvedSessionDate);
    }
    const { data: existingRow } = await existingQuery.limit(1).maybeSingle();

    const normStatus = (status || 'PRESENT').toUpperCase();
    const { data, error } = existingRow?.id
      ? await supabaseAdmin
          .from('attendance')
          .update({
            status: normStatus,
            remarks: remarks || '',
            recorded_by: ctx.user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRow.id)
          .select(ATTENDANCE_SELECT)
          .single()
      : await supabaseAdmin
          .from('attendance')
          .insert({
            schedule_id: scheduleId || null,
            course_id: resolvedCourseId,
            batch_id: resolvedBatchId,
            session_date: resolvedSessionDate,
            check_in_at: `${resolvedSessionDate}T08:00:00Z`,
            trainee_id: traineeId,
            status: normStatus,
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
      details: { traineeId, courseId: resolvedCourseId, status: data.status },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, record: formatAttendance(data) });
  } catch (error) {
    console.error('Failed to record attendance:', error);
    return NextResponse.json({ success: false, error: 'Failed to record attendance' }, { status: 500 });
  }
}
