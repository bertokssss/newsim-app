import { supabaseAdmin } from '../supabase';

export async function getGradeById(id: string) {
  const { data, error } = await supabaseAdmin.from('grades').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listGrades(filters?: { trainee_id?: string; course_id?: string; enrollment_id?: string; status?: string }) {
  let query = supabaseAdmin.from('grades').select('*');
  if (filters?.trainee_id) query = query.eq('trainee_id', filters.trainee_id);
  if (filters?.course_id) query = query.eq('course_id', filters.course_id);
  if (filters?.enrollment_id) query = query.eq('enrollment_id', filters.enrollment_id);
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createGrade(input: any) {
  const { data, error } = await supabaseAdmin.from('grades').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateGrade(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('grades').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
