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
