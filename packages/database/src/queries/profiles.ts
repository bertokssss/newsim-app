import { supabaseAdmin } from '../supabase';

export async function getProfileById(id: string) {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getProfileByEmail(email: string) {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('email', email).single();
  if (error) throw error;
  return data;
}

export async function listProfiles(filters?: { role?: string; status?: string; training_center_id?: string }) {
  let query = supabaseAdmin.from('profiles').select('*');
  if (filters?.role) query = query.eq('role', filters.role);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.training_center_id) query = query.eq('training_center_id', filters.training_center_id);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createProfile(input: any) {
  const { data, error } = await supabaseAdmin.from('profiles').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateProfile(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('profiles').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProfile(id: string) {
  const { error } = await supabaseAdmin.from('profiles').delete().eq('id', id);
  if (error) throw error;
}

export async function getProfileWithRole(id: string) {
  const profile = await getProfileById(id);
  let roleData = null;
  switch (profile.role) {
    case 'super_admin': {
      const { data } = await supabaseAdmin.from('super_admins').select('*').eq('profile_id', id).single();
      roleData = data;
      break;
    }
    case 'admin': {
      const { data } = await supabaseAdmin.from('admins').select('*').eq('profile_id', id).single();
      roleData = data;
      break;
    }
    case 'instructor': {
      const { data } = await supabaseAdmin.from('instructors').select('*').eq('profile_id', id).single();
      roleData = data;
      break;
    }
    case 'trainee': {
      const { data } = await supabaseAdmin.from('trainees').select('*').eq('profile_id', id).single();
      roleData = data;
      break;
    }
  }
  return { ...profile, role_data: roleData };
}
