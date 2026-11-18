import { supabaseAdmin } from '../supabase';
import { dispatchNotificationEvent, getUserNotifications, NOTIFICATION_EVENTS } from './notifications';
import { calculateTraineeCourseGrade, isInHouseModularCourse } from './grading';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const instructorCourseIdsCache = new Map<string, { expiresAt: number; promise: Promise<string[]> }>();
const INSTRUCTOR_COURSE_IDS_TTL_MS = 5000;

/**
 * Helper to ensure a valid instructor profile ID exists.
 * Never falls back to an arbitrary instructor profile when ID is missing or invalid.
 */
export async function resolveInstructorProfileId(providedId?: string): Promise<string> {
  if (!providedId || !UUID_REGEX.test(providedId)) {
    throw new Error('FORBIDDEN: Valid authenticated instructor profile ID is required.');
  }
  return providedId;
}

/**
 * Helper to get all course IDs assigned to the instructor.
 * Checks schedules.instructor_id, schedules.substitute_instructor_id, course_instructors, and batches in parallel.
 * Uses a short 5-second cache by instructorProfileId to deduplicate repeated calls within a request.
 */
export async function getInstructorCourseIds(instructorProfileId: string): Promise<string[]> {
  if (!instructorProfileId || !UUID_REGEX.test(instructorProfileId)) {
    return [];
  }
  const now = Date.now();
  const cached = instructorCourseIdsCache.get(instructorProfileId);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const fetchPromise = (async () => {
    const courseIdSet = new Set<string>();

    try {
      const [schedsPrimaryRes, schedsSubRes, ciRes, batchRes] = await Promise.all([
        supabaseAdmin
          .from('schedules')
          .select('course_id')
          .eq('instructor_id', instructorProfileId)
          .neq('status', 'CANCELLED'),
        supabaseAdmin
          .from('schedules')
          .select('course_id')
          .eq('substitute_instructor_id', instructorProfileId)
          .neq('status', 'CANCELLED'),
        supabaseAdmin
          .from('course_instructors')
          .select('course_id')
          .eq('instructor_id', instructorProfileId),
        supabaseAdmin
          .from('batches')
          .select('course_id')
          .eq('instructor_id', instructorProfileId),
      ]);

      (schedsPrimaryRes.data || []).forEach((s: any) => {
        if (s.course_id) courseIdSet.add(s.course_id);
      });
      (schedsSubRes.data || []).forEach((s: any) => {
        if (s.course_id) courseIdSet.add(s.course_id);
      });
      (ciRes.data || []).forEach((ci: any) => {
        if (ci.course_id) courseIdSet.add(ci.course_id);
      });
      (batchRes.data || []).forEach((b: any) => {
        if (b.course_id) courseIdSet.add(b.course_id);
      });
    } catch (err) {
      console.warn('Error querying instructor course IDs:', err);
    }

    // Strict Scope: If no assigned courses exist, return empty array.
    // Never expose unassigned or unrelated published courses to instructors.
    return Array.from(courseIdSet);
  })();

  instructorCourseIdsCache.set(instructorProfileId, {
    expiresAt: now + INSTRUCTOR_COURSE_IDS_TTL_MS,
    promise: fetchPromise,
  });

  return fetchPromise;
}

/**
 * Instructor Profile Data
 */
