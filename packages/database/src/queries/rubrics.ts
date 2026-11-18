import { supabaseAdmin } from '../supabase';
import { dispatchNotificationEvent, NOTIFICATION_EVENTS } from './notifications';
import { calculateTraineeCourseGrade, isInHouseModularCourse } from './grading';
import { getInstructorCourseIds } from './instructor-portal';

export interface RubricCriterion {
  id: string;
  criterionName: string;
  description: string;
  competency: string;
  performanceIndicators: string;
  maxPoints: number;
  weightPct: number;
  sortOrder: number;
  isCritical: boolean;
  ratingLevels: Array<{ level: string; points: number; description: string }>;
}

export interface PracticalRubric {
  id: string;
  courseId: string;
  courseName?: string;
  courseCode?: string;
  assessmentId?: string;
  title: string;
  stcwReference?: string;
  description?: string;
  instructions?: string;
  passingScore: number;
  maxScore: number;
  status: string;
  criteria: RubricCriterion[];
}

export interface PracticalEvaluationDetail {
  id?: string;
  rubricId: string;
  assessmentId?: string;
  courseId: string;
  batchId?: string;
  traineeId: string;
  traineeName?: string;
  traineeSrn?: string;
  instructorId: string;
  instructorName?: string;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  competencyStatus: 'COMPETENT' | 'NOT_YET_COMPETENT' | 'REMEDIATION_REQUIRED';
  status: 'DRAFT' | 'SUBMITTED' | 'FINALIZED';
  generalFeedback: string;
  strengths: string;
  improvementsRequired: string;
  remediationPlan: string;
  evaluationDate: string;
  finalizedAt?: string;
  scores: Array<{
    criterionId: string;
    criterionName?: string;
    score: number;
    maxPoints?: number;
    isCritical?: boolean;
    ratingLabel?: string;
    comments?: string;
  }>;
}

/**
 * Retrieve rubrics for a course or all active rubrics.
 */
export async function getPracticalRubricsList(courseId?: string): Promise<PracticalRubric[]> {
  let query = supabaseAdmin
    .from('practical_rubrics')
    .select(`
      id,
      course_id,
      assessment_id,
      title,
      stcw_reference,
      description,
      instructions,
      passing_score,
      max_score,
      status,
      courses ( id, code, name, category, practical_days )
    `)
    .eq('status', 'ACTIVE');

  if (courseId) {
    query = query.eq('course_id', courseId);
  }

  const { data: rubrics, error } = await query;
  if (error) throw error;

  // Full modular courses must never expose practical rubrics
  const rubricsList = (rubrics || []).filter((r: any) => {
    const courseRel = Array.isArray(r.courses) ? r.courses[0] : r.courses;
    return !isInHouseModularCourse(courseRel?.category, courseRel?.practical_days);
  });
  if (rubricsList.length === 0) return [];

  const rubricIds = rubricsList.map((r: any) => r.id).filter(Boolean);
  const { data: allCriteria } = await supabaseAdmin
    .from('practical_rubric_criteria')
    .select('*')
    .in('rubric_id', rubricIds)
    .order('sort_order', { ascending: true });

  const criteriaByRubricId = new Map<string, any[]>();
  (allCriteria || []).forEach((c: any) => {
    const list = criteriaByRubricId.get(c.rubric_id) || [];
    list.push(c);
    criteriaByRubricId.set(c.rubric_id, list);
  });

  const result: PracticalRubric[] = rubricsList.map((r: any) => {
    const criteria = criteriaByRubricId.get(r.id) || [];
    const courseRel = Array.isArray(r.courses) ? r.courses[0] : r.courses;

    return {
      id: r.id,
      courseId: r.course_id,
      courseName: courseRel?.name || 'Maritime Course',
      courseCode: courseRel?.code || 'STCW',
      assessmentId: r.assessment_id,
      title: r.title,
      stcwReference: r.stcw_reference,
      description: r.description,
      instructions: r.instructions,
      passingScore: Number(r.passing_score) || 75,
      maxScore: Number(r.max_score) || 100,
      status: r.status,
      criteria: criteria.map((c: any) => ({
        id: c.id,
        criterionName: c.criterion_name,
        description: c.description || '',
        competency: c.competency || '',
        performanceIndicators: c.performance_indicators || '',
        maxPoints: Number(c.max_points) || 25,
        weightPct: Number(c.weight_pct) || 25,
        sortOrder: c.sort_order || 1,
        isCritical: Boolean(c.is_critical),
        ratingLevels: Array.isArray(c.rating_levels) ? c.rating_levels : [],
      })),
    };
  });

  return result;
}

