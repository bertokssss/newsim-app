import { supabaseAdmin } from '../supabase';

export async function getSuperAdminByProfileId(profile_id: string) {
  const { data, error } = await supabaseAdmin.from('super_admins').select('*, profiles!inner(*)').eq('profile_id', profile_id).single();
  if (error) throw error;
  return data;
}

export async function listSuperAdmins() {
  const { data, error } = await supabaseAdmin.from('super_admins').select('*, profiles!inner(*)');
  if (error) throw error;
  return data;
}

export async function createSuperAdmin(input: any) {
  const { data, error } = await supabaseAdmin.from('super_admins').insert(input).select('*, profiles!inner(*)').single();
  if (error) throw error;
  return data;
}

export async function updateSuperAdmin(profile_id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('super_admins').update(input).eq('profile_id', profile_id).select('*, profiles!inner(*)').single();
  if (error) throw error;
  return data;
}
