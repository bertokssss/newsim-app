import crypto from 'crypto';
import { supabaseAdmin } from '../supabase';

export interface GradingPolicy {
  id: string;
  courseId: string | null;
  name: string;
  attendanceWeight: number; // e.g. 10
  practicalWeight: number; // e.g. 50
  moduleQuizWeight: number; // e.g. 40
  passingGrade: number; // e.g. 75
  minAttendancePct: number; // e.g. 80
  lateCreditPct: number; // e.g. 75
  excusedMode: 'EXCLUDE' | 'FULL_CREDIT' | 'NO_CREDIT';
  practicalCompetencyRequired: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export interface ComponentGrade {
  name: string;
  weight: number;
  score: number | null; // null represents pending / not completed
  maxScore: number;
  contribution: number | null;
  status: 'PENDING' | 'COMPLETED' | 'NOT_STARTED' | 'FAILED';
  details: Record<string, any>;
}

export interface CourseGradeBreakdown {
  traineeId: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  courseCategory?: string;
  deliveryMode?: 'FULL_MODULAR' | 'MODULAR_AND_PRACTICAL';
  requiresPractical?: boolean;
  policyId: string;
  policyName: string;
  attendanceComponent: ComponentGrade;
  practicalComponent: ComponentGrade;
  moduleComponent: ComponentGrade;
  overallScore: number | null;
  passingGrade: number;
  passed: boolean;
  finalStatus: 'PASSED' | 'FAILED' | 'IN_PROGRESS' | 'NEEDS_REMEDIATION' | 'PENDING_GRADING';
  statusRemarks: string;
  mandatoryRequirementsMet: boolean;
  mandatoryRemarks: string[];
  isFinal: boolean;
  finalizedAt?: string;
  lastUpdated: string;
}

/**
 * Returns true if the course category represents an In-House Full Modular-Based Course.
 * In-House Courses are 100% modular (lessons + modular written assessments) with no practical phase.
 * Safety and Other STCW Courses have modular lessons followed by a course-specific practical assessment.
 */
export function isInHouseModularCourse(category?: string | null, practicalDays?: number | null): boolean {
  const norm = String(category || '').trim().toLowerCase();
  if (
    norm === 'in-house courses' ||
    norm === 'in-house' ||
    norm.includes('in-house') ||
    norm.includes('in house') ||
    (norm.includes('modular') && !norm.includes('practical')) ||
    norm.includes('online') ||
    norm.includes('theoretical')
  ) {
    return true;
  }
  if (practicalDays !== undefined && practicalDays !== null && Number(practicalDays) === 0) {
    return true;
  }
  return false;
}

export function courseRequiresPractical(category?: string | null, practicalDays?: number | null): boolean {
  return !isInHouseModularCourse(category, practicalDays);
}

/**
 * Retrieve active grading policy for a course (or fallback to institutional default).
 */
export async function getGradingPolicy(courseId?: string): Promise<GradingPolicy> {
  let courseCategory: string | null = null;
  let coursePracticalDays: number | null = null;
  let resolvedCoursePolicy: any = null;

  if (courseId) {
    const [{ data: coursePolicy }, { data: courseRow }] = await Promise.all([
      supabaseAdmin
        .from('grading_policies')
        .select('*')
        .eq('course_id', courseId)
        .eq('status', 'ACTIVE')
        .maybeSingle(),
      supabaseAdmin
        .from('courses')
        .select('category, practical_days')
        .eq('id', courseId)
        .maybeSingle(),
    ]);

    courseCategory = courseRow?.category || null;
    coursePracticalDays = courseRow?.practical_days ?? null;
    resolvedCoursePolicy = coursePolicy;
  }

  // Fallback to institutional default policy
  const { data: defaultPolicy } = await supabaseAdmin
    .from('grading_policies')
    .select('*')
    .is('course_id', null)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle();

  const basePolicy: GradingPolicy = resolvedCoursePolicy
    ? mapPolicyRecord(resolvedCoursePolicy)
    : defaultPolicy
    ? mapPolicyRecord(defaultPolicy)
    : {
        id: 'default-policy',
        courseId: null,
        name: 'NEWSIM Standard Maritime Grading Policy (60% Practical / 40% Written / 70% Passing)',
        attendanceWeight: 0,
        practicalWeight: 60,
        moduleQuizWeight: 40,
        passingGrade: 70,
        minAttendancePct: 80,
        lateCreditPct: 75,
        excusedMode: 'EXCLUDE',
        practicalCompetencyRequired: true,
        status: 'ACTIVE',
      };

  // Full Modular / In-House courses are 100% Modular Quizzes (no practical phase or physical attendance)
  if (isInHouseModularCourse(courseCategory, coursePracticalDays)) {
    return {
      ...basePolicy,
      name: 'NEWSIM Full Modular Grading Policy (100% Modular Quizzes / 70% Passing)',
      attendanceWeight: 0,
      practicalWeight: 0,
      moduleQuizWeight: 100,
      practicalCompetencyRequired: false,
    };
  }

  return basePolicy;
}

/**
 * Retrieve all grading policies (Course-specific & Institutional).
 */
export async function getGradingPoliciesList() {
  const { data, error } = await supabaseAdmin
    .from('grading_policies')
    .select('*, courses(id, code, name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row: any) => {
    const courseObj = Array.isArray(row.courses) ? row.courses[0] || null : row.courses || null;
    const mapped = mapPolicyRecord(row);
    return {
      ...row,
      ...mapped,
      courses: courseObj,
      courseName: courseObj?.name || 'All Courses (Default)',
      courseCode: courseObj?.code || 'INSTITUTIONAL',
    };
  });
}

