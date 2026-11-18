import { supabaseAdmin } from '../supabase';

export async function getAssessmentById(id: string) {
  const { data, error } = await supabaseAdmin.from('assessments').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listAssessments(filters?: { course_id?: string; module_id?: string; status?: string }) {
  let query = supabaseAdmin.from('assessments').select('*');
  if (filters?.course_id) query = query.eq('course_id', filters.course_id);
  if (filters?.module_id) query = query.eq('module_id', filters.module_id);
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createAssessment(input: any) {
  const { data, error } = await supabaseAdmin.from('assessments').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateAssessment(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('assessments').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAssessment(id: string) {
  const { error } = await supabaseAdmin.from('assessments').delete().eq('id', id);
  if (error) throw error;
}

export async function getAssessmentWithQuestions(id: string) {
  const { data, error } = await supabaseAdmin.from('assessments').select('*, assessment_questions(*, assessment_choices(*))').eq('id', id).single();
  if (error) throw error;
  return data;
}

// Assessment Questions
export async function getQuestionById(id: string) {
  const { data, error } = await supabaseAdmin.from('assessment_questions').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listQuestionsByAssessment(assessment_id: string) {
  const { data, error } = await supabaseAdmin.from('assessment_questions').select('*').eq('assessment_id', assessment_id);
  if (error) throw error;
  return data;
}

export async function createQuestion(input: any) {
  const { data, error } = await supabaseAdmin.from('assessment_questions').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateQuestion(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('assessment_questions').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteQuestion(id: string) {
  const { error } = await supabaseAdmin.from('assessment_questions').delete().eq('id', id);
  if (error) throw error;
}

// Assessment Choices
export async function listChoicesByQuestion(question_id: string) {
  const { data, error } = await supabaseAdmin.from('assessment_choices').select('*').eq('question_id', question_id);
  if (error) throw error;
  return data;
}

export async function createChoice(input: any) {
  const { data, error } = await supabaseAdmin.from('assessment_choices').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateChoice(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('assessment_choices').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteChoice(id: string) {
  const { error } = await supabaseAdmin.from('assessment_choices').delete().eq('id', id);
  if (error) throw error;
}

// Assessment Attempts
export async function getAttemptById(id: string) {
  const { data, error } = await supabaseAdmin.from('assessment_attempts').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listAttempts(filters?: { assessment_id?: string; trainee_id?: string }) {
  let query = supabaseAdmin.from('assessment_attempts').select('*');
  if (filters?.assessment_id) query = query.eq('assessment_id', filters.assessment_id);
  if (filters?.trainee_id) query = query.eq('trainee_id', filters.trainee_id);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createAttempt(input: any) {
  const { data, error } = await supabaseAdmin.from('assessment_attempts').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateAttempt(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('assessment_attempts').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Assessment Answers
export async function listAnswersByAttempt(attempt_id: string) {
  const { data, error } = await supabaseAdmin.from('assessment_answers').select('*').eq('attempt_id', attempt_id);
  if (error) throw error;
  return data;
}

export async function createAnswer(input: any) {
  const { data, error } = await supabaseAdmin.from('assessment_answers').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function bulkCreateAnswers(answers: any[]) {
  const { data, error } = await supabaseAdmin.from('assessment_answers').insert(answers).select();
  if (error) throw error;
  return data;
}

const DEFAULT_STCW_QUESTION_BANK = [
  {
    q: 'Under the STCW 1978 Convention as amended (Manila Amendments), what is the primary objective of mandatory competency standards?',
    choices: [
      { text: 'To ensure seafarers demonstrate verified safety, navigation, and operational competence', correct: true },
      { text: 'To eliminate onboard safety drills during commercial voyages', correct: false },
      { text: 'To replace bridge watchkeeping officers with automated checklists', correct: false },
      { text: 'To waive vessel inspection requirements in international waters', correct: false },
    ],
  },
  {
    q: 'Before commencing any shipboard operational procedure or simulator drill, what must the officer or crew member verify first?',
    choices: [
      { text: 'All safety checklists, communication links, PPE, and operational readiness parameters', correct: true },
      { text: 'Only the vessel cargo manifest', correct: false },
      { text: 'Only the recreational schedule of off-duty crew', correct: false },
      { text: 'That all emergency alarms are switched off', correct: false },
    ],
  },
  {
    q: 'In accordance with Bridge Resource Management (BRM) and STCW watchkeeping principles, how should closed-loop communication be executed?',
    choices: [
      { text: 'The receiver repeats back the order clearly and the sender confirms before execution', correct: true },
      { text: 'Orders are executed silently without verbal acknowledgment', correct: false },
      { text: 'Orders are logged only at the end of the voyage', correct: false },
      { text: 'Only the helmsman speaks during maneuvering', correct: false },
    ],
  },
  {
    q: 'When an abnormal alarm or emergency condition is detected onboard, what is the immediate priority action?',
    choices: [
      { text: 'Assess the hazard, raise the appropriate alarm, notify the bridge/master, and initiate emergency protocol', correct: true },
      { text: 'Silence and reset the alarm without investigating the cause', correct: false },
      { text: 'Wait until the next watch handover to report the condition', correct: false },
      { text: 'Continue normal operations unless instructed by shore management', correct: false },
    ],
  },
  {
    q: 'Under MARPOL and shipboard environmental protection rules, how must oily mixtures and hazardous operational wastes be handled?',
    choices: [
      { text: 'Retained onboard in designated tanks or processed through approved equipment and logged in the Oil Record Book', correct: true },
      { text: 'Discharged overboard at night without documentation', correct: false },
      { text: 'Mixed with fresh water and pumped directly into the bilge overboard line', correct: false },
      { text: 'Stored in crew accommodation spaces', correct: false },
    ],
  },
  {
    q: 'What is the required minimum passing score benchmark for standard STCW written competency assessments at NEWSIM?',
    choices: [
      { text: '75% of the total assessment points', correct: true },
      { text: '25% of the total assessment points', correct: false },
      { text: '40% of the total assessment points', correct: false },
      { text: 'No minimum score is required', correct: false },
    ],
  },
  {
    q: 'During enclosed space entry or hazardous shipboard maintenance, when is entry permitted?',
    choices: [
      { text: 'Only after atmosphere testing, ventilation, rescue equipment staging, and a signed Entry Permit', correct: true },
      { text: 'Immediately upon opening the access hatch without gas testing', correct: false },
      { text: 'Whenever a single crew member is available without a standby attendant', correct: false },
      { text: 'Without portable gas detectors if the tank was empty for 24 hours', correct: false },
    ],
  },
  {
    q: 'Why is situational awareness critical during congested-waters navigation and emergency response?',
    choices: [
      { text: 'It enables early detection of developing risks, collision hazards, and equipment deviations', correct: true },
      { text: 'It allows the watch officer to rely exclusively on a single sensor', correct: false },
      { text: 'It removes the need for lookout posting during restricted visibility', correct: false },
      { text: 'It reduces the frequency of position plotting on navigational charts', correct: false },
    ],
  },
  {
    q: 'What must be documented following a shipboard safety drill, incident response, or practical simulator evaluation?',
    choices: [
      { text: 'Execution timestamps, crew performance, identified deficiencies, and corrective debriefing actions', correct: true },
      { text: 'Only the vessel call sign', correct: false },
      { text: 'Nothing if the drill lasted less than 30 minutes', correct: false },
      { text: 'Only the names of shore-based personnel', correct: false },
    ],
  },
  {
    q: 'Under the ISM Code (International Safety Management), who holds the overriding responsibility and authority to make decisions regarding safety and pollution prevention onboard?',
    choices: [
      { text: 'The Master of the vessel, supported by qualified and certificated officers and crew', correct: true },
      { text: 'The port cargo stevedore supervisor', correct: false },
      { text: 'The charterer commercial broker', correct: false },
      { text: 'Any third-party vendor visiting the ship', correct: false },
    ],
  },
];

/**
 * Ensures an assessment has at least `targetCount` (default 10) multiple-choice questions
 * (1 point each, 4 choices per question) so total score calculations (e.g. 8/10 = 80%, 75% passing)
 * work out-of-the-box.
 */
export async function ensureDefaultAssessmentQuestions(
  assessmentId: string,
  assessmentTitle = 'STCW Competency Assessment',
  targetCount = 10
) {
  const { data: existing } = await supabaseAdmin
    .from('assessment_questions')
    .select('id, sort_order')
    .eq('assessment_id', assessmentId);

  const currentCount = (existing || []).length;
  if (currentCount >= targetCount) return;

  const questionsToInsert = [];
  for (let i = currentCount; i < targetCount; i++) {
    const tpl = DEFAULT_STCW_QUESTION_BANK[i % DEFAULT_STCW_QUESTION_BANK.length];
    questionsToInsert.push({
      assessment_id: assessmentId,
      question_text: `[${assessmentTitle}] ${tpl.q}`,
      question_type: 'MULTIPLE_CHOICE',
      points: 1,
      sort_order: i + 1,
    });
  }

  const { data: insertedQs } = await supabaseAdmin
    .from('assessment_questions')
    .insert(questionsToInsert)
    .select('id, sort_order');

  if (!insertedQs || insertedQs.length === 0) return;

  const choicesToInsert: any[] = [];
  for (const qRow of insertedQs) {
    const idx = Math.max(0, (qRow.sort_order || 1) - 1);
    const tpl = DEFAULT_STCW_QUESTION_BANK[idx % DEFAULT_STCW_QUESTION_BANK.length];
    tpl.choices.forEach((ch, cIdx) => {
      choicesToInsert.push({
        question_id: qRow.id,
        choice_text: ch.text,
        is_correct: ch.correct,
        sort_order: cIdx + 1,
      });
    });
  }

  if (choicesToInsert.length > 0) {
    await supabaseAdmin.from('assessment_choices').insert(choicesToInsert);
  }
}