/**
 * Get practical rubric by ID with full criteria definitions.
 */
export async function getPracticalRubricDetails(rubricId: string): Promise<PracticalRubric | null> {
  const { data: r, error } = await supabaseAdmin
    .from('practical_rubrics')
    .select(`
      id,
      course_id,
      assessment_id,
      title,
      stcw_reference,
      description,
      instructions,
      passing_score,
      max_score,
      status,
      courses ( id, code, name, category, practical_days )
    `)
    .eq('id', rubricId)
    .maybeSingle();

  if (error || !r) return null;

  const courseRelCheck = Array.isArray(r.courses) ? r.courses[0] : r.courses;
  if (isInHouseModularCourse(courseRelCheck?.category, courseRelCheck?.practical_days)) {
    return null;
  }

  const { data: criteria } = await supabaseAdmin
    .from('practical_rubric_criteria')
    .select('*')
    .eq('rubric_id', r.id)
    .order('sort_order', { ascending: true });

  const courseRel = Array.isArray(r.courses) ? r.courses[0] : r.courses;

  return {
    id: r.id,
    courseId: r.course_id,
    courseName: courseRel?.name || 'Maritime Course',
    courseCode: courseRel?.code || 'STCW',
    assessmentId: r.assessment_id,
    title: r.title,
    stcwReference: r.stcw_reference,
    description: r.description,
    instructions: r.instructions,
    passingScore: Number(r.passing_score) || 75,
    maxScore: Number(r.max_score) || 100,
    status: r.status,
    criteria: (criteria || []).map((c: any) => ({
      id: c.id,
      criterionName: c.criterion_name,
      description: c.description || '',
      competency: c.competency || '',
      performanceIndicators: c.performance_indicators || '',
      maxPoints: Number(c.max_points) || 25,
      weightPct: Number(c.weight_pct) || 25,
      sortOrder: c.sort_order || 1,
      isCritical: Boolean(c.is_critical),
      ratingLevels: Array.isArray(c.rating_levels) ? c.rating_levels : [],
    })),
  };
}

/**
 * Retrieve trainees eligible for practical grading under a specific rubric and batch.
 */
export async function getTraineesForPracticalGrading(params: {
  courseId: string;
  batchId?: string;
  rubricId: string;
  instructorProfileId: string;
}) {
  const { courseId, batchId, rubricId, instructorProfileId } = params;

  const assignedCourseIds = await getInstructorCourseIds(instructorProfileId);
  if (!assignedCourseIds.includes(courseId)) {
    throw new Error('FORBIDDEN: Instructor is not assigned to instruct or grade this course.');
  }

  // 1. Get enrollments for this course and batch
  let enrollQuery = supabaseAdmin
    .from('enrollments')
    .select('id, trainee_id, course_id, batch_id, status')
    .eq('course_id', courseId)
    .in('status', ['ENROLLED', 'ONGOING', 'COMPLETED', 'ACTIVE', 'APPROVED']);

  if (batchId) {
    enrollQuery = enrollQuery.eq('batch_id', batchId);
  }

  const { data: enrollments } = await enrollQuery;
  const traineeIds: string[] = Array.from(new Set((enrollments || []).map((e: any) => e.trainee_id).filter(Boolean))) as string[];

  if (traineeIds.length === 0) return [];

  // 2. Fetch Profiles
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, srn, avatar_url')
    .in('id', traineeIds);

  const { data: traineeMeta } = await supabaseAdmin
    .from('trainees')
    .select('profile_id, trainee_number, gender, srn')
    .in('profile_id', traineeIds);

  const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
  const metaMap = new Map<string, any>((traineeMeta || []).map((t: any) => [t.profile_id, t]));

  // 3. Fetch existing evaluations for this rubric
  const { data: evaluations } = await supabaseAdmin
    .from('practical_evaluations')
    .select('*')
    .eq('rubric_id', rubricId)
    .in('trainee_id', traineeIds);

  const evalMap = new Map<string, any>((evaluations || []).map((ev: any) => [ev.trainee_id, ev]));

  return traineeIds.map((tid: string) => {
    const prof = profileMap.get(tid);
    const meta = metaMap.get(tid);
    const ev = evalMap.get(tid);

    return {
      traineeId: tid,
      traineeName: prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : 'Trainee',
      email: prof?.email || '',
      avatarUrl: prof?.avatar_url || null,
      srn: meta?.srn || prof?.srn || meta?.trainee_number || 'N/A',
      rank: meta?.gender || 'Maritime Cadet',
      evaluationId: ev?.id || null,
      score: ev ? Number(ev.total_score) : null,
      maxScore: ev ? Number(ev.max_possible_score) : 100,
      percentage: ev ? Number(ev.percentage) : null,
      competencyStatus: ev?.competency_status || 'NOT_STARTED',
      status: ev?.status || 'NOT_STARTED',
      evaluationDate: ev?.evaluation_date || null,
      feedback: ev?.general_feedback || '',
    };
  });
}

