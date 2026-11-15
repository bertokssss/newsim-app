import { supabaseAdmin } from '../supabase';

export async function getModuleById(id: string) {
  const { data, error } = await supabaseAdmin.from('course_modules').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listModulesByCourse(course_id: string) {
  const { data, error } = await supabaseAdmin.from('course_modules').select('*').eq('course_id', course_id).order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createModule(input: any) {
  const { data, error } = await supabaseAdmin.from('course_modules').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateModule(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('course_modules').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteModule(id: string) {
  const { error } = await supabaseAdmin.from('course_modules').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderModules(course_id: string, modules: { id: string; sort_order: number }[]) {
  const { data, error } = await supabaseAdmin.from('course_modules').upsert(
    modules.map(m => ({ ...m, course_id }))
  ).select();
  if (error) throw error;
  return data;
}
