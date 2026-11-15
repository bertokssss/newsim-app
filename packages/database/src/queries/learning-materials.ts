import { supabaseAdmin } from '../supabase';

export async function getMaterialById(id: string) {
  const { data, error } = await supabaseAdmin.from('learning_materials').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listMaterialsByModule(module_id: string) {
  const { data, error } = await supabaseAdmin.from('learning_materials').select('*').eq('module_id', module_id);
  if (error) throw error;
  return data;
}

export async function listMaterialsByCourse(course_id: string) {
  const { data, error } = await supabaseAdmin.from('learning_materials').select('*, course_modules!inner(course_id)').eq('course_modules.course_id', course_id);
  if (error) throw error;
  return data;
}

export async function createMaterial(input: any) {
  const { data, error } = await supabaseAdmin.from('learning_materials').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateMaterial(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('learning_materials').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMaterial(id: string) {
  const { error } = await supabaseAdmin.from('learning_materials').delete().eq('id', id);
  if (error) throw error;
}
