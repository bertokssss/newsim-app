import { supabaseAdmin } from '../supabase';

export async function getCertificateById(id: string) {
  const { data, error } = await supabaseAdmin.from('certificates').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getCertificateByNumber(certificate_number: string) {
  const { data, error } = await supabaseAdmin.from('certificates').select('*').eq('certificate_number', certificate_number).single();
  if (error) throw error;
  return data;
}

export async function listCertificates(filters?: { trainee_id?: string; course_id?: string; status?: string }) {
  let query = supabaseAdmin.from('certificates').select('*');
  if (filters?.trainee_id) query = query.eq('trainee_id', filters.trainee_id);
  if (filters?.course_id) query = query.eq('course_id', filters.course_id);
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCertificate(input: any) {
  const { data, error } = await supabaseAdmin.from('certificates').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateCertificate(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('certificates').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