/**
 * Save or update a Course Grading Policy.
 * Validates that weights sum to exactly 100%.
 */
export async function saveGradingPolicy(policy: {
  id?: string;
  courseId?: string | null;
  name: string;
  attendanceWeight: number;
  practicalWeight: number;
  moduleQuizWeight: number;
  passingGrade: number;
  minAttendancePct: number;
  lateCreditPct: number;
  excusedMode?: string;
  practicalCompetencyRequired?: boolean;
  status?: string;
  userId?: string;
}) {
  const totalWeight = Number(policy.attendanceWeight) + Number(policy.practicalWeight) + Number(policy.moduleQuizWeight);
  if (totalWeight !== 100) {
    throw new Error(`Grading policy weights must sum to 100%. Currently sums to ${totalWeight}%.`);
  }

  const rawExcusedMode = (policy.excusedMode || 'EXCLUDE').toUpperCase();
  const normalizedExcusedMode =
    rawExcusedMode === 'EXCLUDE_FROM_TOTAL' || rawExcusedMode === 'EXCLUDE'
      ? 'EXCLUDE'
      : rawExcusedMode === 'FULL_CREDIT'
      ? 'FULL_CREDIT'
      : rawExcusedMode === 'NO_CREDIT'
      ? 'NO_CREDIT'
      : 'EXCLUDE';

  const payload: any = {
    course_id: policy.courseId || null,
    name: policy.name,
    attendance_weight: policy.attendanceWeight,
    practical_weight: policy.practicalWeight,
    module_quiz_weight: policy.moduleQuizWeight,
    passing_grade: policy.passingGrade,
    min_attendance_pct: policy.minAttendancePct,
    late_credit_pct: policy.lateCreditPct,
    excused_mode: normalizedExcusedMode,
    practical_competency_required: policy.practicalCompetencyRequired ?? true,
    status: policy.status || 'ACTIVE',
    updated_at: new Date().toISOString(),
  };

  if (policy.id && policy.id !== 'default-policy') {
    const { data: updated, error } = await supabaseAdmin
      .from('grading_policies')
      .update(payload)
      .eq('id', policy.id)
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: policy.userId,
      action: 'GRADING_POLICY_UPDATED',
      entity_type: 'GRADING_POLICY',
      entity_id: policy.id,
      new_values: payload,
    });

    return updated;
  } else {
    payload.created_by = policy.userId || null;
    const { data: created, error } = await supabaseAdmin
      .from('grading_policies')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: policy.userId,
      action: 'GRADING_POLICY_CREATED',
      entity_type: 'GRADING_POLICY',
      entity_id: created.id,
      new_values: payload,
    });

    return created;
  }
}

/**
 * Calculate Trainee Course Grade with Full Component Breakdown & Transparency.
 * Adheres strictly to Section 4:
 * 1. Normalized components (Attendance, Practical, Module Quizzes).
 * 2. Does NOT treat pending or unrecorded grades as zero.
 * 3. Enforces mandatory maritime competency & minimum attendance percentage.
 */
