import { supabaseAdmin } from '../supabase';

export async function getAttendanceById(id: string) {
  const { data, error } = await supabaseAdmin.from('attendance').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listAttendance(filters?: { schedule_id?: string; trainee_id?: string }) {
  let query = supabaseAdmin.from('attendance').select('*');
  if (filters?.schedule_id) query = query.eq('schedule_id', filters.schedule_id);
  if (filters?.trainee_id) query = query.eq('trainee_id', filters.trainee_id);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createAttendance(input: any) {
  const { data, error } = await supabaseAdmin.from('attendance').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateAttendance(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('attendance').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function bulkCreateAttendance(records: any[]) {
  const { data, error } = await supabaseAdmin.from('attendance').insert(records).select();
  if (error) throw error;
  return data;
}