export async function getInstructorProfileData(profileId?: string) {
  const resolvedId = await resolveInstructorProfileId(profileId);

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', resolvedId)
    .single();

  if (profErr) throw profErr;

  let { data: instructor } = await supabaseAdmin
    .from('instructors')
    .select('*')
    .eq('profile_id', resolvedId)
    .maybeSingle();

  // If instructor specialization row doesn't exist yet, auto-create one
  if (!instructor) {
    const employeeId = `EMP-INS-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data: createdInstructor } = await supabaseAdmin
      .from('instructors')
      .insert({
        profile_id: resolvedId,
        instructor_number: employeeId,
        employment_status: 'ACTIVE',
        specialization: 'Maritime Simulator Instructor',
      })
      .select()
      .maybeSingle();
    instructor = createdInstructor;
  }

  return {
    id: profile.id,
    firstName: profile.first_name || 'Instructor',
    lastName: profile.last_name || '',
    email: profile.email || '',
    username: profile.username || profile.email?.split('@')[0] || 'instructor',
    phone: profile.phone || '',
    avatarUrl: profile.avatar_url || null,
    specialization: instructor?.specialization || 'Maritime Simulator Instructor',
    licenseNumber: instructor?.license_number || '',
    bio: instructor?.bio || '',
    employeeId: instructor?.instructor_number || instructor?.employee_id || 'EMP-INS-01',
    assignedCenterId: instructor?.training_center_id || profile.training_center_id || '',
    mfaEnabled: Boolean(profile.mfa_enabled && profile.mfa_secret),
    lastLoginAt: profile.updated_at || null,
    status: profile.status || 'ACTIVE',
    permissions: profile.permissions && profile.permissions.length > 0 ? profile.permissions : [
      'COURSE_VIEW_ASSIGNED',
      'TRAINEE_VIEW_ASSIGNED',
      'ASSESSMENT_VIEW_ASSIGNED',
      'ASSESSMENT_GRADE',
      'GRADE_VIEW',
      'GRADE_UPDATE',
      'ATTENDANCE_VIEW',
      'ATTENDANCE_CREATE',
      'PROGRESS_VIEW',
      'SCHEDULE_VIEW',
      'NOTIFICATION_VIEW',
      'PROFILE_VIEW',
      'PROFILE_UPDATE',
    ],
  };
}

/**
 * Update Instructor Profile Data
 */
export async function updateInstructorProfileData(
  profileId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    specialization?: string;
    avatarUrl?: string | null;
    bio?: string;
    licenseNumber?: string;
  }
) {
  const resolvedId = await resolveInstructorProfileId(profileId);

  const profilePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.firstName !== undefined) profilePayload.first_name = updates.firstName.trim();
  if (updates.lastName !== undefined) profilePayload.last_name = updates.lastName.trim();
  if (updates.phone !== undefined) profilePayload.phone = updates.phone.trim();
  if (updates.avatarUrl !== undefined) profilePayload.avatar_url = updates.avatarUrl;

  const { data: updatedProfile, error: profError } = await supabaseAdmin
    .from('profiles')
    .update(profilePayload)
    .eq('id', resolvedId)
    .select()
    .single();

  if (profError) throw profError;

  if (updates.specialization !== undefined || updates.bio !== undefined || updates.licenseNumber !== undefined) {
    const { data: existingInst } = await supabaseAdmin
      .from('instructors')
      .select('profile_id')
      .eq('profile_id', resolvedId)
      .maybeSingle();

    if (existingInst) {
      await supabaseAdmin
        .from('instructors')
        .update({
          ...(updates.specialization !== undefined ? { specialization: updates.specialization.trim() } : {}),
          ...(updates.bio !== undefined ? { bio: updates.bio.trim() } : {}),
          ...(updates.licenseNumber !== undefined ? { license_number: updates.licenseNumber.trim() } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', resolvedId);
    } else {
      await supabaseAdmin
        .from('instructors')
        .insert({
          profile_id: resolvedId,
          specialization: updates.specialization?.trim() || 'Maritime Simulator Instructor',
          bio: updates.bio?.trim() || '',
          license_number: updates.licenseNumber?.trim() || '',
          employment_status: 'ACTIVE',
        });
    }
  }

  return updatedProfile;
}

/**
 * Instructor Courses List
 */
export async function getInstructorCoursesList(
  profileId?: string,
  filters?: { search?: string; status?: string }
) {
  const resolvedId = await resolveInstructorProfileId(profileId);
  const courseIds = await getInstructorCourseIds(resolvedId);

  // If instructor has no course assignments, return empty array immediately
  if (courseIds.length === 0) {
    return [];
  }

  let query = supabaseAdmin.from('courses').select('*').in('id', courseIds);

  if (filters?.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  const { data: coursesData, error } = await query;
  if (error) throw error;

  let courses = coursesData || [];
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    courses = courses.filter((c: any) =>
      c.code?.toLowerCase().includes(s) ||
      c.name?.toLowerCase().includes(s) ||
      c.category?.toLowerCase().includes(s)
    );
  }

  if (courses.length === 0) {
    return [];
  }

  const filteredCourseIds = courses.map((c: any) => c.id).filter(Boolean);
  const centerIds = Array.from(new Set(courses.map((c: any) => c.training_center_id).filter(Boolean)));

  const [enrollmentsRes, modulesRes, centersRes] = await Promise.all([
    supabaseAdmin
      .from('enrollments')
      .select('course_id')
      .in('course_id', filteredCourseIds)
      .in('status', ['ENROLLED', 'COMPLETED', 'APPROVED', 'ACTIVE', 'ONGOING']),
    supabaseAdmin
      .from('course_modules')
      .select('course_id')
      .in('course_id', filteredCourseIds),
    centerIds.length > 0
      ? supabaseAdmin
          .from('training_centers')
          .select('id, name')
          .in('id', centerIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const enrolledCountByCourse = new Map<string, number>();
  (enrollmentsRes.data || []).forEach((e: any) => {
    enrolledCountByCourse.set(e.course_id, (enrolledCountByCourse.get(e.course_id) || 0) + 1);
  });

  const modulesCountByCourse = new Map<string, number>();
  (modulesRes.data || []).forEach((m: any) => {
    modulesCountByCourse.set(m.course_id, (modulesCountByCourse.get(m.course_id) || 0) + 1);
  });

  const centerNameById = new Map<string, string>();
  (centersRes.data || []).forEach((tc: any) => {
    if (tc.id && tc.name) centerNameById.set(tc.id, tc.name);
  });

  return courses.map((c: any) => {
    const centerName = (c.training_center_id && centerNameById.get(c.training_center_id)) || 'NEWSIM Talisay Training Center';
    const isFullModular = isInHouseModularCourse(c.category, c.practical_days);
    const durationHours = Number(c.duration_hours || 40);
    const rawDays = Math.max(1, Math.ceil(durationHours / 8));
    const theoryDays = isFullModular
      ? Math.min(3, rawDays)
      : Number(c.theory_days ?? (rawDays === 1 ? 1 : Math.max(1, Math.round(rawDays * 0.4))));
    const practicalDays = isFullModular
      ? 0
      : Number(c.practical_days ?? (rawDays === 1 ? 0 : Math.max(0, rawDays - theoryDays)));
    return {
      id: c.id,
      code: c.code || '',
      title: c.name || '',
      description: c.description || '',
      category: c.category || 'General Maritime',
      status: c.status || 'PUBLISHED',
      durationHours,
      trainingDays: isFullModular ? theoryDays : theoryDays + practicalDays,
      theoryDays,
      practicalDays,
      deliveryMode: isFullModular ? 'FULL_MODULAR' : 'MODULAR_AND_PRACTICAL',
      requiresPractical: !isFullModular,
      capacity: c.capacity || 24,
      price: c.price || 0,
      centerName,
      enrolledCount: enrolledCountByCourse.get(c.id) || 0,
      totalModules: modulesCountByCourse.get(c.id) || 0,
      prerequisites: c.prerequisites || [],
      lastUpdated: c.updated_at || c.created_at || new Date().toISOString(),
    };
  });
}

/**
 * Course Details with Syllabus Modules, Schedules, and Materials
 */
export async function getInstructorCourseDetails(courseId: string, profileId?: string) {
  const resolvedId = await resolveInstructorProfileId(profileId);
  const assignedCourseIds = await getInstructorCourseIds(resolvedId);
  if (!assignedCourseIds.includes(courseId)) {
    throw new Error('FORBIDDEN: Instructor is not assigned to this course.');
  }

  const { data: course, error: courseErr } = await supabaseAdmin
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (courseErr) throw courseErr;

  // Fetch modules ordered by sort_order
  const { data: modulesData } = await supabaseAdmin
    .from('course_modules')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });

  const modules = modulesData || [];
  const moduleIds = modules.map((m: any) => m.id);

  // Fetch materials for these modules
  let materials: any[] = [];
  if (moduleIds.length > 0) {
    const { data: mats } = await supabaseAdmin
      .from('learning_materials')
      .select('*')
      .in('module_id', moduleIds);
    materials = (mats || []).map((m: any) => {
      const parentMod = modules.find((mod: any) => mod.id === m.module_id);
      return {
        id: m.id,
        title: m.title,
        description: m.description || '',
        moduleName: parentMod?.title || 'General Module',
        fileType: m.material_type || m.file_type || 'PDF',
        fileSize: m.file_size || null,
        fileUrl: m.external_url || m.file_url || m.url || null,
      };
    });
  }

  // Fetch assessments for this course
  const { data: assessmentsData } = await supabaseAdmin
    .from('assessments')
    .select('*')
    .eq('course_id', courseId);

  // Fetch schedules for this course
  const { data: schedulesData } = await supabaseAdmin
    .from('schedules')
    .select('*')
    .eq('course_id', courseId);

  // Fetch enrolled count
  const { count: enrolledCount } = await supabaseAdmin
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .in('status', ['ENROLLED', 'ONGOING', 'COMPLETED', 'ACTIVE']);

  // Center name
  let centerName = 'NEWSIM Talisay Training Center';
  if (course.training_center_id) {
    const { data: tc } = await supabaseAdmin
      .from('training_centers')
      .select('name')
      .eq('id', course.training_center_id)
      .maybeSingle();
    if (tc?.name) centerName = tc.name;
  }

  const isFullModular = isInHouseModularCourse(course.category, course.practical_days);
  const durationHours = Number(course.duration_hours || 40);
  const rawDays = Math.max(1, Math.ceil(durationHours / 8));
  const theoryDays = isFullModular
    ? Math.min(3, rawDays)
    : Number(course.theory_days ?? (rawDays === 1 ? 1 : Math.max(1, Math.round(rawDays * 0.4))));
  const practicalDays = isFullModular
    ? 0
    : Number(course.practical_days ?? (rawDays === 1 ? 0 : Math.max(0, rawDays - theoryDays)));

  return {
    id: course.id,
    code: course.code || '',
    title: course.name || '',
    description: course.description || '',
    category: course.category || 'General Maritime',
    status: course.status || 'PUBLISHED',
    durationHours,
    trainingDays: isFullModular ? theoryDays : theoryDays + practicalDays,
    theoryDays,
    practicalDays,
    deliveryMode: isFullModular ? 'FULL_MODULAR' : 'MODULAR_AND_PRACTICAL',
    requiresPractical: !isFullModular,
    capacity: course.capacity || 24,
    centerName,
    enrolledCount: enrolledCount || 0,
    prerequisites: course.prerequisites || [],
    modules,
    materials,
    assessments: assessmentsData || [],
    schedules: isFullModular ? [] : (schedulesData || []),
  };
}

/**
 * Trainees List Assigned to Instructor Courses
 */
export async function getInstructorTraineesList(
  profileId?: string,
  filters?: { search?: string; status?: string }
) {
  const resolvedId = await resolveInstructorProfileId(profileId);
  const courseIds = await getInstructorCourseIds(resolvedId);

  // If instructor has no assigned courses, return empty trainee roster
  if (courseIds.length === 0) {
    return [];
  }

  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('trainee_id, course_id, status')
    .in('course_id', courseIds);

  const enrolledTraineeIds = Array.from(new Set((enrollments || []).map((e: any) => e.trainee_id)));

  if (enrolledTraineeIds.length === 0) {
    return [];
  }

  // Fetch profiles, trainee specialization records, and attendance records in parallel
  const [{ data: profiles }, { data: traineesData }, { data: attData }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, phone, status, avatar_url')
      .in('id', enrolledTraineeIds),
    supabaseAdmin
      .from('trainees')
      .select('profile_id, trainee_number, srn, gender, enrollment_status')
      .in('profile_id', enrolledTraineeIds),
    supabaseAdmin
      .from('attendance')
      .select('trainee_id, status')
      .in('trainee_id', enrolledTraineeIds)
      .in('course_id', courseIds),
  ]);

  const traineeMap = new Map<string, any>((traineesData || []).map((t: any) => [t.profile_id, t]));
  const attStatsMap = new Map<string, { present: number; total: number }>();
  (attData || []).forEach((a: any) => {
    if (!a.status || a.status === 'NOT_MARKED') return;
    const cur = attStatsMap.get(a.trainee_id) || { present: 0, total: 0 };
    cur.total++;
    if (['PRESENT', 'LATE', 'EXCUSED'].includes(String(a.status).toUpperCase())) {
      cur.present++;
    }
    attStatsMap.set(a.trainee_id, cur);
  });

  let result = (profiles || []).map((p: any) => {
    const t = traineeMap.get(p.id);
    const attStat = attStatsMap.get(p.id);
    const attendanceRate = attStat && attStat.total > 0
      ? `${Math.round((attStat.present / attStat.total) * 100)}%`
      : '0%';
    return {
      id: p.id,
      firstName: p.first_name || 'Trainee',
      lastName: p.last_name || '',
      email: p.email || '',
      avatarUrl: p.avatar_url || null,
      srn: t?.srn || t?.trainee_number || 'Not Set',
      rank: t?.gender || 'Maritime Cadet',
      vesselType: 'Commercial Vessel',
      attendanceRate,
      status: t?.enrollment_status || p.status || 'ACTIVE',
    };
  });

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (t: any) =>
        t.firstName.toLowerCase().includes(s) ||
        t.lastName.toLowerCase().includes(s) ||
        t.email.toLowerCase().includes(s) ||
        t.srn.toLowerCase().includes(s) ||
        t.rank.toLowerCase().includes(s)
    );
  }

  if (filters?.status && filters.status !== 'ALL') {
    result = result.filter((t: any) => t.status === filters.status);
  }

  return result;
}

/**
 * Trainee Detailed Profile (Tabs: Profile, Progress, Assessments, Attendance)
 */
export async function getInstructorTraineeDetails(traineeId: string, profileId?: string) {
  const resolvedId = await resolveInstructorProfileId(profileId);
  const assignedCourseIds = await getInstructorCourseIds(resolvedId);

  if (assignedCourseIds.length === 0) {
    throw new Error('FORBIDDEN: Instructor has no assigned courses.');
  }

  // Verify trainee has at least one enrollment in this instructor's assigned courses
  const { data: rawEnrollments } = await supabaseAdmin
    .from('enrollments')
    .select('id, course_id, status, created_at, enrolled_at, completed_at')
    .eq('trainee_id', traineeId)
    .in('course_id', assignedCourseIds);

  if (!rawEnrollments || rawEnrollments.length === 0) {
    throw new Error('FORBIDDEN: Trainee is not enrolled in any of your assigned courses.');
  }

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', traineeId)
    .single();

  if (profErr) throw profErr;

  const { data: trainee } = await supabaseAdmin
    .from('trainees')
    .select('*')
    .eq('profile_id', traineeId)
    .maybeSingle();

  const enrollments = (rawEnrollments || []).map((e: any) => ({
    ...e,
    applied_at: e.enrolled_at || e.created_at,
  }));

  // Assessments submissions / attempts scoped strictly to instructor's assigned courses
  const { data: courseAssessments } = await supabaseAdmin
    .from('assessments')
    .select('id, course_id, title, assessment_type, module_id, passing_score')
    .in('course_id', assignedCourseIds);

  const assessmentsMap = new Map<string, any>((courseAssessments || []).map((a: any) => [a.id, a]));
  const scopedAssessmentIds = Array.from(assessmentsMap.keys());

  let attempts: any[] = [];
  if (scopedAssessmentIds.length > 0) {
    const { data: attRows } = await supabaseAdmin
      .from('assessment_attempts')
      .select('id, assessment_id, score, status, submitted_at')
      .eq('trainee_id', traineeId)
      .in('assessment_id', scopedAssessmentIds);
    attempts = attRows || [];
  }

  const submissions = attempts.map((att: any) => {
    const asm = assessmentsMap.get(att.assessment_id);
    const isModular = Boolean(asm?.module_id);
    return {
      id: att.id,
      assessmentId: att.assessment_id,
      assessmentTitle: asm?.title || 'Maritime Assessment',
      assessmentCode: isModular ? 'MOD-QUIZ' : 'PRAC-SIM',
      score: att.score || 0,
      maxScore: 100,
      status: att.status || 'SUBMITTED',
      submittedAt: att.submitted_at || new Date().toISOString(),
    };
  });

  // Attendance records scoped strictly to instructor's assigned courses
  const { data: attendanceData } = await supabaseAdmin
    .from('attendance')
    .select('id, schedule_id, course_id, batch_id, session_date, status, check_in_at, remarks')
    .eq('trainee_id', traineeId)
    .in('course_id', assignedCourseIds);

  const scheduleIds = Array.from(new Set((attendanceData || []).map((a: any) => a.schedule_id).filter(Boolean)));
  let schedulesMap = new Map();
  if (scheduleIds.length > 0) {
    const { data: scheds } = await supabaseAdmin
      .from('schedules')
      .select('id, course_id, room, start_at')
      .in('id', scheduleIds);
    schedulesMap = new Map((scheds || []).map((s: any) => [s.id, s]));
  }

  const attendance = (attendanceData || []).map((att: any) => {
    const sch = schedulesMap.get(att.schedule_id);
    return {
      id: att.id,
      sessionCode: `SES-${String(sch?.id || att.batch_id || att.id || '001').slice(0, 8).toUpperCase()}`,
      room: sch?.room || 'Classroom Alpha',
      status: att.status || 'PRESENT',
      date: att.session_date || (att.check_in_at ? att.check_in_at.split('T')[0] : new Date().toISOString().split('T')[0]),
      remarks: att.remarks || '',
    };
  });

  // Progress summary
  const totalSubmissions = submissions.length;
  const passedSubmissions = submissions.filter((s: any) => s.status === 'PASSED').length;
  const averageScore =
    totalSubmissions > 0
      ? Math.round(submissions.reduce((acc: number, s: any) => acc + s.score, 0) / totalSubmissions)
      : 0;

  return {
    id: profile.id,
    firstName: profile.first_name || 'Trainee',
    lastName: profile.last_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    avatarUrl: profile.avatar_url || null,
    srn: trainee?.srn || trainee?.trainee_number || 'Not Set',
    rank: trainee?.gender || 'Maritime Cadet',
    vesselType: 'Commercial Vessel',
    status: trainee?.enrollment_status || profile.status || 'ACTIVE',
    enrollments: enrollments || [],
    submissions,
    attendance,
    progress: {
      traineeId: profile.id,
      progressPercent: totalSubmissions > 0 ? Math.min(100, Math.round((passedSubmissions / totalSubmissions) * 100)) : 0,
      averageGrade: averageScore,
      attendanceRate: attendance.length > 0 ? `${Math.round((attendance.filter((a: any) => ['PRESENT', 'LATE', 'EXCUSED'].includes(String(a.status).toUpperCase())).length / attendance.length) * 100)}%` : '0%',
      status: totalSubmissions === 0 || averageScore >= 75 ? 'ON_TRACK' : 'AT_RISK',
    },
  };
}

/**
 * Assessments List
 */
export async function getInstructorAssessmentsList(
  profileId?: string,
  filters?: { search?: string; type?: string; courseId?: string }
) {
  const resolvedId = await resolveInstructorProfileId(profileId);
  const courseIds = await getInstructorCourseIds(resolvedId);
  if (courseIds.length === 0) return [];

  const targetCourseIds =
    filters?.courseId && filters.courseId !== 'ALL'
      ? courseIds.filter((cid) => cid === filters.courseId)
      : courseIds;
  if (targetCourseIds.length === 0) return [];

  let query = supabaseAdmin
    .from('assessments')
    .select(`
      id,
      title,
      description,
      assessment_type,
      module_id,
      passing_score,
      duration_minutes,
      course_id,
      courses ( id, name, code, category, practical_days ),
      course_modules ( id, title, sort_order )
    `)
    .in('course_id', targetCourseIds);

  if (filters?.type && filters.type !== 'ALL') {
    if (filters.type === 'MODULAR') {
      // Handled post-query so Full Modular post-tests are included under MODULAR
    } else if (filters.type === 'PRACTICAL') {
      query = query.is('module_id', null);
    } else {
      query = query.eq('assessment_type', filters.type);
    }
  }

  const { data: assessmentsData, error } = await query;
  if (error) throw error;

  let assessments = assessmentsData || [];

  // Calculate statistics for each assessment from assessment_attempts in a single bulk query
  const assessmentIds = assessments.map((a: any) => a.id).filter(Boolean);
  const attemptsByAssessmentId = new Map<string, any[]>();
  if (assessmentIds.length > 0) {
    const { data: allAttempts } = await supabaseAdmin
      .from('assessment_attempts')
      .select('id, assessment_id, score, status, passed, submitted_at')
      .in('assessment_id', assessmentIds);

    (allAttempts || []).forEach((att: any) => {
      if (Number(att.score) === 0 && att.status === 'FAILED' && String(att.submitted_at || '').includes('59:59')) {
        return;
      }
      const list = attemptsByAssessmentId.get(att.assessment_id) || [];
      list.push(att);
      attemptsByAssessmentId.set(att.assessment_id, list);
    });
  }

  const enriched = assessments.map((a: any) => {
    const attemptsList = attemptsByAssessmentId.get(a.id) || [];
    const submissionsCount = attemptsList.length;
    const passingThreshold = Number(a.passing_score) || 75;
    const passedCount = attemptsList.filter((att: any) => att.passed === true || att.status === 'PASSED' || (Number(att.score) >= passingThreshold)).length;
    const scores = attemptsList.map((att: any) => Number(att.score) || 0);
    const avgScore = submissionsCount > 0 ? Math.round(scores.reduce((acc: number, val: number) => acc + val, 0) / submissionsCount) : 0;
    const highestScore = submissionsCount > 0 ? Math.max(...scores) : 0;
    const lowestScore = submissionsCount > 0 ? Math.min(...scores) : 0;

    const isCourseFullModular = isInHouseModularCourse(a.courses?.category, a.courses?.practical_days);
    const isModuleQuiz = Boolean(a.module_id);
    const isModular = isModuleQuiz || isCourseFullModular;
    const modOrder = (a.course_modules as any)?.sort_order;
    const code = isModuleQuiz
      ? `MOD-${modOrder ?? (a.title.match(/Module\s*(\d+)/i)?.[1] || 'PRE')}`
      : isCourseFullModular
      ? 'MOD-POST'
      : 'PRAC-POST';

    return {
      id: a.id,
      code,
      title: a.title || (isModuleQuiz ? 'Module Competency Pre-Test' : isCourseFullModular ? 'Course Modular Post-Test' : 'Course Practical Evaluation'),
      category: isModular ? 'MODULAR' : 'PRACTICAL',
      type: isModular ? 'MODULAR_THEORY' : (a.assessment_type || 'PRACTICAL_SIMULATOR'),
      isFullModular: isCourseFullModular,
      requiresPractical: !isCourseFullModular,
      courseId: a.course_id,
      courseCode: a.courses?.code || 'STCW',
      courseTitle: a.courses?.name || 'Maritime Course',
      totalPoints: 100,
      totalQuestions: 10,
      passingScore: passingThreshold,
      durationMinutes: a.duration_minutes || 45,
      submissionsCount,
      passedCount,
      averageScore: avgScore,
      highestScore,
      lowestScore,
    };
  });

  let result = enriched;
  if (filters?.type && filters.type !== 'ALL') {
    if (filters.type === 'MODULAR') {
      result = result.filter((a: any) => a.category === 'MODULAR');
    } else if (filters.type === 'PRACTICAL') {
      result = result.filter((a: any) => a.category === 'PRACTICAL');
    }
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (a: any) =>
        a.code.toLowerCase().includes(s) ||
        a.title.toLowerCase().includes(s) ||
        a.courseTitle.toLowerCase().includes(s)
    );
  }

  return result;
}

/**
 * Assessment Submissions List
 */
export async function getInstructorAssessmentSubmissions(assessmentId: string, profileId?: string) {
  const resolvedId = await resolveInstructorProfileId(profileId);
  const assignedCourseIds = await getInstructorCourseIds(resolvedId);

  // Assessment details for course authorization & passingScore
  const { data: asm } = await supabaseAdmin
    .from('assessments')
    .select('id, course_id, passing_score, assessment_questions(id)')
    .eq('id', assessmentId)
    .maybeSingle();

  if (!asm) {
    return [];
  }
  if (!assignedCourseIds.includes(asm.course_id)) {
    throw new Error('FORBIDDEN: You are not assigned to instruct this assessment course.');
  }

  const { data: attempts, error } = await supabaseAdmin
    .from('assessment_attempts')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('submitted_at', { ascending: false });

  if (error) throw error;

  const attemptsList = (attempts || []).filter(
    (att: any) =>
      !(Number(att.score) === 0 && att.status === 'FAILED' && String(att.submitted_at || '').includes('59:59'))
  );
  const totalQuestions = Array.isArray((asm as any).assessment_questions)
    ? (asm as any).assessment_questions.length || 10
    : 10;
  const traineeIds = Array.from(new Set(attemptsList.map((att: any) => att.trainee_id)));

  let profilesMap = new Map<string, any>();
  let traineesMap = new Map();

  if (traineeIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, srn, avatar_url')
      .in('id', traineeIds);
    profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const { data: trainees } = await supabaseAdmin
      .from('trainees')
      .select('profile_id, srn, trainee_number')
      .in('profile_id', traineeIds);
    traineesMap = new Map((trainees || []).map((t: any) => [t.profile_id, t.srn || t.trainee_number || '']));
  }

  const passingThreshold = Number(asm?.passing_score) || 75;

  return attemptsList.map((att: any) => {
    const score = Number(att.score) || 0;
    const correctCount = Math.round((score * totalQuestions) / 100);
    const isPassed = att.passed === true || att.status === 'PASSED' || score >= passingThreshold;
    const prof = profilesMap.get(att.trainee_id);
    const traineeName = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : '';
    return {
      id: att.id,
      traineeId: att.trainee_id,
      traineeName: traineeName || 'Trainee Seafarer',
      traineeAvatarUrl: prof?.avatar_url || null,
      traineeSrn: traineesMap.get(att.trainee_id) || '',
      score,
      correctCount,
      totalQuestions,
      scoreDisplay: `${correctCount}/${totalQuestions} (${score}%)`,
      maxScore: 100,
      status: isPassed ? 'PASSED' : 'FAILED',
      result: isPassed ? 'PASSED' : 'FAILED',
      submittedAt: att.submitted_at ? new Date(att.submitted_at).toLocaleDateString() : 'Recent',
    };
  });
}

/**
 * Gradebook Matrix Data for a Course with Modular vs Practical Differentiation
 */
export async function getInstructorGradebookData(courseId: string, profileId?: string) {
  if (!courseId) {
    return { gradebook: [], assessments: [], modularAssessments: [], practicalAssessments: [], summary: {} };
  }

  // Instructor Course Assignment Scope Check
  if (profileId) {
    const resolvedId = await resolveInstructorProfileId(profileId);
    const assignedCourseIds = await getInstructorCourseIds(resolvedId);
    if (!assignedCourseIds.includes(courseId)) {
      return { gradebook: [], assessments: [], modularAssessments: [], practicalAssessments: [], summary: {}, error: 'UNAUTHORIZED_COURSE' };
    }
  }

  // Fetch course info and assessments for this course with module info
  const [{ data: courseRow }, { data: assessmentsData, error: asmError }] = await Promise.all([
    supabaseAdmin
      .from('courses')
      .select('id, code, name, category, practical_days')
      .eq('id', courseId)
      .maybeSingle(),
    supabaseAdmin
      .from('assessments')
      .select(`
        id,
        title,
        assessment_type,
        module_id,
        passing_score,
        course_modules ( id, title, sort_order )
      `)
      .eq('course_id', courseId),
  ]);

  if (asmError) throw asmError;

  const isCourseFullModular = isInHouseModularCourse(courseRow?.category, courseRow?.practical_days);

  const assessments = (assessmentsData || [])
    .map((a: any) => {
      const isModuleQuiz = Boolean(a.module_id);
      const isModular = isModuleQuiz || isCourseFullModular;
      const modOrder = (a.course_modules as any)?.sort_order;
      const code = isModuleQuiz
        ? `MOD-${modOrder ?? (a.title.match(/Module\s*(\d+)/i)?.[1] || 'PRE')}`
        : isCourseFullModular
        ? 'MOD-POST'
        : (a.title.toLowerCase().includes('post') ? 'PRAC-POST' : 'PRAC-SIM');

      return {
        id: a.id,
        code,
        title: a.title,
        category: isModular ? 'MODULAR' : 'PRACTICAL',
        type: isModular ? 'MODULAR_THEORY' : 'PRACTICAL_SIMULATOR',
        totalPoints: 100,
        totalQuestions: 10,
        passingScore: Number(a.passing_score) || 75,
        sortOrder: isModuleQuiz ? (modOrder ?? 1) : 999,
      };
    })
    .sort((x: any, y: any) => {
      if (x.category !== y.category) return x.category === 'MODULAR' ? -1 : 1;
      return x.sortOrder - y.sortOrder || x.title.localeCompare(y.title);
    });

  const modularAssessments = assessments.filter((a: any) => a.category === 'MODULAR');
  const practicalAssessments = isCourseFullModular
    ? []
    : assessments.filter((a: any) => a.category === 'PRACTICAL');

  // Fetch enrolled trainees for this course
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('trainee_id, status')
    .eq('course_id', courseId)
    .not('status', 'in', '("CANCELLED","REJECTED")');

  const traineeIds = Array.from(new Set((enrollments || []).map((e: any) => e.trainee_id).filter(Boolean)));

  // Also query attempts for all assessments in this course to guarantee ANY trainee who answered is in the roster
  const asmIds = assessments.map((a: any) => a.id);
  let attempts: any[] = [];
  if (asmIds.length > 0) {
    const { data: atts } = await supabaseAdmin
      .from('assessment_attempts')
      .select('*')
      .in('assessment_id', asmIds);
    attempts = atts || [];
    attempts.forEach((att: any) => {
      if (att.trainee_id && !traineeIds.includes(att.trainee_id)) {
        traineeIds.push(att.trainee_id);
      }
    });
  }

  if (traineeIds.length === 0) {
    return { gradebook: [], assessments, modularAssessments, practicalAssessments, summary: {} };
  }

  // Fetch trainee profiles
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', traineeIds);

  const { data: traineesData } = await supabaseAdmin
    .from('trainees')
    .select('profile_id, trainee_number, gender')
    .in('profile_id', traineeIds);

  // Also fetch practical_evaluations and course grades for this course to unify Rubric Evaluations & Attendance with the Gradebook
  const [{ data: practicalEvalsData }, { data: courseGradesData }] = await Promise.all([
    supabaseAdmin
      .from('practical_evaluations')
      .select('id, rubric_id, trainee_id, percentage, competency_status, status, general_feedback, updated_at, practical_rubrics(title, passing_score)')
      .eq('course_id', courseId)
      .in('trainee_id', traineeIds),
    supabaseAdmin
      .from('grades')
      .select('trainee_id, final_score, attendance_score, practical_score, module_score, status, breakdown')
      .eq('course_id', courseId)
      .in('trainee_id', traineeIds),
  ]);

  const practicalEvalMap = new Map<string, any>((practicalEvalsData || []).map((pe: any) => [pe.trainee_id, pe]));
  const courseGradeMap = new Map<string, any>((courseGradesData || []).map((cg: any) => [cg.trainee_id, cg]));

  // If no practical assessment exists in assessments table but a practical rubric evaluation exists, add a virtual practical column (only for Modular + Practical courses)
  if (!isCourseFullModular && practicalAssessments.length === 0 && (practicalEvalsData || []).length > 0) {
    const firstPe = (practicalEvalsData || [])[0] as any;
    const rub = firstPe?.practical_rubrics;
    const rubricCol = {
      id: firstPe.rubric_id || `rubric-${courseId}`,
      code: 'PRAC-RUB',
      title: rub?.title || 'Practical Rubric Evaluation',
      category: 'PRACTICAL',
      type: 'PRACTICAL_SIMULATOR',
      totalPoints: 100,
      passingScore: Number(rub?.passing_score) || 75,
      sortOrder: 999,
    };
    assessments.push(rubricCol);
    practicalAssessments.push(rubricCol);
  }

  const traineeMetaMap = new Map<string, any>((traineesData || []).map((t: any) => [t.profile_id, t]));

  // Assemble gradebook rows with separate modular and practical calculations
  const gradebook = (profiles || []).map((p: any) => {
    const meta = traineeMetaMap.get(p.id);
    const traineeAttempts = attempts.filter((att: any) => att.trainee_id === p.id);
    const pe = practicalEvalMap.get(p.id);
    const cg = courseGradeMap.get(p.id);

    const grades: Record<string, any> = {};
    const modularGrades: Record<string, any> = {};
    const practicalGrades: Record<string, any> = {};

    let modularTotal = 0;
    let modularCount = 0;
    let practicalTotal = 0;
    let practicalCount = 0;
    let overallTotal = 0;
    let overallCount = 0;

    assessments.forEach((asm: any) => {
      // Find latest attempt for this assessment
      const matchingAtts = traineeAttempts.filter((a: any) => a.assessment_id === asm.id);
      const att = matchingAtts.length > 0 ? matchingAtts[matchingAtts.length - 1] : null;

      if (att) {
        const score = Number(att.score) || 0;
        const result = att.passed === true || att.status === 'PASSED' || score >= asm.passingScore ? 'PASSED' : 'FAILED';
        const cellData = {
          submissionId: att.id,
          score,
          maxScore: asm.totalPoints,
          result,
          category: asm.category,
          submittedAt: att.submitted_at,
          feedback: '',
        };

        grades[asm.id] = cellData;
        overallTotal += score;
        overallCount++;

        if (asm.category === 'MODULAR') {
          modularGrades[asm.id] = cellData;
          modularTotal += score;
          modularCount++;
        } else {
          practicalGrades[asm.id] = cellData;
          practicalTotal += score;
          practicalCount++;
        }
      } else if (asm.category === 'PRACTICAL' && pe && practicalCount === 0) {
        // Connect Practical Rubric Evaluation into the practical column if no assessment_attempt row exists
        const score = Math.round(Number(pe.percentage) || 0);
        const result = pe.competency_status === 'COMPETENT' && score >= asm.passingScore ? 'PASSED' : 'FAILED';
        const cellData = {
          submissionId: pe.id,
          score,
          maxScore: 100,
          result,
          category: 'PRACTICAL',
          submittedAt: pe.updated_at,
          feedback: pe.general_feedback || '',
        };

        grades[asm.id] = cellData;
        practicalGrades[asm.id] = cellData;
        practicalTotal += score;
        practicalCount++;
        overallTotal += score;
        overallCount++;
      }
    });

    // If practical rubric evaluation exists and overrides or supplements practical average
    if (pe && practicalCount === 0) {
      practicalTotal = Math.round(Number(pe.percentage) || 0);
      practicalCount = 1;
    }

    const modularAverage = modularCount > 0 ? Math.round(modularTotal / modularCount) : (cg?.module_score != null ? Math.round(Number(cg.module_score)) : 0);
    const practicalAverage = practicalCount > 0 ? Math.round(practicalTotal / practicalCount) : (cg?.practical_score != null ? Math.round(Number(cg.practical_score)) : 0);
    const averageGrade = cg?.final_score != null
      ? Math.round(Number(cg.final_score))
      : (overallCount > 0 ? Math.round(overallTotal / overallCount) : 0);

    const modularPassed = modularCount > 0 && modularAverage >= 75;
    const practicalPassed = pe
      ? pe.competency_status === 'COMPETENT'
      : (practicalCount > 0 && practicalAverage >= 75);

    let finalStatus = 'IN_PROGRESS';
    if (cg?.status && ['PASSED', 'FAILED', 'NEEDS_REMEDIATION'].includes(cg.status)) {
      finalStatus = cg.status === 'NEEDS_REMEDIATION' ? 'NEEDS_REMEDIAL' : cg.status;
    } else if (overallCount > 0 || pe) {
      if (modularPassed && (practicalCount === 0 || practicalPassed)) {
        finalStatus = 'PASSED';
      } else if (!modularPassed && modularCount > 0) {
        finalStatus = 'NEEDS_REMEDIAL';
      } else if (!practicalPassed && (practicalCount > 0 || pe)) {
        finalStatus = 'NEEDS_REMEDIAL';
      }
    }

    return {
      traineeId: p.id,
      traineeName: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Trainee',
      traineeAvatarUrl: p.avatar_url || null,
      srn: meta?.trainee_number || 'SRN-2026-0000',
      rank: meta?.gender || 'Maritime Cadet',
      grades,
      modularGrades,
      practicalGrades,
      modularAverage,
      practicalAverage,
      attendanceScore: cg?.attendance_score != null ? Math.round(Number(cg.attendance_score)) : null,
      averageGrade,
      modularCount,
      practicalCount,
      modularPassed,
      practicalPassed,
      finalStatus,
    };
  });

  // Calculate class summary telemetry
  let totalModScore = 0;
  let traineesWithMod = 0;
  let totalPracScore = 0;
  let traineesWithPrac = 0;

  gradebook.forEach((g: any) => {
    if (g.modularCount > 0) {
      totalModScore += g.modularAverage;
      traineesWithMod++;
    }
    if (g.practicalCount > 0) {
      totalPracScore += g.practicalAverage;
      traineesWithPrac++;
    }
  });

  const summary = {
    classModularAverage: traineesWithMod > 0 ? Math.round(totalModScore / traineesWithMod) : 0,
    classPracticalAverage: traineesWithPrac > 0 ? Math.round(totalPracScore / traineesWithPrac) : 0,
    totalModularAssessments: modularAssessments.length,
    totalPracticalAssessments: practicalAssessments.length,
    totalTrainees: gradebook.length,
    qualifiedCount: gradebook.filter((g: any) => g.finalStatus === 'PASSED').length,
  };

  return {
    gradebook,
    assessments,
    modularAssessments,
    practicalAssessments,
    summary,
  };
}

/**
 * Update Trainee Submission Grade
 */
export async function updateInstructorGrade(
  submissionId: string,
  score: number,
  feedback?: string,
  reason?: string,
  instructorName?: string,
  instructorId?: string,
  traineeId?: string,
  assessmentId?: string
) {
  const resolvedInstructorId = await resolveInstructorProfileId(instructorId);
  const assignedCourseIds = await getInstructorCourseIds(resolvedInstructorId);

  // Check if submissionId is an existing UUID in assessment_attempts
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let attempt: any = null;
  if (isUUID.test(submissionId)) {
    const { data } = await supabaseAdmin
      .from('assessment_attempts')
      .select('*, assessments(*)')
      .eq('id', submissionId)
      .maybeSingle();
    attempt = data;
  }

  const targetCourseId = attempt?.assessments?.course_id;
  if (targetCourseId && !assignedCourseIds.includes(targetCourseId)) {
    throw new Error('FORBIDDEN: Instructor is not assigned to grade this course.');
  }

  // If not found by submissionId, resolve by traineeId and assessmentId
  if (!attempt && traineeId && assessmentId) {
    const { data: asm } = await supabaseAdmin
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .maybeSingle();

    if (!asm || !assignedCourseIds.includes(asm.course_id)) {
      throw new Error('FORBIDDEN: Instructor is not assigned to grade this assessment course.');
    }

    const { data: activeEnr } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('trainee_id', traineeId)
      .eq('course_id', asm.course_id)
      .in('status', ['ENROLLED', 'ONGOING', 'COMPLETED', 'ACTIVE', 'APPROVED'])
      .limit(1)
      .maybeSingle();

    if (!activeEnr) {
      throw new Error('FORBIDDEN: Trainee does not have an active enrollment in this course.');
    }

    const { data: existing } = await supabaseAdmin
      .from('assessment_attempts')
      .select('*, assessments(*)')
      .eq('assessment_id', assessmentId)
      .eq('trainee_id', traineeId)
      .maybeSingle();

    if (existing) {
      attempt = existing;
    } else {
      const passThreshold = Number(asm?.passing_score) || 75;
      const passStatus = score >= passThreshold ? 'PASSED' : 'FAILED';

      const { data: createdAttempt, error: insertErr } = await supabaseAdmin
        .from('assessment_attempts')
        .insert({
          assessment_id: assessmentId,
          trainee_id: traineeId,
          score,
          status: passStatus,
          passed: passStatus === 'PASSED',
          attempt_number: 1,
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
        })
        .select('*, assessments(*)')
        .single();

      if (!insertErr && createdAttempt) {
        attempt = createdAttempt;
      }
    }
  }

  const passingScore = Number(attempt?.assessments?.passing_score) || 75;
  const status = score >= passingScore ? 'PASSED' : 'FAILED';

  if (attempt) {
    const { data: updated, error } = await supabaseAdmin
      .from('assessment_attempts')
      .update({
        score,
        status,
        passed: status === 'PASSED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', attempt.id)
      .select()
      .single();

    if (error) throw error;

    // Sync into grades table via weighted course grade engine for full consistency
    if (attempt.assessments?.course_id) {
      try {
        await calculateTraineeCourseGrade({
          traineeId: attempt.trainee_id,
          courseId: attempt.assessments.course_id,
        });
      } catch (gradeSyncErr) {
        console.warn('Could not sync grade row:', gradeSyncErr);
      }
    }

    // Log to audit_logs
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: instructorId && isUUID.test(instructorId) ? instructorId : null,
        action: 'GRADE_UPDATED',
        entity_type: 'ASSESSMENT',
        entity_id: attempt.id,
        new_values: { score, status, feedback, reason, instructorName },
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('Could not record audit log:', auditErr);
    }

    // Dispatch ASSESSMENT_GRADED notification (Section 11 Recipient Matrix)
    try {
      await dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.ASSESSMENT_GRADED,
        traineeId: attempt.trainee_id,
        courseId: attempt.assessments?.course_id,
        entityType: 'ASSESSMENT',
        entityId: attempt.id,
        metadata: {
          courseName: attempt.assessments?.title,
          score,
          passed: status === 'PASSED',
        },
      });
    } catch (notifErr) {
      console.warn('Grade update notification dispatch notice:', notifErr);
    }

    return updated;
  }

  // If not found in database (e.g. synthetic ID), return simulated response to avoid breaking UI
  return {
    id: submissionId,
    score,
    status,
    feedback,
  };
}

/**
 * Attendance Records History
 */
export async function getInstructorAttendanceRecords(
  profileId?: string,
  filters?: { search?: string; status?: string }
) {
  const resolvedId = await resolveInstructorProfileId(profileId);
  const instructorCourseIds = await getInstructorCourseIds(resolvedId);

  // Find schedules for this instructor (or covered as substitute) or courses taught by instructor
  let schedQuery = supabaseAdmin
    .from('schedules')
    .select('id, course_id, room, start_at');

  if (instructorCourseIds.length > 0) {
    schedQuery = schedQuery.or(`instructor_id.eq.${resolvedId},substitute_instructor_id.eq.${resolvedId},course_id.in.(${instructorCourseIds.join(',')})`);
  } else {
    schedQuery = schedQuery.or(`instructor_id.eq.${resolvedId},substitute_instructor_id.eq.${resolvedId}`);
  }

  const { data: scheds } = await schedQuery;
  const schedIds = (scheds || []).map((s: any) => s.id);

  let query = supabaseAdmin.from('attendance').select('*').order('created_at', { ascending: false });

  if (schedIds.length > 0 && instructorCourseIds.length > 0) {
    query = query.or(`schedule_id.in.(${schedIds.join(',')}),course_id.in.(${instructorCourseIds.join(',')})`);
  } else if (schedIds.length > 0) {
    query = query.in('schedule_id', schedIds);
  } else if (instructorCourseIds.length > 0) {
    query = query.in('course_id', instructorCourseIds);
  } else {
    return [];
  }

  const { data: attendanceData, error } = await query;
  if (error) throw error;

  const records = attendanceData || [];
  const traineeIds = Array.from(new Set(records.map((r: any) => r.trainee_id).filter(Boolean)));
  const allSchedIds = Array.from(new Set(records.map((r: any) => r.schedule_id).filter(Boolean)));
  const allCourseIds = Array.from(new Set(records.map((r: any) => r.course_id).filter(Boolean)));

  let profilesMap = new Map<string, any>();
  if (traineeIds.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', traineeIds);
    profilesMap = new Map((profs || []).map((p: any) => [p.id, p]));
  }

  let schedsMap = new Map();
  if (allSchedIds.length > 0) {
    const { data: allS } = await supabaseAdmin
      .from('schedules')
      .select('id, course_id, room, start_at, courses(name)')
      .in('id', allSchedIds);
    schedsMap = new Map((allS || []).map((s: any) => [s.id, s]));
  }

  let coursesMap = new Map();
  if (allCourseIds.length > 0) {
    const { data: allC } = await supabaseAdmin
      .from('courses')
      .select('id, name')
      .in('id', allCourseIds);
    coursesMap = new Map((allC || []).map((c: any) => [c.id, c.name]));
  }

  let result = records.map((r: any) => {
    const sch = schedsMap.get(r.schedule_id);
    const directCourseName = r.course_id ? coursesMap.get(r.course_id) : null;
    const dateStr = r.session_date
      ? r.session_date
      : (r.check_in_at
        ? r.check_in_at.split('T')[0]
        : (r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0]));
    const prof = profilesMap.get(r.trainee_id);
    const tName = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : '';
    return {
      id: r.id,
      scheduleId: r.schedule_id,
      sessionCode: `SES-${String(sch?.id || r.batch_id || r.id || '001').slice(0, 8).toUpperCase()}`,
      courseTitle: (sch as any)?.courses?.name || directCourseName || 'Maritime Training Program',
      traineeId: r.trainee_id,
      traineeName: tName || 'Trainee Seafarer',
      traineeAvatarUrl: prof?.avatar_url || null,
      status: r.status || 'PRESENT',
      date: dateStr,
      remarks: r.remarks || '',
    };
  });

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (r: any) =>
        r.traineeName.toLowerCase().includes(s) ||
        r.courseTitle.toLowerCase().includes(s) ||
        r.sessionCode.toLowerCase().includes(s)
    );
  }

  if (filters?.status && filters.status !== 'ALL') {
    result = result.filter((r: any) => r.status === filters.status);
  }

  return result;
}

/**
 * Fetch recorded attendance for a specific session schedule
 */
export async function getInstructorAttendanceForSession(scheduleId: string, profileId?: string) {
  if (!scheduleId) return [];
  if (profileId) {
    const resolvedId = await resolveInstructorProfileId(profileId);
    const { data: sched } = await supabaseAdmin
      .from('schedules')
      .select('course_id, instructor_id, substitute_instructor_id')
      .eq('id', scheduleId)
      .maybeSingle();
    if (sched) {
      const assignedCourseIds = await getInstructorCourseIds(resolvedId);
      const ownsSchedule =
        sched.instructor_id === resolvedId ||
        sched.substitute_instructor_id === resolvedId ||
        (sched.course_id ? assignedCourseIds.includes(sched.course_id) : false);
      if (!ownsSchedule) {
        throw new Error('FORBIDDEN: Instructor is not assigned to this schedule.');
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select('id, trainee_id, status, remarks, check_in_at')
    .eq('schedule_id', scheduleId);

  if (error) {
    console.warn('Error fetching attendance for session:', error);
    return [];
  }
  return data || [];
}

/**
 * Record Roll-call Attendance (Upserts records to prevent duplicates)
 */
export async function recordInstructorAttendance(
  date: string,
  sessionCode: string,
  courseId: string,
  records: Array<{ traineeId: string; status: string; remarks?: string }>,
  instructorId: string
) {
  const resolvedInstructorId = await resolveInstructorProfileId(instructorId);
  const assignedCourseIds = await getInstructorCourseIds(resolvedInstructorId);
  if (!assignedCourseIds.includes(courseId)) {
    throw new Error('FORBIDDEN: Instructor is not assigned to record attendance for this course.');
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // 1. Find or create schedule for this assigned course
  let scheduleId: string | null = null;

  if (sessionCode && isUUID.test(sessionCode)) {
    const { data: byId } = await supabaseAdmin
      .from('schedules')
      .select('id, course_id')
      .eq('id', sessionCode)
      .eq('course_id', courseId)
      .maybeSingle();
    if (byId?.id) scheduleId = byId.id;
  }

  if (!scheduleId && sessionCode) {
    const cleanPrefix = sessionCode.replace(/^SES-/i, '');
    const { data: courseScheds } = await supabaseAdmin
      .from('schedules')
      .select('id')
      .eq('course_id', courseId)
      .limit(100);
    const found = (courseScheds || []).find((s: any) => s.id.toLowerCase().startsWith(cleanPrefix.toLowerCase()));
    if (found?.id) scheduleId = found.id;
  }

  // Match by course and instructor (or substitute)
  if (!scheduleId && courseId) {
    const { data: existingSchedule } = await supabaseAdmin
      .from('schedules')
      .select('id')
      .eq('course_id', courseId)
      .or(`instructor_id.eq.${resolvedInstructorId},substitute_instructor_id.eq.${resolvedInstructorId}`)
      .limit(1)
      .maybeSingle();

    if (existingSchedule?.id) scheduleId = existingSchedule.id;
  }

  if (!scheduleId && courseId) {
    const { data: courseSched } = await supabaseAdmin
      .from('schedules')
      .select('id')
      .eq('course_id', courseId)
      .limit(1)
      .maybeSingle();
    if (courseSched?.id) scheduleId = courseSched.id;
  }

  if (!scheduleId) {
    const { data: newSched } = await supabaseAdmin
      .from('schedules')
      .insert({
        course_id: courseId,
        instructor_id: resolvedInstructorId,
        room: 'Practical Site',
        start_at: `${date}T08:00:00Z`,
        end_at: `${date}T12:00:00Z`,
        status: 'COMPLETED',
      })
      .select('id')
      .maybeSingle();
    scheduleId = newSched?.id || null;
  }

  if (!scheduleId) {
    throw new Error('Failed to resolve or create schedule for attendance session');
  }

  // Resolve batch & course labels for notifications in a single query
  const { data: courseBatch } = await supabaseAdmin
    .from('batches')
    .select('id, batch_code, courses(code, name)')
    .eq('course_id', courseId)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const defaultBatchId = courseBatch?.id || null;
  const courseRel: any = Array.isArray((courseBatch as any)?.courses)
    ? (courseBatch as any).courses[0]
    : (courseBatch as any)?.courses;
  const resolvedBatchName = courseBatch?.batch_code || courseRel?.code || 'Scheduled Batch';
  const resolvedCourseName = courseRel?.name || courseRel?.code || 'Maritime Course';

  if (defaultBatchId && date) {
    const { data: finalizedSess } = await supabaseAdmin
      .from('attendance_sessions')
      .select('id, status')
      .eq('batch_id', defaultBatchId)
      .eq('session_date', date)
      .maybeSingle();
    if (finalizedSess?.status === 'FINALIZED') {
      throw new Error('Attendance session is already finalized and locked.');
    }
  }

  // 2. Upsert each attendance record
  const insertedOrUpdated = await Promise.all(
    records.map(async (rec) => {
      // Check if attendance record already exists for scheduleId & traineeId
      const { data: existingAtt } = await supabaseAdmin
        .from('attendance')
        .select('id, batch_id')
        .eq('schedule_id', scheduleId)
        .eq('trainee_id', rec.traineeId)
        .maybeSingle();

      let resultRow: any = null;
      if (existingAtt?.id) {
        const { data: updated } = await supabaseAdmin
          .from('attendance')
          .update({
            course_id: courseId,
            batch_id: existingAtt.batch_id || defaultBatchId,
            session_date: date,
            status: rec.status,
            remarks: rec.remarks || '',
            check_in_at: `${date}T08:00:00Z`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAtt.id)
          .select()
          .single();
        resultRow = updated;
      } else {
        const { data: created } = await supabaseAdmin
          .from('attendance')
          .insert({
            schedule_id: scheduleId,
            course_id: courseId,
            batch_id: defaultBatchId,
            session_date: date,
            trainee_id: rec.traineeId,
            status: rec.status,
            remarks: rec.remarks || '',
            check_in_at: `${date}T08:00:00Z`,
            recorded_by: resolvedInstructorId,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
        resultRow = created;
      }

      if (courseId && rec.traineeId) {
        try {
          await calculateTraineeCourseGrade({ traineeId: rec.traineeId, courseId });
        } catch {}
      }

      return resultRow;
    })
  );

  // 3. Add audit log
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: resolvedInstructorId,
      action: 'ATTENDANCE_RECORDED',
      entity_type: 'ATTENDANCE',
      entity_id: scheduleId,
      new_values: { date, sessionCode, totalRecords: records.length },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Could not record attendance audit log:', err);
  }

  // 4. Dispatch Role-Aware Attendance Notifications (Section 11 Recipient Matrix)
  try {
    for (const rec of records) {
      if (rec.status === 'LATE') {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.TRAINEE_LATE,
          traineeId: rec.traineeId,
          instructorId: resolvedInstructorId,
          courseId,
          entityType: 'ATTENDANCE',
          entityId: scheduleId,
          metadata: {
            day: sessionCode,
            sessionDate: date,
            status: 'LATE',
            batchName: resolvedBatchName,
            courseName: resolvedCourseName,
          },
        });
      } else if (rec.status === 'ABSENT') {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.TRAINEE_ABSENT,
          traineeId: rec.traineeId,
          instructorId: resolvedInstructorId,
          courseId,
          entityType: 'ATTENDANCE',
          entityId: scheduleId,
          metadata: {
            day: sessionCode,
            sessionDate: date,
            status: 'ABSENT',
            batchName: resolvedBatchName,
            courseName: resolvedCourseName,
          },
        });
      } else {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.ATTENDANCE_RECORDED,
          traineeId: rec.traineeId,
          instructorId: resolvedInstructorId,
          courseId,
          entityType: 'ATTENDANCE',
          entityId: scheduleId,
          metadata: {
            day: sessionCode,
            sessionDate: date,
            status: rec.status,
            batchName: resolvedBatchName,
            courseName: resolvedCourseName,
          },
        });
      }
    }
  } catch (notifErr) {
    console.warn('Attendance notification dispatch notice:', notifErr);
  }

  return insertedOrUpdated;
}

/**
 * Cohort Telemetry and Progress Tracking
 */
export async function getInstructorProgressData(
  profileId?: string,
  filters?: { search?: string; status?: string; courseId?: string }
) {
  const resolvedId = await resolveInstructorProfileId(profileId);
  const courseIds = await getInstructorCourseIds(resolvedId);

  // If instructor has no assigned courses, return empty progress list
  if (courseIds.length === 0) {
    return [];
  }

  const scopedCourseIds =
    filters?.courseId && filters.courseId !== 'ALL'
      ? courseIds.filter((cid) => cid === filters.courseId)
      : courseIds;
  if (scopedCourseIds.length === 0) {
    return [];
  }

  // Fetch enrollments strictly in instructor's assigned courses
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('id, trainee_id, course_id, status, created_at, enrolled_at, completed_at, courses(id, code, name, category, practical_days)')
    .in('course_id', scopedCourseIds)
    .not('status', 'in', '("CANCELLED","REJECTED")')
    .order('created_at', { ascending: false });

  // Deduplicate by (trainee_id, course_id), prioritizing ACTIVE / ONGOING / ENROLLED over older rows
  const enrollmentKeyMap = new Map<string, any>();
  const statusPriority = (st: string) => {
    const u = (st || '').toUpperCase();
    if (u === 'ACTIVE' || u === 'ONGOING' || u === 'ENROLLED' || u === 'APPROVED') return 1;
    if (u === 'COMPLETED') return 2;
    return 3;
  };
  for (const enr of enrollments || []) {
    if (!enr.trainee_id || !enr.course_id) continue;
    const key = `${enr.trainee_id}:${enr.course_id}`;
    const existing = enrollmentKeyMap.get(key);
    if (!existing || statusPriority(enr.status) < statusPriority(existing.status)) {
      enrollmentKeyMap.set(key, enr);
    }
  }

  const enrolledList = Array.from(enrollmentKeyMap.values());
  const traineeIds = Array.from(new Set(enrolledList.map((e: any) => e.trainee_id)));

  if (traineeIds.length === 0) return [];

  // Fetch trainee profiles, metadata, courses, modules, lesson completions, daily tracking, assessments, attempts, attendance, and grades in parallel
  const [
    profilesRes,
    traineesMetaRes,
    coursesRes,
    modulesRes,
    lessonCompsRes,
    dailyTrackingRes,
    assessmentsRes,
    attemptsRes,
    attRecordsRes,
    gradesRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, updated_at')
      .in('id', traineeIds),
    supabaseAdmin
      .from('trainees')
      .select('profile_id, trainee_number, srn, gender')
      .in('profile_id', traineeIds),
    supabaseAdmin
      .from('courses')
      .select('id, code, name, category, practical_days')
      .in('id', scopedCourseIds),
    supabaseAdmin
      .from('course_modules')
      .select('id, course_id')
      .in('course_id', scopedCourseIds),
    supabaseAdmin
      .from('trainee_lesson_completions')
      .select('trainee_id, course_id, module_id, lesson_id, completed_at')
      .in('trainee_id', traineeIds)
      .in('course_id', scopedCourseIds),
    supabaseAdmin
      .from('trainee_daily_module_tracking')
      .select('trainee_id, course_id, module_id, status, updated_at')
      .in('trainee_id', traineeIds)
      .in('course_id', scopedCourseIds),
    supabaseAdmin
      .from('assessments')
      .select('id, course_id, module_id, passing_score')
      .in('course_id', scopedCourseIds),
    supabaseAdmin
      .from('assessment_attempts')
      .select('trainee_id, assessment_id, score, status, passed, submitted_at')
      .in('trainee_id', traineeIds),
    supabaseAdmin
      .from('attendance')
      .select('trainee_id, course_id, status, updated_at')
      .in('trainee_id', traineeIds)
      .in('course_id', scopedCourseIds),
    supabaseAdmin
      .from('grades')
      .select('trainee_id, course_id, final_score, module_score, practical_score, status, updated_at')
      .in('trainee_id', traineeIds)
      .in('course_id', scopedCourseIds),
  ]);

  const profileMap = new Map<string, any>((profilesRes.data || []).map((p: any) => [p.id, p]));
  const metaMap = new Map<string, any>((traineesMetaRes.data || []).map((t: any) => [t.profile_id, t]));
  const coursesMap = new Map<string, any>((coursesRes.data || []).map((c: any) => [c.id, c]));

  const courseModuleCountMap = new Map<string, number>();
  (modulesRes.data || []).forEach((m: any) => {
    courseModuleCountMap.set(m.course_id, (courseModuleCountMap.get(m.course_id) || 0) + 1);
  });

  const assessmentMap = new Map<string, any>((assessmentsRes.data || []).map((a: any) => [a.id, a]));

  // Calculate telemetry for each (trainee, assigned course) enrollment
  const progressList = enrolledList.map((enr: any, idx: number) => {
    const p = profileMap.get(enr.trainee_id) || {};
    const meta = metaMap.get(enr.trainee_id) || {};
    const courseId = enr.course_id;
    const courseObj = coursesMap.get(courseId) || (enr.courses as any) || {};
    const courseTitle = courseObj.name || 'Maritime Training Course';
    const courseCode = courseObj.code || 'STCW';
    const isFullModular = isInHouseModularCourse(courseObj.category, courseObj.practical_days);
    const totalModules = courseModuleCountMap.get(courseId) || 3;

    // 1. Completed modules for this trainee & course
    const completedModIds = new Set<string>();
    let latestActivityIso: string =
      enr.enrolled_at || enr.created_at || p.updated_at || new Date().toISOString();

    for (const dt of dailyTrackingRes.data || []) {
      if (dt.trainee_id === enr.trainee_id && dt.course_id === courseId) {
        if (dt.status === 'COMPLETED' && dt.module_id) {
          completedModIds.add(String(dt.module_id));
        }
        if (dt.updated_at && dt.updated_at > latestActivityIso) {
          latestActivityIso = dt.updated_at;
        }
      }
    }

    for (const lc of lessonCompsRes.data || []) {
      if (lc.trainee_id === enr.trainee_id && lc.course_id === courseId) {
        if (lc.module_id) completedModIds.add(String(lc.module_id));
        else if (lc.lesson_id) completedModIds.add(String(lc.lesson_id));
        if (lc.completed_at && lc.completed_at > latestActivityIso) {
          latestActivityIso = lc.completed_at;
        }
      }
    }

    // 2. Assessment attempts strictly for this course
    const courseAttempts: any[] = [];
    let postTestPassed = false;
    for (const att of attemptsRes.data || []) {
      if (att.trainee_id !== enr.trainee_id) continue;
      if (
        Number(att.score) === 0 &&
        att.status === 'FAILED' &&
        String(att.submitted_at || '').includes('59:59')
      ) {
        continue;
      }
      const asm = assessmentMap.get(att.assessment_id);
      if (!asm || asm.course_id !== courseId) continue;
      courseAttempts.push(att);
      const passBenchmark = Number(asm.passing_score) || 75;
      const isPassed = att.passed === true || att.status === 'PASSED' || Number(att.score) >= passBenchmark;
      if (isPassed && asm.module_id) {
        completedModIds.add(String(asm.module_id));
      }
      if (isPassed && !asm.module_id) {
        postTestPassed = true;
      }
      if (att.submitted_at && att.submitted_at > latestActivityIso) {
        latestActivityIso = att.submitted_at;
      }
    }

    const gradeRow = (gradesRes.data || []).find(
      (g: any) => g.trainee_id === enr.trainee_id && g.course_id === courseId
    );

    const avgGrade =
      courseAttempts.length > 0
        ? Math.round(
            courseAttempts.reduce((acc: number, a: any) => acc + (Number(a.score) || 0), 0) /
              courseAttempts.length
          )
        : gradeRow?.final_score != null
        ? Math.round(Number(gradeRow.final_score))
        : 0;

    // 3. Attendance (only for Modular + Practical courses)
    const attList = isFullModular
      ? []
      : (attRecordsRes.data || []).filter(
          (a: any) =>
            a.trainee_id === enr.trainee_id &&
            a.course_id === courseId &&
            a.status &&
            a.status !== 'NOT_MARKED'
        );
    const presentCount = attList.filter((a: any) =>
      ['PRESENT', 'LATE', 'EXCUSED'].includes((a.status || '').toUpperCase())
    ).length;
    const attendancePercent =
      attList.length > 0 ? Math.round((presentCount / attList.length) * 100) : 0;

    const isEnrCompleted = (enr.status || '').toUpperCase() === 'COMPLETED';
    const modulesCompleted = isEnrCompleted
      ? totalModules
      : Math.min(totalModules, completedModIds.size);

    let progressPercent = 0;
    if (isEnrCompleted || (modulesCompleted >= totalModules && postTestPassed && isFullModular)) {
      progressPercent = 100;
    } else if (isFullModular) {
      const modPct = totalModules > 0 ? Math.round((modulesCompleted / totalModules) * 85) : 0;
      progressPercent = Math.min(100, modPct + (postTestPassed ? 15 : 0));
    } else {
      const modPct = totalModules > 0 ? Math.round((modulesCompleted / totalModules) * 60) : 0;
      const postPct = postTestPassed ? 15 : 0;
      const pracPct = attList.length > 0 ? Math.round((attendancePercent / 100) * 25) : 0;
      progressPercent = Math.min(100, modPct + postPct + pracPct);
    }

    let status = 'ON_TRACK';
    if (progressPercent >= 100 && (avgGrade >= 75 || isEnrCompleted)) {
      status = 'COMPLETED';
    } else if (
      (!isFullModular && attList.length > 0 && attendancePercent < 80) ||
      (courseAttempts.length > 0 && avgGrade < 75)
    ) {
      status = 'AT_RISK';
    }

    return {
      id: `prog-${enr.trainee_id}-${courseId}-${idx}`,
      traineeId: enr.trainee_id,
      traineeName: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Trainee Seafarer',
      traineeAvatarUrl: p.avatar_url || null,
      srn: meta?.srn || meta?.trainee_number || 'SRN-2026-0000',
      rank: meta?.gender || 'Maritime Cadet',
      courseId,
      courseCode,
      courseTitle,
      isFullModular,
      deliveryMode: isFullModular ? 'FULL_MODULAR' : 'MODULAR_AND_PRACTICAL',
      requiresPractical: !isFullModular,
      progressPercent,
      modulesCompleted,
      totalModules,
      attendanceRate: isFullModular ? 'Full Modular' : `${attendancePercent}%`,
      averageGrade: avgGrade,
      status,
      enrollmentStatus: (enr.status || 'ACTIVE').toUpperCase(),
      lastActiveAt: latestActivityIso,
    };
  });

  let result = progressList;
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (p: any) =>
        p.traineeName.toLowerCase().includes(s) ||
        p.srn.toLowerCase().includes(s) ||
        p.rank.toLowerCase().includes(s) ||
        p.courseTitle.toLowerCase().includes(s)
    );
  }

  if (filters?.status && filters.status !== 'ALL') {
    result = result.filter((p: any) => p.status === filters.status);
  }

  return result;
}

/**
 * Teaching Timetable / Schedules List
 */
export async function getInstructorSchedulesList(profileId?: string) {
  const resolvedId = await resolveInstructorProfileId(profileId);

  const { data: schedulesData, error } = await supabaseAdmin
    .from('schedules')
    .select('*, courses(id, code, name, category, capacity, duration_hours, theory_days, practical_days), training_centers(name), instructors(profiles(first_name, last_name, avatar_url))')
    .or(`instructor_id.eq.${resolvedId},substitute_instructor_id.eq.${resolvedId}`)
    .neq('status', 'CANCELLED')
    .order('start_at', { ascending: true });

  if (error) throw error;

  // Full modular courses have no practical training dates or schedules
  let schedules = (schedulesData || []).filter(
    (s: any) => !isInHouseModularCourse(s.courses?.category, s.courses?.practical_days)
  );
  if (schedules.length === 0) {
    return [];
  }

  // Calculate real enrolled trainees per course
  const courseIds = Array.from(new Set(schedules.map((s: any) => s.course_id).filter(Boolean)));
  const countMap = new Map<string, number>();
  if (courseIds.length > 0) {
    const { data: enrs } = await supabaseAdmin
      .from('enrollments')
      .select('course_id')
      .in('course_id', courseIds)
      .not('status', 'in', '("CANCELLED","REJECTED")');

    (enrs || []).forEach((e: any) => {
      if (e.course_id) {
        countMap.set(e.course_id, (countMap.get(e.course_id) || 0) + 1);
      }
    });
  }

  return schedules.map((s: any) => {
    const startDate = s.start_at ? new Date(s.start_at) : new Date();
    const endDate = s.end_at ? new Date(s.end_at) : new Date(startDate.getTime() + 4 * 3600000);

    const startTime = startDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true });
    const endTime = endDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true });
    const dateFormatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(startDate);

    const rawInstructor = Array.isArray(s.instructors) ? s.instructors[0] : s.instructors;
    const instructorProfile = Array.isArray(rawInstructor?.profiles) ? rawInstructor.profiles[0] : rawInstructor?.profiles;
    const instructorName = (instructorProfile?.first_name || instructorProfile?.last_name)
      ? `Capt. ${instructorProfile.first_name || ''} ${instructorProfile.last_name || ''}`.trim()
      : 'Assigned Instructor';

    const isSubstitute = s.substitute_instructor_id === resolvedId;

    const effectiveCap = Math.min(s.capacity || s.courses?.capacity || 24, 24);
    const actualEnrolled = countMap.get(s.course_id) ?? (s.enrolledCount || 0);

    const course = s.courses;
    const durationHours = Number(course?.duration_hours || 40);
    const durationDays = Math.max(1, Math.ceil(durationHours / 8));
    const theoryDays = Number(course?.theory_days ?? (durationDays === 1 ? 1 : Math.max(1, Math.round(durationDays * 0.4))));
    const practicalDays = Number(course?.practical_days ?? (durationDays === 1 ? 0 : Math.max(0, durationDays - theoryDays)));
    const totalDays = Math.max(1, theoryDays + practicalDays);

    const parts = dateFormatted.split('-');
    let calculatedEndDateStr = dateFormatted;
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(Date.UTC(y, m, d));
      dateObj.setUTCDate(dateObj.getUTCDate() + Math.max(0, totalDays - 1));
      const ey = dateObj.getUTCFullYear();
      const em = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const ed = String(dateObj.getUTCDate()).padStart(2, '0');
      calculatedEndDateStr = `${ey}-${em}-${ed}`;
    }

    return {
      id: s.id,
      sessionCode: s.session_code || `SES-${String(s.id).slice(0, 8).toUpperCase()}`,
      courseId: s.course_id,
      courseCode: s.courses?.code || 'STCW',
      courseTitle: s.courses?.name || 'Maritime Simulation Course',
      instructorName,
      instructorAvatarUrl: instructorProfile?.avatar_url || null,
      isSubstitute,
      substituteInstructorId: s.substitute_instructor_id || null,
      room: s.room || 'Bridge Simulator Alpha',
      centerName: s.training_centers?.name || 'NEWSIM Talisay Training Center',
      date: dateFormatted,
      startDate: dateFormatted,
      endDate: calculatedEndDateStr,
      durationHours,
      durationDays,
      theoryDays,
      practicalDays,
      totalDays,
      startTime,
      endTime,
      capacity: effectiveCap,
      enrolledCount: Math.min(actualEnrolled, effectiveCap),
      status: s.status || 'SCHEDULED',
    };
  });
}

/**
 * Instructor Notifications
 */
export async function getInstructorNotificationsList(profileId?: string) {
  const resolvedId = await resolveInstructorProfileId(profileId);
  return getUserNotifications(resolvedId, 'INSTRUCTOR');
}

/**
 * Mark All Instructor Notifications as Read
 */
export async function markInstructorNotificationsRead(profileId?: string) {
  const resolvedId = await resolveInstructorProfileId(profileId);

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', resolvedId);

  if (error) throw error;
  return true;
}

/**
 * Full Master Dashboard Telemetry & Operations Data
 */
export async function getInstructorDashboardData(profileId?: string) {
  const resolvedId = await resolveInstructorProfileId(profileId);

  const [
    courses,
    trainees,
    progressList,
    allSchedules,
    notifications,
  ] = await Promise.all([
    getInstructorCoursesList(resolvedId),
    getInstructorTraineesList(resolvedId),
    getInstructorProgressData(resolvedId),
    getInstructorSchedulesList(resolvedId),
    getInstructorNotificationsList(resolvedId),
  ]);

  // 1. Courses metrics
  const totalAssignedCourses = courses.length;
  const activeCourses = courses.filter((c: any) => c.status === 'PUBLISHED' || c.status === 'ONGOING').length;
  const upcomingCourses = courses.filter((c: any) => c.status === 'DRAFT').length;
  const completedCourses = courses.filter((c: any) => c.status === 'COMPLETED').length;

  // 2. Trainees metrics
  const totalAssignedTrainees = trainees.length;

  // 3. Pending grading count, recent submissions & course attendance (parallelized)
  const courseIds = courses.map((c: any) => c.id);
  let pendingGradingCount = 0;
  let recentSubmissions: any[] = [];
  let attRowsData: any[] = [];

  if (courseIds.length > 0) {
    const [{ data: asmData }, { data: attRows }] = await Promise.all([
      supabaseAdmin
        .from('assessments')
        .select('id, title')
        .in('course_id', courseIds),
      supabaseAdmin
        .from('attendance')
        .select('status')
        .in('course_id', courseIds),
    ]);

    attRowsData = attRows || [];
    const asmMap = new Map((asmData || []).map((a: any) => [a.id, a.title]));
    const asmIds = Array.from(asmMap.keys());

    if (asmIds.length > 0) {
      const { data: pendingAttempts, count } = await supabaseAdmin
        .from('assessment_attempts')
        .select('id, assessment_id, trainee_id, status, submitted_at', { count: 'exact' })
        .in('assessment_id', asmIds)
        .in('status', ['SUBMITTED', 'IN_PROGRESS'])
        .order('submitted_at', { ascending: false })
        .limit(5);

      pendingGradingCount = count || 0;

      if (pendingAttempts && pendingAttempts.length > 0) {
        const traineeIds = pendingAttempts.map((att: any) => att.trainee_id);
        const { data: profs } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', traineeIds);
        const profMap = new Map<string, any>((profs || []).map((p: any) => [p.id, p]));

        recentSubmissions = pendingAttempts.map((att: any) => {
          const p = profMap.get(att.trainee_id);
          const traineeName = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '';
          return {
            id: att.id,
            traineeName: traineeName || 'Trainee Seafarer',
            traineeAvatarUrl: p?.avatar_url || null,
            assessmentTitle: asmMap.get(att.assessment_id) || 'Assessment Evaluation',
            status: att.status,
            submittedAt: att.submitted_at || new Date().toISOString(),
          };
        });
      }
    }
  }

  // 4. Progress list & cohort telemetry
  const atRiskCount = progressList.filter((p: any) => p.status === 'AT_RISK').length;
  const completedCount = progressList.filter((p: any) => p.status === 'COMPLETED').length;
  const onTrackCount = progressList.filter((p: any) => p.status === 'ON_TRACK' || p.status === 'COMPLETED').length;
  const traineesOnTrackRate = totalAssignedTrainees > 0 ? Math.round((onTrackCount / totalAssignedTrainees) * 100) : 100;
  const averageCourseProgress =
    progressList.length > 0
      ? Math.round(progressList.reduce((acc: number, p: any) => acc + p.progressPercent, 0) / progressList.length)
      : 0;

  // 5. Today's schedules
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  const todaySessions = allSchedules.filter((s: any) => s.date === todayStr);

  // If no sessions strictly today, show top upcoming sessions (excluding completed/past)
  const displaySessions = todaySessions.length > 0
    ? todaySessions
    : allSchedules.filter((s: any) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED' && (!s.endAt || new Date(s.endAt) >= new Date())).slice(0, 3);

  // 6. Today's attendance calculation from real database records
  const totalSessions = displaySessions.length;
  const completedSessions = displaySessions.filter((s: any) => s.status === 'COMPLETED').length;
  const pendingSessions = totalSessions - completedSessions;

  let presentPct = 0;
  let latePct = 0;
  let absentPct = 0;
  let excusedPct = 0;

  if (attRowsData.length > 0) {
    const marked = attRowsData.filter((a: any) => a.status && a.status !== 'NOT_MARKED');
    if (marked.length > 0) {
      const pCount = marked.filter((a: any) => String(a.status).toUpperCase() === 'PRESENT').length;
      const lCount = marked.filter((a: any) => String(a.status).toUpperCase() === 'LATE').length;
      const aCount = marked.filter((a: any) => String(a.status).toUpperCase() === 'ABSENT').length;
      const eCount = marked.filter((a: any) => String(a.status).toUpperCase() === 'EXCUSED').length;
      presentPct = Math.round((pCount / marked.length) * 100);
      latePct = Math.round((lCount / marked.length) * 100);
      absentPct = Math.round((aCount / marked.length) * 100);
      excusedPct = Math.round((eCount / marked.length) * 100);
    }
  }

  return {
    overview: {
      totalAssignedCourses,
      activeCourses,
      upcomingCourses,
      completedCourses,
      totalAssignedTrainees,
      pendingGradingCount,
      atRiskCount,
      completedCount,
      averageCourseProgress,
      traineesOnTrackRate,
    },
    todaySessions: displaySessions,
    todayAttendance: {
      totalSessions,
      completedSessions,
      pendingSessions,
      attendanceBreakdown: {
        present: presentPct,
        late: latePct,
        absent: absentPct,
        excused: excusedPct,
      },
    },
    recentSubmissions,
    traineeProgressList: progressList.slice(0, 6),
    notifications: notifications.slice(0, 4),
  };
}

/**
 * ============================================================
 * INSTRUCTOR LEAVE MANAGEMENT & SCHEDULE SUBSTITUTION
 * ============================================================
 */

/**
 * Instructor: Get My Leave Requests
 */
export async function getInstructorLeavesList(profileId?: string) {
  const resolvedId = await resolveInstructorProfileId(profileId);

  const { data: leaves, error } = await supabaseAdmin
    .from('instructor_leaves')
    .select('*, reviewer:profiles!instructor_leaves_reviewed_by_fkey(first_name, last_name)')
    .eq('instructor_id', resolvedId)
    .order('created_at', { ascending: false });

  if (error) {
    // If foreign key lookup fails, fallback to simple select
    const { data: simpleLeaves, error: simpleErr } = await supabaseAdmin
      .from('instructor_leaves')
      .select('*')
      .eq('instructor_id', resolvedId)
      .order('created_at', { ascending: false });
    if (simpleErr) throw simpleErr;
    return (simpleLeaves || []).map((l: any) => ({
      ...l,
      reviewerName: '',
    }));
  }

  return (leaves || []).map((l: any) => {
    const rev = Array.isArray(l.reviewer) ? l.reviewer[0] : l.reviewer;
    return {
      ...l,
      reviewerName: rev ? `${rev.first_name || ''} ${rev.last_name || ''}`.trim() : '',
    };
  });
}

/**
 * Instructor: File a Leave Request
 */
export async function createInstructorLeaveRequest(data: {
  instructorId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
}) {
  const resolvedId = await resolveInstructorProfileId(data.instructorId);

  if (!data.startDate || !data.endDate) {
    throw new Error('Start date and end date are required');
  }

  if (data.endDate < data.startDate) {
    throw new Error('End date must be on or after start date');
  }

  const { data: created, error } = await supabaseAdmin
    .from('instructor_leaves')
    .insert({
      instructor_id: resolvedId,
      leave_type: (data.leaveType || 'VACATION').toUpperCase(),
      start_date: data.startDate,
      end_date: data.endDate,
      reason: data.reason || '',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  try {
    await dispatchNotificationEvent({
      event: NOTIFICATION_EVENTS.LEAVE_REQUEST_SUBMITTED,
      instructorId: resolvedId,
      entityType: 'LEAVE',
      entityId: created.id,
      metadata: {
        startDate: data.startDate,
        endDate: data.endDate,
        leaveType: data.leaveType,
      },
    });
  } catch (notifErr) {
    console.warn('Leave request notification notice:', notifErr);
  }

  return created;
}

/**
 * Instructor: Cancel a Pending Leave Request
 */
export async function cancelInstructorLeaveRequest(leaveId: string, instructorId?: string) {
  const resolvedId = await resolveInstructorProfileId(instructorId);

  const { data, error } = await supabaseAdmin
    .from('instructor_leaves')
    .update({
      status: 'CANCELLED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leaveId)
    .eq('instructor_id', resolvedId)
    .eq('status', 'PENDING')
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Admin: Get All Leaves
 */
export async function getAdminLeavesList(filters?: { status?: string; search?: string }) {
  let query = supabaseAdmin
    .from('instructor_leaves')
    .select('*, profiles:instructor_id(id, first_name, last_name, email, phone, avatar_url)')
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status.toUpperCase());
  }

  const { data: leaves, error } = await query;
  if (error) throw error;

  // Fetch reviewers map
  const reviewerIds = Array.from(new Set((leaves || []).map((l: any) => l.reviewed_by).filter(Boolean)));
  const reviewersMap = new Map<string, { name: string; avatarUrl: string | null }>();
  if (reviewerIds.length > 0) {
    const { data: revProfs } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', reviewerIds);
    (revProfs || []).forEach((p: any) => {
      reviewersMap.set(p.id, {
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        avatarUrl: p.avatar_url || null,
      });
    });
  }

  let results = (leaves || []).map((l: any) => {
    const prof = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
    const revInfo = l.reviewed_by ? reviewersMap.get(l.reviewed_by) : undefined;
    return {
      id: l.id,
      instructorId: l.instructor_id,
      instructorName: prof ? `Capt. ${prof.first_name || ''} ${prof.last_name || ''}`.trim() : 'Instructor',
      instructorEmail: prof?.email || '',
      instructorPhone: prof?.phone || '',
      instructorAvatarUrl: prof?.avatar_url || null,
      leaveType: l.leave_type || 'VACATION',
      startDate: l.start_date,
      endDate: l.end_date,
      reason: l.reason || '',
      status: l.status || 'PENDING',
      adminNotes: l.admin_notes || '',
      reviewedBy: l.reviewed_by,
      reviewerName: l.reviewed_by ? revInfo?.name || 'Administrator' : '',
      reviewerAvatarUrl: l.reviewed_by ? revInfo?.avatarUrl || null : null,
      reviewedAt: l.reviewed_at,
      createdAt: l.created_at,
    };
  });

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    results = results.filter((l: any) =>
      l.instructorName.toLowerCase().includes(s) ||
      l.instructorEmail.toLowerCase().includes(s) ||
      l.leaveType.toLowerCase().includes(s) ||
      l.reason.toLowerCase().includes(s)
    );
  }

  return results;
}

/**
 * Admin: Review Leave (Approve or Reject)
 */
export async function reviewAdminLeaveRequest(
  leaveId: string,
  action: 'APPROVE' | 'REJECT',
  adminId?: string,
  adminNotes?: string
) {
  const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  const { data: updated, error } = await supabaseAdmin
    .from('instructor_leaves')
    .update({
      status: newStatus,
      reviewed_by: adminId || null,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes || '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leaveId)
    .select('*, profiles:instructor_id(id, first_name, last_name, email)')
    .single();

  if (error) throw error;

  // Find any active schedules assigned to this instructor overlapping the leave dates
  let overlappingSchedules: any[] = [];
  if (newStatus === 'APPROVED' && updated) {
    const { data: scheds } = await supabaseAdmin
      .from('schedules')
      .select('id, course_id, room, start_at, end_at, substitute_instructor_id, courses(code, name)')
      .eq('instructor_id', updated.instructor_id)
      .neq('status', 'CANCELLED')
      .neq('status', 'COMPLETED');

    if (scheds && scheds.length > 0) {
      overlappingSchedules = scheds.filter((s: any) => {
        if (!s.start_at) return false;
        const sDate = s.start_at.split('T')[0];
        const eDate = s.end_at ? s.end_at.split('T')[0] : sDate;
        return sDate <= updated.end_date && eDate >= updated.start_date;
      });
    }
  }

  try {
    const instProfile: any = updated?.profiles;
    const instName = instProfile
      ? `${instProfile.first_name || ''} ${instProfile.last_name || ''}`.trim() || instProfile.email
      : 'Instructor';

    await dispatchNotificationEvent({
      event:
        newStatus === 'APPROVED'
          ? NOTIFICATION_EVENTS.LEAVE_APPROVED
          : NOTIFICATION_EVENTS.LEAVE_REJECTED,
      instructorId: updated.instructor_id,
      entityType: 'LEAVE',
      entityId: updated.id,
      metadata: {
        instructorName: instName,
        startDate: updated.start_date,
        endDate: updated.end_date,
        reason: adminNotes || '',
      },
    });
  } catch (notifErr) {
    console.warn('Leave review notification notice:', notifErr);
  }

  return { leave: updated, overlappingSchedules };
}

/**
 * Check if Instructor is on Approved Leave for a Date Range
 */
export async function checkInstructorOnLeave(instructorId: string, startDate: string, endDate: string) {
  if (!instructorId || !startDate || !endDate) return { onLeave: false };

  const { data: leaves } = await supabaseAdmin
    .from('instructor_leaves')
    .select('id, start_date, end_date, leave_type, reason')
    .eq('instructor_id', instructorId)
    .eq('status', 'APPROVED')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (leaves && leaves.length > 0) {
    return { onLeave: true, leave: leaves[0] };
  }

  return { onLeave: false };
}

/**
 * Assign Substitute Instructor to Schedule
 */
export async function assignScheduleSubstitute(scheduleId: string, substituteInstructorId: string, adminId?: string) {
  const { data: updated, error } = await supabaseAdmin
    .from('schedules')
    .update({
      substitute_instructor_id: substituteInstructorId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .select('id, course_id, instructor_id, substitute_instructor_id, room, start_at, end_at')
    .single();

  if (error) throw error;

  // Log to audit log
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminId || null,
      action: 'SCHEDULE_SUBSTITUTE_ASSIGNED',
      entity_type: 'SCHEDULE',
      entity_id: scheduleId,
      new_values: { substituteInstructorId },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Audit log error:', err);
  }

  try {
    await dispatchNotificationEvent({
      event: NOTIFICATION_EVENTS.SUBSTITUTE_ASSIGNED,
      instructorId: substituteInstructorId,
      courseId: updated.course_id,
      entityType: 'SCHEDULE',
      entityId: scheduleId,
      metadata: {
        sessionDate: updated.start_at ? String(updated.start_at).split('T')[0] : '',
      },
    });
  } catch (notifErr) {
    console.warn('Substitute notification error:', notifErr);
  }

  return updated;
}

/**
 * Remove Substitute Instructor from Schedule
 */
export async function removeScheduleSubstitute(scheduleId: string, adminId?: string) {
  const { data: updated, error } = await supabaseAdmin
    .from('schedules')
    .update({
      substitute_instructor_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .select('id, course_id, instructor_id, substitute_instructor_id')
    .single();

  if (error) throw error;
  return updated;
}