/**
 * Retrieve single trainee's evaluation details under a rubric.
 */
export async function getTraineeEvaluationDetails(
  rubricId: string,
  traineeId: string,
  instructorProfileId?: string
): Promise<PracticalEvaluationDetail | null> {
  if (instructorProfileId) {
    const { data: rubricRow } = await supabaseAdmin
      .from('practical_rubrics')
      .select('course_id')
      .eq('id', rubricId)
      .maybeSingle();

    if (rubricRow?.course_id) {
      const assignedCourseIds = await getInstructorCourseIds(instructorProfileId);
      if (!assignedCourseIds.includes(rubricRow.course_id)) {
        throw new Error('FORBIDDEN: Instructor is not assigned to this evaluation course.');
      }
    }
  }

  const { data: ev, error } = await supabaseAdmin
    .from('practical_evaluations')
    .select(`
      *,
      profiles!practical_evaluations_trainee_id_fkey ( first_name, last_name, srn ),
      instructors:profiles!practical_evaluations_instructor_id_fkey ( first_name, last_name )
    `)
    .eq('rubric_id', rubricId)
    .eq('trainee_id', traineeId)
    .maybeSingle();

  if (error || !ev) return null;

  const { data: scores } = await supabaseAdmin
    .from('practical_evaluation_scores')
    .select(`
      criterion_id,
      score,
      rating_label,
      comments,
      practical_rubric_criteria ( criterion_name, max_points, is_critical )
    `)
    .eq('evaluation_id', ev.id);

  const traineeProf = (ev as any).profiles;
  const instructorProf = (ev as any).instructors;

  return {
    id: ev.id,
    rubricId: ev.rubric_id,
    assessmentId: ev.assessment_id,
    courseId: ev.course_id,
    batchId: ev.batch_id,
    traineeId: ev.trainee_id,
    traineeName: traineeProf ? `${traineeProf.first_name || ''} ${traineeProf.last_name || ''}`.trim() : 'Trainee',
    traineeSrn: traineeProf?.srn || 'N/A',
    instructorId: ev.instructor_id,
    instructorName: instructorProf ? `Capt. ${instructorProf.first_name || ''} ${instructorProf.last_name || ''}`.trim() : 'Instructor',
    totalScore: Number(ev.total_score),
    maxPossibleScore: Number(ev.max_possible_score),
    percentage: Number(ev.percentage),
    competencyStatus: ev.competency_status,
    status: ev.status,
    generalFeedback: ev.general_feedback || '',
    strengths: ev.strengths || '',
    improvementsRequired: ev.improvements_required || '',
    remediationPlan: ev.remediation_plan || '',
    evaluationDate: ev.evaluation_date,
    finalizedAt: ev.finalized_at,
    scores: (scores || []).map((s: any) => {
      const crit = s.practical_rubric_criteria;
      return {
        criterionId: s.criterion_id,
        criterionName: crit?.criterion_name || 'Criterion',
        score: Number(s.score),
        maxPoints: Number(crit?.max_points) || 25,
        isCritical: Boolean(crit?.is_critical),
        ratingLabel: s.rating_label || '',
        comments: s.comments || '',
      };
    }),
  };
}

/**
 * Save / Finalize a Practical Assessment Evaluation.
 * Calculates score automatically from rubric criteria.
 * Enforces mandatory maritime competency rules:
 * Failing a critical safety criterion causes NOT_YET_COMPETENT status even if numerical score is passing!
 */
