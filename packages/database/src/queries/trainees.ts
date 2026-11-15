import { supabaseAdmin } from '../supabase';

export async function getTraineeByProfileId(profile_id: string) {
  const { data, error } = await supabaseAdmin.from('trainees').select('*, profiles!inner(*)').eq('profile_id', profile_id).single();
  if (error) throw error;
  return data;
}

export async function listTrainees(filters?: { training_center_id?: string; enrollment_status?: string }) {
  let query = supabaseAdmin.from('trainees').select('*, profiles!inner(*)');
  if (filters?.training_center_id) query = query.eq('training_center_id', filters.training_center_id);
  if (filters?.enrollment_status) query = query.eq('enrollment_status', filters.enrollment_status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createTrainee(input: any) {
  const { data, error } = await supabaseAdmin.from('trainees').insert(input).select('*, profiles!inner(*)').single();
  if (error) throw error;
  return data;
}

export async function updateTrainee(profile_id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('trainees').update(input).eq('profile_id', profile_id).select('*, profiles!inner(*)').single();
  if (error) throw error;
  return data;
}

export async function deleteTrainee(profile_id: string) {
  const { error } = await supabaseAdmin.from('trainees').delete().eq('profile_id', profile_id);
  if (error) throw error;
}
