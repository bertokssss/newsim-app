import { supabaseAdmin } from '../supabase';
import { dispatchNotificationEvent, NOTIFICATION_EVENTS } from './notifications';
import { calculateTraineeCourseGrade } from './grading';
import { getInstructorCourseIds } from './instructor-portal';

export interface AttendanceRosterItem {
  traineeId: string;
  trainee_id: string;
  traineeName: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  srn: string;
  trainee_number: string;
  rank: string;
  vesselType?: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | null; // null represents "Not Marked"
  isSaved: boolean;
  is_marked: boolean;
  remarks: string;
  attendanceId?: string;
}

export interface AttendanceSessionSummary {
  totalEnrolled: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  notMarkedCount: number;
  recordingCompletionRate: number; // percentage of trainees marked
  attendanceRate: number; // (present + late) / markedCount
  isFinalized: boolean;
  finalizedAt?: string;
  finalizedBy?: string;
  unmarkedAcknowledged: boolean;
}

/**
 * Retrieve courses, batches, and sessions assigned to this instructor.
 * Strictly scopes to courses where the instructor is assigned via course_instructors,
 * batches.instructor_id, or schedules.instructor_id / substitute_instructor_id.
 */
export async function getInstructorAttendanceOptions(instructorProfileId: string) {
  // 1. Find assigned course IDs in parallel
  const assignedCourseIds = new Set<string>();

  const [ciRes, batchDataRes, schedDataRes] = await Promise.all([
    supabaseAdmin
      .from('course_instructors')
      .select('course_id')
      .eq('instructor_id', instructorProfileId),
    supabaseAdmin
      .from('batches')
      .select('id, course_id, batch_code, status, start_date, end_date')
      .eq('instructor_id', instructorProfileId),
    supabaseAdmin
      .from('schedules')
      .select('id, course_id, room, start_at, end_at, status')
      .or(`instructor_id.eq.${instructorProfileId},substitute_instructor_id.eq.${instructorProfileId}`)
      .neq('status', 'CANCELLED'),
  ]);

  (ciRes.data || []).forEach((ci: any) => { if (ci.course_id) assignedCourseIds.add(ci.course_id); });
  (batchDataRes.data || []).forEach((b: any) => { if (b.course_id) assignedCourseIds.add(b.course_id); });
  (schedDataRes.data || []).forEach((s: any) => { if (s.course_id) assignedCourseIds.add(s.course_id); });

  const courseIdsArray = Array.from(assignedCourseIds);

  if (courseIdsArray.length === 0) {
    return { courses: [], batches: [], schedules: [] };
  }

  // 2, 3, 4. Fetch courses, batches, and schedules in parallel
  const [coursesRes, batchesRes, schedulesRes] = await Promise.all([
    supabaseAdmin
      .from('courses')
      .select('id, code, name, description, category, capacity, status, duration_hours, theory_days, practical_days')
      .in('id', courseIdsArray)
      .order('code', { ascending: true }),
    supabaseAdmin
      .from('batches')
      .select('id, course_id, batch_code, status, start_date, end_date, capacity, enrolled_count, instructor_id, training_centers(name)')
      .in('course_id', courseIdsArray)
      .order('start_date', { ascending: false }),
    supabaseAdmin
      .from('schedules')
      .select('id, course_id, room, start_at, end_at, status, substitute_instructor_id')
      .in('course_id', courseIdsArray)
      .neq('status', 'CANCELLED')
      .order('start_at', { ascending: false }),
  ]);

  const courses = (coursesRes.data || []).map((c: any) => {
    const durationHours = Number(c.duration_hours || 40);
    const durationDays = Math.max(1, Math.ceil(durationHours / 8));
    const theoryDays = Number(c.theory_days ?? (durationDays === 1 ? 1 : Math.max(1, Math.round(durationDays * 0.4))));
    const practicalDays = Number(c.practical_days ?? (durationDays === 1 ? 0 : Math.max(0, durationDays - theoryDays)));
    return {
      ...c,
      duration_hours: durationHours,
      theory_days: theoryDays,
      practical_days: practicalDays,
    };
  });

  // Filter batches to those assigned to instructor or where instructor is on course
  const filteredBatches = (batchesRes.data || [])
    .filter((b: any) => b.instructor_id === instructorProfileId || assignedCourseIds.has(b.course_id) || courseIdsArray.includes(b.course_id))
    .map((b: any) => ({
      ...b,
      batch_number: b.batch_code,
    }));

  return {
    courses: courses || [],
    batches: filteredBatches,
    schedules: schedulesRes.data || [],
  };
}

