import { supabaseAdmin } from '../supabase';

export async function getSettingByKey(key: string) {
  const { data, error } = await supabaseAdmin.from('system_settings').select('*').eq('key', key).single();
  if (error) throw error;
  return data;
}

export async function listSettings(filters?: { category?: string }) {
  let query = supabaseAdmin.from('system_settings').select('*');
  if (filters?.category) query = query.eq('category', filters.category);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function upsertSetting(key: string, value: any, description?: string, updated_by?: string) {
  const input: any = { key, value };
  if (description !== undefined) input.description = description;
  if (updated_by !== undefined) input.updated_by = updated_by;
  
  const { data, error } = await supabaseAdmin.from('system_settings').upsert(input).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSetting(key: string) {
  const { error } = await supabaseAdmin.from('system_settings').delete().eq('key', key);
  if (error) throw error;
}
