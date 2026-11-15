import { supabaseAdmin } from '../supabase';

export async function getInstructorByProfileId(profile_id: string) {
  const { data, error } = await supabaseAdmin.from('instructors').select('*, profiles!inner(*)').eq('profile_id', profile_id).single();
  if (error) throw error;
  return data;
}

export async function listInstructors(filters?: { training_center_id?: string; employment_status?: string }) {
  let query = supabaseAdmin.from('instructors').select('*, profiles!inner(*)');
  if (filters?.training_center_id) query = query.eq('training_center_id', filters.training_center_id);
  if (filters?.employment_status) query = query.eq('employment_status', filters.employment_status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createInstructor(input: any) {
  const { data, error } = await supabaseAdmin.from('instructors').insert(input).select('*, profiles!inner(*)').single();
  if (error) throw error;
  return data;
}

export async function updateInstructor(profile_id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('instructors').update(input).eq('profile_id', profile_id).select('*, profiles!inner(*)').single();
  if (error) throw error;
  return data;
}

export async function deleteInstructor(profile_id: string) {
  const { error } = await supabaseAdmin.from('instructors').delete().eq('profile_id', profile_id);
  if (error) throw error;
}