/**
 * Fetch course & batch-specific attendance roster.
 * Mandate: Trainees enrolled in other courses or other batches MUST NOT appear!
 * Unmarked attendance records MUST remain blank ("Not Marked") by default.
 */
export async function getCourseBatchAttendanceRoster(params: {
  courseId: string;
  batchId?: string;
  sessionDate: string;
  instructorProfileId: string;
}): Promise<{
  roster: AttendanceRosterItem[];
  summary: AttendanceSessionSummary;
  stats: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    notMarked: number;
    recordingCompletionRate: number;
    attendanceRate: number;
  };
  session: any;
  batchId: string | null;
  courseTitle: string;
  batchCode: string;
  isAuthorized: boolean;
  message?: string;
}> {
  const { courseId, batchId, sessionDate, instructorProfileId } = params;

  const assignedCourseIds = await getInstructorCourseIds(instructorProfileId);
  if (!assignedCourseIds.includes(courseId)) {
    return {
      roster: [],
      summary: emptySummary(),
      stats: { total: 0, present: 0, late: 0, absent: 0, excused: 0, notMarked: 0, recordingCompletionRate: 0, attendanceRate: 0 },
      session: null,
      batchId: null,
      courseTitle: '',
      batchCode: '',
      isAuthorized: false,
      message: 'Forbidden: Instructor is not assigned to instruct this course.',
    };
  }

  // 1 & 2. Verify course exists and fetch target batch in parallel
  const explicitBatchFilter = Boolean(batchId);
  let targetBatchId = batchId;
  let batchCode = '';

  const [courseRes, batchRes] = await Promise.all([
    supabaseAdmin
      .from('courses')
      .select('id, code, name, duration_hours, theory_days, practical_days')
      .eq('id', courseId)
      .maybeSingle(),
    targetBatchId
      ? supabaseAdmin
          .from('batches')
          .select('id, batch_code, course_id')
          .eq('id', targetBatchId)
          .maybeSingle()
      : supabaseAdmin
          .from('batches')
          .select('id, batch_code')
          .eq('course_id', courseId)
          .order('start_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
  ]);

  const course = courseRes.data;
  if (!course) {
    return {
      roster: [],
      summary: emptySummary(),
      stats: { total: 0, present: 0, late: 0, absent: 0, excused: 0, notMarked: 0, recordingCompletionRate: 0, attendanceRate: 0 },
      session: null,
      batchId: null,
      courseTitle: '',
      batchCode: '',
      isAuthorized: false,
      message: 'Course not found',
    };
  }

  if (batchRes.data) {
    targetBatchId = batchRes.data.id;
    batchCode = batchRes.data.batch_code;
  }

  // 3 & 6. Query trainees officially enrolled in THIS course and session state in parallel
  let enrollQuery = supabaseAdmin
    .from('enrollments')
    .select('id, trainee_id, course_id, batch_id, status')
    .eq('course_id', courseId)
    .in('status', ['ENROLLED', 'ONGOING', 'COMPLETED', 'ACTIVE', 'APPROVED']);

  if (explicitBatchFilter && targetBatchId) {
    enrollQuery = enrollQuery.eq('batch_id', targetBatchId);
  }

  const [enrollRes, sessionStateRes] = await Promise.all([
    enrollQuery,
    targetBatchId && sessionDate
      ? supabaseAdmin
          .from('attendance_sessions')
          .select('*')
          .eq('batch_id', targetBatchId)
          .eq('session_date', sessionDate)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (enrollRes.error) throw enrollRes.error;
  let enrollments = enrollRes.data;

  // If explicit batch had no enrollments, also check course enrollments with null batch_id
  if (explicitBatchFilter && (!enrollments || enrollments.length === 0)) {
    const { data: fallbackEnr } = await supabaseAdmin
      .from('enrollments')
      .select('id, trainee_id, course_id, batch_id, status')
      .eq('course_id', courseId)
      .in('status', ['ENROLLED', 'ONGOING', 'COMPLETED', 'ACTIVE', 'APPROVED']);
    enrollments = fallbackEnr || [];
  }

  const validEnrollments = enrollments || [];

  // Check attendance session status (OPEN vs FINALIZED)
  let isFinalized = false;
  let finalizedAt: string | undefined;
  let finalizedBy: string | undefined;
  let unmarkedAcknowledged = false;
  let sessionRecord: any = null;

  const sessionState = sessionStateRes.data;
  if (sessionState) {
    sessionRecord = sessionState;
    isFinalized = sessionState.status === 'FINALIZED';
    finalizedAt = sessionState.finalized_at || undefined;
    finalizedBy = sessionState.finalized_by || undefined;
    unmarkedAcknowledged = sessionState.unmarked_acknowledged || false;
  }

  if (!sessionRecord && targetBatchId) {
    sessionRecord = {
      id: null,
      batch_id: targetBatchId,
      course_id: courseId,
      session_date: sessionDate,
      status: 'OPEN',
      finalized_at: null,
      finalized_by: null,
    };
  }

  if (validEnrollments.length === 0) {
    return {
      roster: [],
      summary: emptySummary(),
      stats: { total: 0, present: 0, late: 0, absent: 0, excused: 0, notMarked: 0, recordingCompletionRate: 0, attendanceRate: 0 },
      session: sessionRecord,
      batchId: targetBatchId || null,
      courseTitle: course.name,
      batchCode: batchCode || 'N/A',
      isAuthorized: true,
      message: 'No trainees are enrolled in this course or session.',
    };
  }

  const traineeIds: string[] = Array.from(new Set<string>(validEnrollments.map((e: any) => String(e.trainee_id || '')).filter(Boolean)));

  // 4 & 5. Fetch trainee profiles, SRN records, and saved attendance records in parallel
  let attQuery = supabaseAdmin
    .from('attendance')
    .select('id, trainee_id, status, remarks, check_in_at, session_date, batch_id, course_id')
    .eq('course_id', courseId)
    .in('trainee_id', traineeIds);

  if (sessionDate) {
    attQuery = attQuery.eq('session_date', sessionDate);
  }
  if (explicitBatchFilter && targetBatchId) {
    attQuery = attQuery.eq('batch_id', targetBatchId);
  }

  const [profilesRes, traineeMetaRes, savedAttendanceRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, srn, avatar_url')
      .in('id', traineeIds),
    supabaseAdmin
      .from('trainees')
      .select('profile_id, trainee_number, gender, srn')
      .in('profile_id', traineeIds),
    attQuery,
  ]);

  const profileMap = new Map<string, any>((profilesRes.data || []).map((p: any) => [p.id, p]));
  const metaMap = new Map<string, any>((traineeMetaRes.data || []).map((t: any) => [t.profile_id, t]));
  const attendanceMap = new Map<string, any>((savedAttendanceRes.data || []).map((a: any) => [a.trainee_id, a]));

  // 7. Assemble Roster items with BLANK by default for unrecorded trainees
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  let notMarkedCount = 0;

  const roster: AttendanceRosterItem[] = traineeIds.map((tid: string) => {
    const prof = profileMap.get(tid);
    const meta = metaMap.get(tid);
    const saved = attendanceMap.get(tid);

    const fullName = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : 'Trainee';
    const srn = meta?.srn || prof?.srn || meta?.trainee_number || 'TRN-' + tid.slice(0, 6).toUpperCase();
    const rank = meta?.gender || 'Maritime Cadet';

    if (saved && saved.status && ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].includes(saved.status.toUpperCase())) {
      const st = saved.status.toUpperCase();
      if (st === 'PRESENT') presentCount++;
      else if (st === 'LATE') lateCount++;
      else if (st === 'ABSENT') absentCount++;
      else if (st === 'EXCUSED') excusedCount++;

      return {
        traineeId: tid,
        trainee_id: tid,
        traineeName: fullName,
        name: fullName,
        email: prof?.email || '',
        avatarUrl: prof?.avatar_url || null,
        srn,
        trainee_number: srn,
        rank,
        status: st as any,
        isSaved: true,
        is_marked: true,
        remarks: saved.remarks || '',
        attendanceId: saved.id,
      };
    } else {
      // MANDATORY REQUIREMENT: Unmarked attendance status remains BLANK (null / Not Marked)!
      notMarkedCount++;
      return {
        traineeId: tid,
        trainee_id: tid,
        traineeName: fullName,
        name: fullName,
        email: prof?.email || '',
        avatarUrl: prof?.avatar_url || null,
        srn,
        trainee_number: srn,
        rank,
        status: null, // "Not Marked"
        isSaved: false,
        is_marked: false,
        remarks: saved?.remarks || '',
      };
    }
  });

  const totalEnrolled = roster.length;
  const recordedCount = totalEnrolled - notMarkedCount;
  const recordingCompletionRate = totalEnrolled > 0 ? Math.round((recordedCount / totalEnrolled) * 100) : 0;
  const attendanceRate = recordedCount > 0 ? Math.round(((presentCount + lateCount) / recordedCount) * 100) : 0;

  const summary: AttendanceSessionSummary = {
    totalEnrolled,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    notMarkedCount,
    recordingCompletionRate,
    attendanceRate,
    isFinalized,
    finalizedAt,
    finalizedBy,
    unmarkedAcknowledged,
  };

  const stats = {
    total: totalEnrolled,
    present: presentCount,
    late: lateCount,
    absent: absentCount,
    excused: excusedCount,
    notMarked: notMarkedCount,
    recordingCompletionRate,
    attendanceRate,
  };

  return {
    roster,
    summary,
    stats,
    session: sessionRecord,
    batchId: targetBatchId || null,
    courseTitle: `${course.code ? course.code + ' - ' : ''}${course.name}`,
    batchCode: batchCode || 'N/A',
    isAuthorized: true,
  };
}

/**
 * Save / Update attendance records for a course session.
 * Enforces backend validation, audit trailing, and prevents duplicate records.
 */
export async function saveInstructorBatchAttendance(params: {
  courseId: string;
  batchId?: string | null;
  scheduleId?: string;
  sessionDate: string;
  instructorProfileId: string;
  records: Array<{ traineeId?: string; trainee_id?: string; status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | string | null; remarks?: string }>;
}) {
  const { courseId, scheduleId, sessionDate, instructorProfileId, records } = params;
  const assignedCourseIds = await getInstructorCourseIds(instructorProfileId);
  if (!assignedCourseIds.includes(courseId)) {
    throw new Error('FORBIDDEN: Instructor is not assigned to record attendance for this course.');
  }

  let resolvedBatchId = params.batchId || null;

  // 1. Resolve or verify batch for course
  if (resolvedBatchId) {
    const { data: batch } = await supabaseAdmin
      .from('batches')
      .select('id, course_id, batch_code')
      .eq('id', resolvedBatchId)
      .maybeSingle();

    if (!batch || batch.course_id !== courseId) {
      resolvedBatchId = null;
    }
  }

  if (!resolvedBatchId) {
    const { data: firstBatch } = await supabaseAdmin
      .from('batches')
      .select('id, course_id, batch_code')
      .eq('course_id', courseId)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (firstBatch?.id) {
      resolvedBatchId = firstBatch.id;
    } else {
      const { data: courseRow } = await supabaseAdmin
        .from('courses')
        .select('code, training_center_id')
        .eq('id', courseId)
        .maybeSingle();

      const { data: createdBatch } = await supabaseAdmin
        .from('batches')
        .insert({
          course_id: courseId,
          training_center_id: courseRow?.training_center_id || null,
          batch_code: `${courseRow?.code || 'STCW'}-BATCH-01`,
          capacity: 24,
          enrolled_count: 0,
          status: 'OPEN',
          instructor_id: instructorProfileId,
        })
        .select('id')
        .single();

      resolvedBatchId = createdBatch?.id || null;
    }
  }

  if (!resolvedBatchId) {
    throw new Error('Could not resolve or create batch for the selected course');
  }

  // Resolve a matching scheduleId if not explicitly provided so schedule-based views stay synced
  let resolvedScheduleId = scheduleId || null;
  if (!resolvedScheduleId) {
    const { data: courseScheds } = await supabaseAdmin
      .from('schedules')
      .select('id, start_at, instructor_id, substitute_instructor_id')
      .eq('course_id', courseId)
      .neq('status', 'CANCELLED')
      .order('start_at', { ascending: false });

    if (courseScheds && courseScheds.length > 0) {
      const sameDateSched = courseScheds.find((s: any) => s.start_at && String(s.start_at).startsWith(sessionDate));
      const instructorSched = courseScheds.find(
        (s: any) => s.instructor_id === instructorProfileId || s.substitute_instructor_id === instructorProfileId
      );
      resolvedScheduleId = sameDateSched?.id || instructorSched?.id || courseScheds[0].id;
    }
  }

  // 2. Check if session is already finalized
  const { data: sessionState } = await supabaseAdmin
    .from('attendance_sessions')
    .select('id, status')
    .eq('batch_id', resolvedBatchId)
    .eq('session_date', sessionDate)
    .maybeSingle();

  if (sessionState?.status === 'FINALIZED') {
    throw new Error('This attendance session has already been finalized and locked. Corrections require admin authorization.');
  }

  // 3. Upsert session container row
  const { data: upsertedSession } = await supabaseAdmin
    .from('attendance_sessions')
    .upsert({
      batch_id: resolvedBatchId,
      course_id: courseId,
      schedule_id: resolvedScheduleId,
      session_date: sessionDate,
      status: 'OPEN',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'batch_id,session_date' })
    .select('*')
    .single();

  // 4. Pre-fetch existing attendance records for all traineeIds in one bulk query
  const recordTraineeIds = Array.from(
    new Set(records.map((r) => r.traineeId || r.trainee_id).filter(Boolean) as string[])
  );
  const existingAttendanceByTrainee = new Map<string, any>();

  if (recordTraineeIds.length > 0) {
    const { data: existingRows } = await supabaseAdmin
      .from('attendance')
      .select('id, trainee_id, status, remarks, schedule_id, batch_id')
      .eq('course_id', courseId)
      .eq('session_date', sessionDate)
      .in('trainee_id', recordTraineeIds);

    (existingRows || []).forEach((row: any) => {
      if (row.trainee_id && !existingAttendanceByTrainee.has(row.trainee_id)) {
        existingAttendanceByTrainee.set(row.trainee_id, row);
      }
    });
  }

  const [{ data: batchMeta }, { data: courseMeta }] = await Promise.all([
    resolvedBatchId
      ? supabaseAdmin.from('batches').select('batch_code').eq('id', resolvedBatchId).maybeSingle()
      : Promise.resolve({ data: null }),
    courseId
      ? supabaseAdmin.from('courses').select('code, name').eq('id', courseId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const resolvedBatchName = batchMeta?.batch_code || courseMeta?.code || 'Scheduled Batch';
  const resolvedCourseName = courseMeta?.name || courseMeta?.code || 'Maritime Course';

  const savedResults: any[] = [];
  const affectedTraineeIds = new Set<string>();

  for (const rec of records) {
    const traineeId = rec.traineeId || rec.trainee_id;
    if (!traineeId) continue;

    const existing = existingAttendanceByTrainee.get(traineeId);

    // If instructor reset status to blank / null / NOT_MARKED, remove draft attendance row if present
    if (!rec.status || rec.status === 'NOT_MARKED') {
      if (existing?.id) {
        await supabaseAdmin.from('attendance').delete().eq('id', existing.id);
        affectedTraineeIds.add(traineeId);
      }
      continue;
    }

    const normStatus = String(rec.status).toUpperCase();
    if (!['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].includes(normStatus)) {
      continue;
    }

    affectedTraineeIds.add(traineeId);

    if (existing) {
      const statusChanged = existing.status !== normStatus;
      const { data: updated, error } = await supabaseAdmin
        .from('attendance')
        .update({
          status: normStatus,
          batch_id: existing.batch_id || resolvedBatchId,
          schedule_id: existing.schedule_id || resolvedScheduleId,
          remarks: rec.remarks || '',
          updated_at: new Date().toISOString(),
          updated_by: instructorProfileId,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (!error && updated) {
        savedResults.push(updated);

        // Audit trail if status changed
        if (statusChanged) {
          await supabaseAdmin.from('audit_logs').insert({
            actor_id: instructorProfileId,
            action: 'ATTENDANCE_STATUS_UPDATED',
            entity_type: 'ATTENDANCE',
            entity_id: existing.id,
            old_values: { status: existing.status, remarks: existing.remarks },
            new_values: { status: normStatus, remarks: rec.remarks, sessionDate, batchId: resolvedBatchId },
          });
        }
      }
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from('attendance')
        .insert({
          course_id: courseId,
          batch_id: resolvedBatchId,
          schedule_id: resolvedScheduleId,
          trainee_id: traineeId,
          session_date: sessionDate,
          check_in_at: `${sessionDate}T08:00:00Z`,
          status: normStatus,
          remarks: rec.remarks || '',
          recorded_by: instructorProfileId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && inserted) {
        savedResults.push(inserted);

        await supabaseAdmin.from('audit_logs').insert({
          actor_id: instructorProfileId,
          action: 'ATTENDANCE_RECORDED',
          entity_type: 'ATTENDANCE',
          entity_id: inserted.id,
          new_values: { status: normStatus, remarks: rec.remarks, sessionDate, batchId: resolvedBatchId, traineeId },
        });
      }
    }

    // Dispatch notification
    try {
      const eventType = normStatus === 'LATE' 
        ? NOTIFICATION_EVENTS.TRAINEE_LATE 
        : normStatus === 'ABSENT' 
          ? NOTIFICATION_EVENTS.TRAINEE_ABSENT 
          : NOTIFICATION_EVENTS.ATTENDANCE_RECORDED;

      await dispatchNotificationEvent({
        event: eventType,
        traineeId,
        instructorId: instructorProfileId,
        courseId,
        entityType: 'ATTENDANCE',
        entityId: resolvedBatchId,
        metadata: {
          sessionDate,
          status: normStatus,
          remarks: rec.remarks,
          batchName: resolvedBatchName,
          courseName: resolvedCourseName,
        },
      });
    } catch (notifErr) {
      console.warn('Attendance notification error:', notifErr);
    }
  }

  // 5. Sync course grade attendance component for all affected trainees in parallel
  await Promise.all(
    Array.from(affectedTraineeIds).map(async (tid) => {
      try {
        await calculateTraineeCourseGrade({ traineeId: tid, courseId });
      } catch (gradeErr) {
        console.warn('Attendance grade sync notice:', gradeErr);
      }
    })
  );

  return {
    success: true,
    count: savedResults.length,
    session: upsertedSession,
    batchId: resolvedBatchId,
  };
}

/**
 * Finalize an attendance session.
 * Requires instructor acknowledgment if any trainees remain unmarked.
 * Never silently converts unmarked trainees to Absent.
 */
export async function finalizeInstructorBatchAttendance(params: {
  sessionId?: string;
  courseId?: string;
  batchId?: string | null;
  sessionDate?: string;
  instructorProfileId: string;
  acknowledgeUnmarked?: boolean;
}) {
  const { sessionId, instructorProfileId, acknowledgeUnmarked } = params;
  let courseId = params.courseId || '';
  let batchId = params.batchId || '';
  let sessionDate = params.sessionDate || '';

  if (sessionId && (!courseId || !batchId || !sessionDate)) {
    const { data: existingSession } = await supabaseAdmin
      .from('attendance_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (existingSession) {
      courseId = courseId || existingSession.course_id;
      batchId = batchId || existingSession.batch_id;
      sessionDate = sessionDate || existingSession.session_date;
    }
  }

  if (courseId && !batchId) {
    const { data: firstBatch } = await supabaseAdmin
      .from('batches')
      .select('id')
      .eq('course_id', courseId)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (firstBatch?.id) batchId = firstBatch.id;
  }

  if (!courseId || !batchId || !sessionDate) {
    throw new Error('Course, batch, and session date are required to finalize the attendance session.');
  }

  // Retrieve current roster summary
  const { summary, roster, isAuthorized } = await getCourseBatchAttendanceRoster({
    courseId,
    batchId,
    sessionDate,
    instructorProfileId,
  });

  if (!isAuthorized) {
    throw new Error('FORBIDDEN: Instructor is not assigned to finalize attendance for this course.');
  }

  if (summary.isFinalized) {
    throw new Error('Attendance session is already finalized and locked.');
  }

  if (summary.notMarkedCount > 0 && !acknowledgeUnmarked) {
    const err = new Error(
      `Cannot finalize session: There are still ${summary.notMarkedCount} trainee(s) Not Marked. Please mark them or explicitly acknowledge incomplete attendance before finalization.`
    );
    (err as any).requiresAcknowledgment = true;
    (err as any).notMarkedCount = summary.notMarkedCount;
    throw err;
  }

  // Update attendance_sessions status to FINALIZED
  const { data: session, error } = await supabaseAdmin
    .from('attendance_sessions')
    .upsert({
      batch_id: batchId,
      course_id: courseId,
      session_date: sessionDate,
      status: 'FINALIZED',
      finalized_by: instructorProfileId,
      finalized_at: new Date().toISOString(),
      unmarked_acknowledged: Boolean(acknowledgeUnmarked),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'batch_id,session_date' })
    .select()
    .single();

  if (error) throw error;

  // Ensure all enrolled trainees in this roster have their attendance grade component recalculated in parallel
  const rosterTraineeIds = Array.from(new Set(roster.map((item) => item.traineeId).filter(Boolean)));
  if (rosterTraineeIds.length > 0) {
    await supabaseAdmin
      .from('attendance')
      .select('id, trainee_id, status')
      .eq('course_id', courseId)
      .eq('session_date', sessionDate)
      .in('trainee_id', rosterTraineeIds);

    await Promise.all(
      rosterTraineeIds.map(async (tid) => {
        try {
          await calculateTraineeCourseGrade({ traineeId: tid, courseId });
        } catch {}
      })
    );
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: instructorProfileId,
    action: 'ATTENDANCE_SESSION_FINALIZED',
    entity_type: 'ATTENDANCE_SESSION',
    entity_id: session?.id,
    new_values: { batchId, sessionDate, totalEnrolled: summary.totalEnrolled, presentCount: summary.presentCount, lateCount: summary.lateCount, absentCount: summary.absentCount, notMarkedCount: summary.notMarkedCount },
  });

  return { success: true, session };
}

function emptySummary(): AttendanceSessionSummary {
  return {
    totalEnrolled: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    excusedCount: 0,
    notMarkedCount: 0,
    recordingCompletionRate: 0,
    attendanceRate: 0,
    isFinalized: false,
    unmarkedAcknowledged: false,
  };
}
