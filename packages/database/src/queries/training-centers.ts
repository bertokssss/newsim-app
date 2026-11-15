import { supabaseAdmin } from '../supabase';

export async function getTrainingCenterById(id: string) {
  const { data, error } = await supabaseAdmin.from('training_centers').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getTrainingCenterByCode(code: string) {
  const { data, error } = await supabaseAdmin.from('training_centers').select('*').eq('code', code).single();
  if (error) throw error;
  return data;
}

export async function listTrainingCenters(filters?: { status?: string }) {
  let query = supabaseAdmin.from('training_centers').select('*');
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createTrainingCenter(input: any) {
  const { data, error } = await supabaseAdmin.from('training_centers').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateTrainingCenter(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('training_centers').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTrainingCenter(id: string) {
  const { error } = await supabaseAdmin.from('training_centers').delete().eq('id', id);
  if (error) throw error;
}
