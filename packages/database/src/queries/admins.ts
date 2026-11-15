import { supabaseAdmin } from '../supabase';

export async function getAdminByProfileId(profile_id: string) {
  const { data, error } = await supabaseAdmin.from('admins').select('*, profiles!inner(*)').eq('profile_id', profile_id).single();
  if (error) throw error;
  return data;
}

export async function listAdmins(filters?: { training_center_id?: string }) {
  let query = supabaseAdmin.from('admins').select('*, profiles!inner(*)');
  if (filters?.training_center_id) query = query.eq('training_center_id', filters.training_center_id);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createAdmin(input: any) {
  const { data, error } = await supabaseAdmin.from('admins').insert(input).select('*, profiles!inner(*)').single();
  if (error) throw error;
  return data;
}

export async function updateAdmin(profile_id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('admins').update(input).eq('profile_id', profile_id).select('*, profiles!inner(*)').single();
  if (error) throw error;
  return data;
}

export async function deleteAdmin(profile_id: string) {
  const { error } = await supabaseAdmin.from('admins').delete().eq('profile_id', profile_id);
  if (error) throw error;
}
