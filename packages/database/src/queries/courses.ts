import { supabaseAdmin } from '../supabase';

export async function getCourseById(id: string) {
  const { data, error } = await supabaseAdmin.from('courses').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getCourseByCode(code: string) {
  const { data, error } = await supabaseAdmin.from('courses').select('*').eq('code', code).single();
  if (error) throw error;
  return data;
}

export async function listCourses(filters?: { training_center_id?: string; status?: string; category?: string }) {
  let query = supabaseAdmin.from('courses').select('*');
  if (filters?.training_center_id) query = query.eq('training_center_id', filters.training_center_id);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.category) query = query.eq('category', filters.category);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCourse(input: any) {
  const { data, error } = await supabaseAdmin.from('courses').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateCourse(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('courses').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCourse(id: string) {
  const { error } = await supabaseAdmin.from('courses').delete().eq('id', id);
  if (error) throw error;
}