export async function calculateTraineeCourseGrade(params: {
  traineeId: string;
  courseId: string;
}): Promise<CourseGradeBreakdown> {
  const { traineeId, courseId } = params;

  // 1. Fetch Course info, Active Policy, Schedules, Attendance, Practical Rubrics, Practical Evaluations, and Assessments in parallel
  const [
    courseRes,
    policy,
    courseSchedsRes,
    traineeAttendanceRes,
    courseRubricsRes,
    allPracticalEvalsRes,
    moduleAssessmentsRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('courses')
      .select('id, code, name, category, practical_days')
      .eq('id', courseId)
      .single(),
    getGradingPolicy(courseId),
    supabaseAdmin
      .from('schedules')
      .select('id')
      .eq('course_id', courseId),
    supabaseAdmin
      .from('attendance')
      .select('id, status, check_in_at, session_date, remarks, course_id, schedule_id')
      .eq('trainee_id', traineeId),
    supabaseAdmin
      .from('practical_rubrics')
      .select('id, title, stcw_reference, passing_score, max_score')
      .eq('course_id', courseId)
      .eq('status', 'ACTIVE'),
    supabaseAdmin
      .from('practical_evaluations')
      .select(`
        id,
        rubric_id,
        attempt_number,
        is_latest,
        total_score,
        max_possible_score,
        percentage,
        competency_status,
        status,
        general_feedback,
        strengths,
        improvements_required,
        remediation_plan,
        evaluation_date
      `)
      .eq('course_id', courseId)
      .eq('trainee_id', traineeId)
      .order('attempt_number', { ascending: false }),
    supabaseAdmin
      .from('assessments')
      .select('id, title, module_id, passing_score, assessment_type, assessment_questions(id)')
      .eq('course_id', courseId)
      .neq('status', 'ARCHIVED'),
  ]);

  const course = courseRes.data;
  const isFullModular = isInHouseModularCourse(course?.category, course?.practical_days);
  const courseScheds = courseSchedsRes.data;
  const courseSchedIdSet = new Set<string>((courseScheds || []).map((s: any) => s.id).filter(Boolean));
  const rawAttendanceRows = isFullModular
    ? []
    : (traineeAttendanceRes.data || []).filter(
        (att: any) => att.course_id === courseId || (att.schedule_id && courseSchedIdSet.has(att.schedule_id))
      );
  const courseRubrics = isFullModular ? [] : courseRubricsRes.data;
  const allPracticalEvals = isFullModular ? [] : allPracticalEvalsRes.data;
  const moduleAssessments = (moduleAssessmentsRes.data || []).filter((a: any) => {
    const qCount = Array.isArray(a.assessment_questions) ? a.assessment_questions.length : 0;
    return qCount > 0;
  });

  // 2. Attendance Component Computation (matches both direct course_id and course schedule_id records)
  const attendanceRows = (rawAttendanceRows || []).filter((att: any) => {
    const st = (att.status || '').toUpperCase();
    return ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'].includes(st);
  });

  const totalSessions = isFullModular ? 0 : attendanceRows.length;
  let presentSessions = 0;
  let lateSessions = 0;
  let excusedSessions = 0;
  let absentSessions = 0;

  attendanceRows.forEach((att: any) => {
    const st = (att.status || '').toUpperCase();
    if (st === 'PRESENT') presentSessions++;
    else if (st === 'LATE') lateSessions++;
    else if (st === 'EXCUSED') excusedSessions++;
    else if (st === 'ABSENT') absentSessions++;
  });

  let attendanceScore: number | null = null;
  let attendancePct = 0;
  let attendanceStatus: 'PENDING' | 'COMPLETED' | 'NOT_STARTED' | 'FAILED' = isFullModular ? 'COMPLETED' : 'NOT_STARTED';

  if (!isFullModular) {
    if (totalSessions > 0) {
      let effectiveDenominator = totalSessions;
      if (policy.excusedMode === 'EXCLUDE') {
        effectiveDenominator = Math.max(1, totalSessions - excusedSessions);
      }

      const earnedUnits = (presentSessions * 100) + (lateSessions * policy.lateCreditPct) + (policy.excusedMode === 'FULL_CREDIT' ? excusedSessions * 100 : 0);
      attendanceScore = Math.min(100, Math.round(earnedUnits / effectiveDenominator));
      attendancePct = Math.round(((presentSessions + lateSessions) / totalSessions) * 100);
      attendanceStatus = attendancePct >= policy.minAttendancePct ? 'COMPLETED' : 'FAILED';
    } else {
      attendanceStatus = 'PENDING';
    }
  }

  const effectiveAttendanceWeight = isFullModular ? 0 : policy.attendanceWeight;
  const attendanceContribution = !isFullModular && attendanceScore !== null
    ? Number(((attendanceScore * effectiveAttendanceWeight) / 100).toFixed(2))
    : null;

  const attendanceComponent: ComponentGrade = {
    name: isFullModular ? 'Attendance (Not Required — Full Modular Course)' : 'Attendance and Punctuality',
    weight: effectiveAttendanceWeight,
    score: isFullModular ? null : attendanceScore,
    maxScore: 100,
    contribution: attendanceContribution,
    status: attendanceStatus,
    details: {
      isFullModular,
      totalSessions,
      presentSessions,
      lateSessions,
      excusedSessions,
      absentSessions,
      attendancePercentage: attendancePct,
      requiredMinimumPct: isFullModular ? 0 : policy.minAttendancePct,
      lateCreditPct: policy.lateCreditPct,
    },
  };

  // 3. Practical Assessment Component Computation (60% Weight - All Competencies Must Pass)
  // Map latest evaluation per rubric
  const rubricEvalMap = new Map<string, any>();
  const rubricAttemptsCountMap = new Map<string, number>();

  (allPracticalEvals || []).forEach((ev: any) => {
    const curCount = rubricAttemptsCountMap.get(ev.rubric_id) || 0;
    rubricAttemptsCountMap.set(ev.rubric_id, curCount + 1);
    if (!rubricEvalMap.has(ev.rubric_id) || ev.is_latest) {
      rubricEvalMap.set(ev.rubric_id, ev);
    }
  });

  const rubricsList = courseRubrics || [];
  let allPracticalPassed = false;
  let practicalCompetencyMet = false;
  let practicalScore: number | null = null;
  let practicalStatus: 'PENDING' | 'COMPLETED' | 'NOT_STARTED' | 'FAILED' = 'NOT_STARTED';
  let anyFailedRetakeEligible = false;
  let anyAssessed = false;

  const practicalExerciseDetails: Array<{
    rubricId: string;
    title: string;
    attempts: number;
    latestPercentage: number | null;
    competencyStatus: string;
    isPassed: boolean;
    feedback: string;
  }> = [];

  if (rubricsList.length > 0) {
    let passedExercisesCount = 0;
    let sumPercentage = 0;

    rubricsList.forEach((rub: any) => {
      const ev = rubricEvalMap.get(rub.id);
      const attemptsCount = rubricAttemptsCountMap.get(rub.id) || 0;
      const isCompetent = ev ? (ev.competency_status === 'COMPETENT') : false;
      const pct = ev ? Number(ev.percentage) : null;
      if (pct !== null) sumPercentage += pct;

      if (ev) {
        anyAssessed = true;
        if (isCompetent) {
          passedExercisesCount++;
        } else if (ev.status === 'FINALIZED') {
          anyFailedRetakeEligible = true;
        }
      }

      practicalExerciseDetails.push({
        rubricId: rub.id,
        title: rub.title,
        attempts: attemptsCount,
        latestPercentage: pct,
        competencyStatus: ev ? (ev.competency_status || 'NOT_EVALUATED') : 'NOT_ASSESSED',
        isPassed: isCompetent,
        feedback: ev?.general_feedback || '',
      });
    });

    allPracticalPassed = passedExercisesCount === rubricsList.length;
    practicalCompetencyMet = allPracticalPassed;

    if (allPracticalPassed) {
      practicalScore = rubricsList.length > 0
        ? Math.round(sumPercentage / rubricsList.length)
        : 100;
      practicalStatus = 'COMPLETED';
    } else if (anyFailedRetakeEligible) {
      practicalScore = rubricsList.length > 0 ? Math.round(sumPercentage / rubricsList.length) : 0;
      practicalStatus = 'FAILED'; // Eligible for retake!
    } else if (anyAssessed) {
      practicalScore = rubricsList.length > 0 ? Math.round(sumPercentage / rubricsList.length) : null;
      practicalStatus = 'PENDING';
    } else {
      practicalStatus = 'NOT_STARTED';
    }
  } else {
    // Fallback: check direct practical evaluation record or assessment attempt
    const latestDirectEval = (allPracticalEvals || [])[0];
    if (latestDirectEval) {
      anyAssessed = true;
      practicalScore = Number(latestDirectEval.percentage);
      practicalCompetencyMet = latestDirectEval.competency_status === 'COMPETENT';
      allPracticalPassed = practicalCompetencyMet;
      if (!practicalCompetencyMet && latestDirectEval.status === 'FINALIZED') {
        anyFailedRetakeEligible = true;
      }
      practicalStatus = ['FINALIZED', 'SUBMITTED'].includes((latestDirectEval.status || '').toUpperCase())
        ? (practicalCompetencyMet ? 'COMPLETED' : 'FAILED')
        : 'PENDING';
      practicalExerciseDetails.push({
        rubricId: latestDirectEval.rubric_id || 'direct',
        title: 'Maritime Practical Demonstration',
        attempts: (allPracticalEvals || []).length,
        latestPercentage: practicalScore,
        competencyStatus: latestDirectEval.competency_status,
        isPassed: practicalCompetencyMet,
        feedback: latestDirectEval.general_feedback || '',
      });
    } else {
      practicalStatus = 'NOT_STARTED';
    }
  }

  // STCW Attendance Deductions on Practical Assessment:
  // Practical training attendance is mandatory.
  // Each unexcused absence deducts 15 points; each late deducts 5 points.
  const attendancePracticalDeductions = (absentSessions * 15) + (lateSessions * 5);
  let attendanceCausedPracticalFailure = false;

  if (attendancePracticalDeductions > 0 && practicalScore !== null) {
    practicalScore = Math.max(0, practicalScore - attendancePracticalDeductions);
    if (practicalScore < (policy.passingGrade ?? 70)) {
      allPracticalPassed = false;
      practicalCompetencyMet = false;
      practicalStatus = 'FAILED';
      attendanceCausedPracticalFailure = true;
    }
  }

  if (totalSessions > 0 && attendancePct < policy.minAttendancePct) {
    allPracticalPassed = false;
    practicalCompetencyMet = false;
    practicalStatus = 'FAILED';
    attendanceCausedPracticalFailure = true;
  }

  const practicalWeight = isFullModular ? 0 : (policy.practicalWeight != null ? policy.practicalWeight : 60);

  if (isFullModular) {
    allPracticalPassed = true;
    practicalCompetencyMet = true;
    practicalScore = null;
    practicalStatus = 'COMPLETED';
    attendanceCausedPracticalFailure = false;
  }

  const practicalContribution = isFullModular
    ? 0.0
    : (allPracticalPassed && practicalScore !== null)
    ? Number(((practicalScore * practicalWeight) / 100).toFixed(2))
    : 0.0;
  const provisionalPracticalPoints = !isFullModular && practicalScore !== null
    ? Number(((practicalScore * practicalWeight) / 100).toFixed(2))
    : null;

  const practicalComponent: ComponentGrade = {
    name: isFullModular
      ? 'Practical Assessments (Not Required — Full Modular Course)'
      : `Practical Maritime Assessments (${practicalWeight}% Weight)`,
    weight: practicalWeight,
    score: isFullModular ? null : practicalScore,
    maxScore: 100,
    contribution: practicalContribution,
    status: practicalStatus,
    details: {
      isFullModular,
      allCompetenciesCompleted: allPracticalPassed,
      competencyStatus: isFullModular
        ? 'NOT_REQUIRED'
        : (allPracticalPassed
          ? 'COMPETENT'
          : (anyFailedRetakeEligible ? 'NOT_YET_COMPETENT' : (anyAssessed ? 'PENDING' : 'NOT_ASSESSED'))),
      requiredExercisesCount: isFullModular ? 0 : rubricsList.length,
      passedExercisesCount: isFullModular ? 0 : practicalExerciseDetails.filter(e => e.isPassed).length,
      exercises: isFullModular ? [] : practicalExerciseDetails,
      provisionalPoints: provisionalPracticalPoints,
      attendanceDeduction: isFullModular ? 0 : attendancePracticalDeductions,
      absentSessions,
      lateSessions,
      retakeEligible: !isFullModular && !allPracticalPassed && practicalExerciseDetails.some(e => !e.isPassed && e.attempts > 0),
    },
  };

  // 4. Written Assessment Component Computation (40% Weight - Minimum 70% Required to Pass)
  const modAssessmentIds = (moduleAssessments || []).map((a: any) => a.id);
  let writtenScore: number | null = null;
  let writtenStatus: 'PENDING' | 'COMPLETED' | 'NOT_STARTED' | 'FAILED' = 'NOT_STARTED';
  const quizScores: Array<{
    assessmentId: string;
    title: string;
    score: number;
    passed: boolean;
    attemptNumber: number;
    passingScoreRequired: number;
  }> = [];

  let allWrittenPassed = false;
  let writtenAverageMet = false;

  if (modAssessmentIds.length > 0) {
    const { data: attempts } = await supabaseAdmin
      .from('assessment_attempts')
      .select('assessment_id, attempt_number, score, status, passed, submitted_at')
      .eq('trainee_id', traineeId)
      .in('assessment_id', modAssessmentIds)
      .order('submitted_at', { ascending: false });

    // Map latest attempt per assessment
    const latestAttemptMap = new Map<string, any>();
    (attempts || []).forEach((att: any) => {
      if (!latestAttemptMap.has(att.assessment_id)) {
        latestAttemptMap.set(att.assessment_id, att);
      }
    });

    let takenCount = 0;
    let sumScore = 0;
    let failedIndividualWritten = false;

    (moduleAssessments || []).forEach((asm: any) => {
      const att = latestAttemptMap.get(asm.id);
      const minRequired = asm.passing_score || 70;
      if (att) {
        const sc = Number(att.score) || 0;
        sumScore += sc;
        takenCount++;
        const isPassed = sc >= minRequired;
        if (!isPassed) failedIndividualWritten = true;

        quizScores.push({
          assessmentId: asm.id,
          title: asm.title,
          score: sc,
          passed: isPassed,
          attemptNumber: att.attempt_number || 1,
          passingScoreRequired: minRequired,
        });
      } else {
        quizScores.push({
          assessmentId: asm.id,
          title: asm.title,
          score: 0,
          passed: false,
          attemptNumber: 0,
          passingScoreRequired: minRequired,
        });
      }
    });

    if (takenCount > 0) {
      writtenScore = Number((sumScore / takenCount).toFixed(1));
      writtenAverageMet = writtenScore >= 70;
      allWrittenPassed = takenCount === modAssessmentIds.length && !failedIndividualWritten && writtenAverageMet;
      writtenStatus = takenCount === modAssessmentIds.length
        ? (allWrittenPassed ? 'COMPLETED' : 'FAILED')
        : 'PENDING';
    } else {
      writtenScore = null;
      writtenAverageMet = false;
      allWrittenPassed = false;
      writtenStatus = 'NOT_STARTED';
    }
  } else {
    // If course has no standalone module quizzes configured in DB
    const hasModuleWeight = (policy.moduleQuizWeight || 0) > 0;
    if (hasModuleWeight) {
      allWrittenPassed = false;
      writtenAverageMet = false;
      writtenScore = null;
      writtenStatus = 'PENDING';
    } else {
      allWrittenPassed = true;
      writtenAverageMet = true;
      writtenScore = 100;
      writtenStatus = 'COMPLETED';
    }
  }

  // Written contribution: Written Assessment Percentage * (moduleQuizWeight / 100)
  const moduleWeight = isFullModular ? 100 : (policy.moduleQuizWeight != null ? policy.moduleQuizWeight : 40);
  const provisionalWrittenPoints = writtenScore !== null
    ? Number(((writtenScore * moduleWeight) / 100).toFixed(2))
    : null;
  const writtenContribution = provisionalWrittenPoints ?? 0.0;

  const moduleComponent: ComponentGrade = {
    name: isFullModular
      ? `Modular Quizzes (${moduleWeight}% Weight - Min 70% Overall / 75% per Quiz)`
      : `Written Assessments (${moduleWeight}% Weight - Min 70% to Pass)`,
    weight: moduleWeight,
    score: writtenScore,
    maxScore: 100,
    contribution: writtenContribution,
    status: writtenStatus,
    details: {
      totalAssessments: modAssessmentIds.length,
      completedAssessments: quizScores.filter(q => q.attemptNumber > 0).length,
      totalQuizzes: modAssessmentIds.length,
      completedQuizzes: quizScores.filter(q => q.attemptNumber > 0).length,
      allWrittenPassed,
      writtenAverageMet,
      assessments: quizScores,
    },
  };

  // 5. Final Course Completion Decision & Integrity Rules
  const mandatoryRemarks: string[] = [];
  let mandatoryRequirementsMet = true;

  // Check Attendance Quorum (Min 80%) — skipped for Full Modular courses
  const attendancePassed = isFullModular || totalSessions === 0 ? true : attendancePct >= policy.minAttendancePct;
  if (!isFullModular && !attendancePassed) {
    mandatoryRequirementsMet = false;
    mandatoryRemarks.push(`Attendance quorum failed: Candidate attended ${attendancePct}% (required STCW minimum is ${policy.minAttendancePct}%).`);
  }

  if (!isFullModular && attendanceCausedPracticalFailure) {
    mandatoryRequirementsMet = false;
    mandatoryRemarks.push(
      `Practical assessment failed due to attendance deductions (-${attendancePracticalDeductions} pts from ${absentSessions} absent, ${lateSessions} late sessions). Certificate release blocked.`
    );
  }

  // Check Practical Assessment (All competencies must be passed) — skipped for Full Modular courses
  if (!isFullModular && !allPracticalPassed) {
    mandatoryRequirementsMet = false;
    mandatoryRemarks.push('Practical maritime competencies incomplete or pending retake: Candidate must successfully demonstrate all required exercises.');
  }

  // Check Written Assessment (Must score at least 70% and pass each required assessment)
  if (!allWrittenPassed) {
    mandatoryRequirementsMet = false;
    if (writtenScore !== null && writtenScore < 70) {
      mandatoryRemarks.push(`Modular quiz average (${writtenScore}%) does not meet mandatory 70% passing threshold.`);
    } else {
      const failedQuiz = quizScores.find((q) => q.attemptNumber > 0 && !q.passed);
      if (failedQuiz) {
        mandatoryRemarks.push(
          `"${failedQuiz.title}" scored ${failedQuiz.score}% (requires ${failedQuiz.passingScoreRequired}% — retake available before deadline).`
        );
      } else {
        mandatoryRemarks.push('One or more required modular quizzes remain unpassed or pending.');
      }
    }
  }

  // Overall Score Calculation:
  // If in progress or pending, compute provisional weighted score from attempted components
  const hasPending =
    (!isFullModular && (practicalStatus === 'PENDING' || practicalStatus === 'NOT_STARTED')) ||
    writtenStatus === 'PENDING' ||
    writtenStatus === 'NOT_STARTED' ||
    (modAssessmentIds.length > 0 && quizScores.filter(q => q.attemptNumber > 0).length < modAssessmentIds.length);
  
  let overallScore: number | null = null;
  let finalStatus: 'PASSED' | 'FAILED' | 'IN_PROGRESS' | 'NEEDS_REMEDIATION' | 'PENDING_GRADING' = 'IN_PROGRESS';
  let passed = false;

  // Calculate weighted total cleanly (showing real earned points even when pending or needing quiz retake)
  const practicalPoints = isFullModular ? 0.0 : (provisionalPracticalPoints ?? practicalContribution ?? 0.0);
  const writtenPoints = provisionalWrittenPoints ?? 0.0;
  const attendancePoints = isFullModular ? 0.0 : (attendanceContribution || 0.0);
  overallScore = Number((practicalPoints + writtenPoints + attendancePoints).toFixed(1));

  if (hasPending) {
    finalStatus = 'IN_PROGRESS';
    passed = false;
  } else {
    if (allPracticalPassed && allWrittenPassed && overallScore >= policy.passingGrade && attendancePassed) {
      finalStatus = 'PASSED';
      passed = true;
    } else if (!allWrittenPassed && writtenScore !== null && writtenScore < 70) {
      finalStatus = 'FAILED';
      passed = false;
    } else if (!allWrittenPassed || !allPracticalPassed) {
      finalStatus = 'NEEDS_REMEDIATION';
      passed = false;
    } else if (!attendancePassed) {
      finalStatus = 'FAILED';
      passed = false;
    } else {
      finalStatus = 'FAILED';
      passed = false;
    }
  }

  let statusRemarks = '';
  if (passed) {
    statusRemarks = isFullModular
      ? `PASSED (Full Modular Course): All modular quizzes passed (${writtenScore}%). Final Grade: ${overallScore}%.`
      : `PASSED: All practical competencies certified (${practicalContribution.toFixed(1)} pts) and written assessment passed (${writtenScore}%). Final Grade: ${overallScore}%.`;
  } else if (!allWrittenPassed && (writtenScore !== null && writtenScore < 70)) {
    statusRemarks = isFullModular
      ? `FAIL / NOT YET QUALIFIED: Modular quiz average (${writtenScore}%) is below the mandatory 70% passing threshold.`
      : `FAIL / NOT YET QUALIFIED: Written examination score (${writtenScore}%) is below the mandatory 70% passing threshold, despite practical performance (Calculated: ${overallScore}%).`;
  } else if (!isFullModular && !allPracticalPassed) {
    statusRemarks = `NOT YET QUALIFIED: Practical maritime exercises incomplete or pending successful retake. Trainee must demonstrate all required practical competencies.`;
  } else if (!isFullModular && !attendancePassed) {
    statusRemarks = `FAIL: Attendance quorum (${attendancePct}%) does not satisfy minimum requirement of ${policy.minAttendancePct}%.`;
  } else {
    statusRemarks = mandatoryRemarks.join(' ') || 'Training requirements in progress.';
  }

  const breakdown: CourseGradeBreakdown = {
    traineeId,
    courseId,
    courseName: course?.name || 'Maritime Training Program',
    courseCode: course?.code || 'STCW',
    courseCategory: course?.category || 'Safety and Other STCW Courses',
    deliveryMode: isFullModular ? 'FULL_MODULAR' : 'MODULAR_AND_PRACTICAL',
    requiresPractical: !isFullModular,
    policyId: policy.id,
    policyName: policy.name,
    attendanceComponent,
    practicalComponent,
    moduleComponent,
    overallScore,
    passingGrade: policy.passingGrade,
    passed,
    finalStatus,
    statusRemarks,
    mandatoryRequirementsMet,
    mandatoryRemarks,
    isFinal: !hasPending && finalStatus === 'PASSED',
    lastUpdated: new Date().toISOString(),
  };

  // Sync snapshot into grades table
  try {
    const { data: enr } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('trainee_id', traineeId)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!enr) {
      // Trainee is not enrolled in this course — do not create or upsert a stray grade record
      return breakdown;
    }

    await supabaseAdmin.from('grades').upsert({
      trainee_id: traineeId,
      course_id: courseId,
      enrollment_id: enr.id,
      final_score: overallScore,
      attendance_score: isFullModular ? null : attendanceScore,
      practical_score: isFullModular ? null : practicalScore,
      module_score: writtenScore,
      policy_id: policy.id !== 'default-policy' ? policy.id : null,
      grade: finalStatus,
      status: finalStatus,
      breakdown,
      remarks: breakdown.statusRemarks,
      graded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'trainee_id,course_id' });

    // When candidate passes both practical and written assessments with required attendance:
    // 1. Mark enrollment COMPLETED so trainee can progress to next course
    // 2. Ensure official certificate record is active in certificates table
    if (!hasPending && passed && finalStatus === 'PASSED' && mandatoryRequirementsMet) {
      await supabaseAdmin
        .from('enrollments')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('trainee_id', traineeId)
        .eq('course_id', courseId)
        .in('status', ['ENROLLED', 'ACTIVE', 'APPROVED', 'ONGOING']);

      const { data: existingCerts } = await supabaseAdmin
        .from('certificates')
        .select('id, status, enrollment_id')
        .eq('trainee_id', traineeId)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      const existingCert = (existingCerts || [])[0];
      const issuedIso = new Date().toISOString();
      const expiresDate = new Date();
      expiresDate.setFullYear(expiresDate.getFullYear() + 5);
      const expiresIso = expiresDate.toISOString();

      if (!existingCert) {
        const certNumber = `NEWSIM-${(course?.code || 'STCW').toUpperCase()}-${new Date().getFullYear()}-${crypto.randomInt(1000, 10000)}`;
        const verHash = crypto
          .createHash('sha256')
          .update(`${certNumber}:${traineeId}:${courseId}`)
          .digest('hex')
          .slice(0, 24)
          .toUpperCase();
        await supabaseAdmin.from('certificates').insert({
          trainee_id: traineeId,
          course_id: courseId,
          enrollment_id: enr.id,
          certificate_number: certNumber,
          status: 'ISSUED',
          issued_at: issuedIso,
          expires_at: expiresIso,
          qr_code: `V-${certNumber}`,
          verification_hash: verHash,
        });
      } else if (existingCert.status !== 'REVOKED' && (existingCert.status === 'WITHHELD' || existingCert.status === 'PENDING')) {
        await supabaseAdmin
          .from('certificates')
          .update({
            status: 'ISSUED',
            issued_at: issuedIso,
            expires_at: expiresIso,
            enrollment_id: existingCert.enrollment_id || enr.id,
          })
          .eq('id', existingCert.id);
      }
    } else {
      // If there is ANY pending requirement, or if the trainee has not passed,
      // the certificate MUST NOT be active/issued!
      const { data: existingCerts } = await supabaseAdmin
        .from('certificates')
        .select('id, status')
        .eq('trainee_id', traineeId)
        .eq('course_id', courseId);

      for (const cert of (existingCerts || [])) {
        if (cert.status === 'ISSUED' || cert.status === 'ACTIVE') {
          await supabaseAdmin
            .from('certificates')
            .update({
              status: 'WITHHELD',
            })
            .eq('id', cert.id);
        }
      }
    }
  } catch (gradeSyncErr) {
    console.warn('Sync to grades/enrollment table error:', gradeSyncErr);
  }

  return breakdown;
}

function mapPolicyRecord(row: any): GradingPolicy {
  return {
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    attendanceWeight: row.attendance_weight != null ? Number(row.attendance_weight) : 0,
    practicalWeight: row.practical_weight != null ? Number(row.practical_weight) : 60,
    moduleQuizWeight: row.module_quiz_weight != null ? Number(row.module_quiz_weight) : 40,
    passingGrade: row.passing_grade != null ? Number(row.passing_grade) : 70,
    minAttendancePct: row.min_attendance_pct != null ? Number(row.min_attendance_pct) : 80,
    lateCreditPct: row.late_credit_pct != null ? Number(row.late_credit_pct) : 75,
    excusedMode: row.excused_mode || 'EXCLUDE',
    practicalCompetencyRequired: row.practical_competency_required ?? true,
    status: row.status || 'ACTIVE',
  };
}
