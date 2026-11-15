import { supabaseAdmin } from '../supabase';

export async function getEnrollmentById(id: string) {
  const { data, error } = await supabaseAdmin.from('enrollments').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listEnrollments(filters?: { trainee_id?: string; course_id?: string; training_center_id?: string; status?: string }) {
  let query = supabaseAdmin.from('enrollments').select('*');
  if (filters?.trainee_id) query = query.eq('trainee_id', filters.trainee_id);
  if (filters?.course_id) query = query.eq('course_id', filters.course_id);
  if (filters?.training_center_id) query = query.eq('training_center_id', filters.training_center_id);
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createEnrollment(input: any) {
  const { data, error } = await supabaseAdmin.from('enrollments').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateEnrollment(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('enrollments').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEnrollment(id: string) {
  const { error } = await supabaseAdmin.from('enrollments').delete().eq('id', id);
  if (error) throw error;
}

export async function listEnrollmentsWithDetails(filters?: { trainee_id?: string; course_id?: string; training_center_id?: string; status?: string }) {
  let query = supabaseAdmin.from('enrollments').select(`
    *,
    trainees!inner(profile_id, trainee_number, profiles!inner(first_name, last_name, email)),
    courses!inner(code, name, price)
  `);
  if (filters?.trainee_id) query = query.eq('trainee_id', filters.trainee_id);
  if (filters?.course_id) query = query.eq('course_id', filters.course_id);
  if (filters?.training_center_id) query = query.eq('training_center_id', filters.training_center_id);
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