export async function savePracticalEvaluation(params: {
  rubricId: string;
  traineeId: string;
  instructorProfileId: string;
  instructorName?: string;
  courseId: string;
  batchId?: string;
  scores: Array<{ criterionId: string; score: number; ratingLabel?: string; comments?: string }>;
  generalFeedback?: string;
  strengths?: string;
  improvementsRequired?: string;
  remediationPlan?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'FINALIZED';
  amendmentReason?: string;
}) {
  const {
    rubricId,
    traineeId,
    instructorProfileId,
    instructorName,
    courseId,
    batchId,
    scores,
    generalFeedback,
    strengths,
    improvementsRequired,
    remediationPlan,
    status,
    amendmentReason,
  } = params;

  // 1. Verify instructor authorization, active trainee enrollment, and rubric-course ownership
  const assignedCourseIds = await getInstructorCourseIds(instructorProfileId);
  if (!assignedCourseIds.includes(courseId)) {
    throw new Error('FORBIDDEN: Instructor is not assigned to grade practical evaluations for this course.');
  }

  const rubric = await getPracticalRubricDetails(rubricId);
  if (!rubric) throw new Error('Rubric not found');
  if (rubric.courseId !== courseId) {
    throw new Error('FORBIDDEN: Selected rubric does not belong to the specified course.');
  }

  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('trainee_id', traineeId)
    .eq('course_id', courseId)
    .in('status', ['ENROLLED', 'ONGOING', 'COMPLETED', 'ACTIVE', 'APPROVED'])
    .limit(1)
    .maybeSingle();

  if (!enrollment) {
    throw new Error('FORBIDDEN: Trainee does not have an active enrollment in this course.');
  }

  const criteriaMap = new Map(rubric.criteria.map((c) => [c.id, c]));

  let totalScore = 0;
  let maxPossibleScore = 0;
  let failedCriticalCriterion = false;

  rubric.criteria.forEach((crit) => {
    maxPossibleScore += crit.maxPoints;
    const submitted = scores.find((s) => s.criterionId === crit.id);
    const scoreVal = submitted ? Math.min(Math.max(0, Number(submitted.score) || 0), crit.maxPoints) : 0;
    totalScore += scoreVal;

    // Critical check: if critical criterion score is 0 or less than 60% of its max points
    if (crit.isCritical && (scoreVal === 0 || scoreVal < crit.maxPoints * 0.6)) {
      failedCriticalCriterion = true;
    }
  });

  const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
  const isScorePassing = percentage >= rubric.passingScore;

  // Enforce rule 4.4: Numerical grades must not override mandatory practical competency!
  let competencyStatus: 'COMPETENT' | 'NOT_YET_COMPETENT' | 'REMEDIATION_REQUIRED' = 'COMPETENT';
  if (!isScorePassing || failedCriticalCriterion) {
    competencyStatus = percentage >= 60 ? 'REMEDIATION_REQUIRED' : 'NOT_YET_COMPETENT';
  }

  // 2. Upsert practical_evaluations with Finalized Lock & Historical Retake Preservation
  const { data: latestEval } = await supabaseAdmin
    .from('practical_evaluations')
    .select('id, attempt_number, status, competency_status, amendment_count')
    .eq('rubric_id', rubricId)
    .eq('trainee_id', traineeId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestEval?.status === 'FINALIZED' && latestEval.competency_status === 'COMPETENT' && !amendmentReason?.trim()) {
    throw new Error('FORBIDDEN: Practical evaluation is already finalized. Modifications require an authorized amendment reason.');
  }

  let evalId: string;
  let attemptNumber = 1;
  const isRetake = Boolean(latestEval && latestEval.status === 'FINALIZED');

  if (isRetake) {
    attemptNumber = (latestEval.attempt_number || 1) + 1;
    // Mark previous attempts as not latest to preserve full history
    await supabaseAdmin
      .from('practical_evaluations')
      .update({ is_latest: false })
      .eq('rubric_id', rubricId)
      .eq('trainee_id', traineeId);
  } else if (latestEval) {
    attemptNumber = latestEval.attempt_number || 1;
    evalId = latestEval.id;
  }

  const evalPayload: any = {
    rubric_id: rubricId,
    course_id: courseId,
    batch_id: batchId || null,
    trainee_id: traineeId,
    instructor_id: instructorProfileId,
    attempt_number: attemptNumber,
    is_latest: true,
    total_score: totalScore,
    max_possible_score: maxPossibleScore,
    percentage,
    competency_status: competencyStatus,
    status,
    general_feedback: generalFeedback || '',
    strengths: strengths || '',
    improvements_required: improvementsRequired || '',
    remediation_plan: remediationPlan || '',
    evaluation_date: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  };

  if (status === 'FINALIZED') {
    evalPayload.finalized_at = new Date().toISOString();
  }
  if (amendmentReason) {
    evalPayload.amendment_reason = amendmentReason;
  }

  if (latestEval && !isRetake) {
    // Updating existing unfinalized draft
    const { error: updErr } = await supabaseAdmin
      .from('practical_evaluations')
      .update(evalPayload)
      .eq('id', latestEval.id);
    if (updErr) throw updErr;
    evalId = latestEval.id;
  } else {
    // Inserting new attempt (or initial attempt), preserving historical attempts
    const { data: created, error: insErr } = await supabaseAdmin
      .from('practical_evaluations')
      .insert(evalPayload)
      .select('id')
      .single();
    if (insErr) throw insErr;
    evalId = created.id;
  }
  // 3. Upsert criterion scores in a single batch call
  const scoreRows: Array<{
    evaluation_id: string;
    criterion_id: string;
    score: number;
    rating_label: string;
    comments: string;
  }> = [];

  for (const s of scores) {
    const crit = criteriaMap.get(s.criterionId);
    if (!crit) continue;

    const validatedScore = Math.min(Math.max(0, Number(s.score) || 0), crit.maxPoints);
    scoreRows.push({
      evaluation_id: evalId,
      criterion_id: s.criterionId,
      score: validatedScore,
      rating_label: s.ratingLabel || '',
      comments: s.comments || '',
    });
  }

  if (scoreRows.length > 0) {
    await supabaseAdmin
      .from('practical_evaluation_scores')
      .upsert(scoreRows, { onConflict: 'evaluation_id,criterion_id' });
  }

  // 4. Audit Log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: instructorProfileId,
    action: isRetake ? 'PRACTICAL_EVALUATION_RETAKE' : (amendmentReason ? 'PRACTICAL_EVALUATION_AMENDED' : 'PRACTICAL_EVALUATION_SAVED'),
    entity_type: 'PRACTICAL_EVALUATION',
    entity_id: evalId,
    new_values: {
      rubricId,
      traineeId,
      totalScore,
      percentage,
      competencyStatus,
      status,
      failedCriticalCriterion,
      amendmentReason,
    },
  });

  // 5. Trigger course grade calculation & if FINALIZED, dispatch notification
  try {
    await calculateTraineeCourseGrade({ traineeId, courseId });
  } catch (gradeErr) {
    console.warn('Practical evaluation course grade sync error:', gradeErr);
  }

  if (status === 'FINALIZED') {
    try {
      await dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.ASSESSMENT_GRADED,
        traineeId,
        instructorId: instructorProfileId,
        courseId,
        entityType: 'PRACTICAL_EVALUATION',
        entityId: evalId,
        metadata: {
          rubricTitle: rubric.title,
          score: totalScore,
          percentage,
          competencyStatus,
        },
      });
    } catch (notifErr) {
      console.warn('Practical evaluation notification error:', notifErr);
    }
  }

  return {
    success: true,
    evaluationId: evalId,
    totalScore,
    percentage,
    competencyStatus,
    failedCriticalCriterion,
    status,
  };
}


/**
 * Retrieve complete attempt history for a trainee on a practical rubric.
 * Preserves all earlier failed attempts and retakes (Part 1.2).
 */
export async function getTraineeEvaluationHistory(
  rubricId: string,
  traineeId: string,
  instructorProfileId?: string
) {
  if (instructorProfileId) {
    const { data: rubricRow } = await supabaseAdmin
      .from('practical_rubrics')
      .select('course_id')
      .eq('id', rubricId)
      .maybeSingle();

    if (rubricRow?.course_id) {
      const assignedCourseIds = await getInstructorCourseIds(instructorProfileId);
      if (!assignedCourseIds.includes(rubricRow.course_id)) {
        throw new Error('FORBIDDEN: Instructor is not assigned to this evaluation course.');
      }
    }
  }

  const { data: attempts, error } = await supabaseAdmin
    .from('practical_evaluations')
    .select(`
      id,
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
      evaluation_date,
      finalized_at,
      instructors:profiles!practical_evaluations_instructor_id_fkey ( first_name, last_name )
    `)
    .eq('rubric_id', rubricId)
    .eq('trainee_id', traineeId)
    .order('attempt_number', { ascending: true });

  if (error) throw error;
  return attempts || [];
}
