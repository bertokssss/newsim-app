import { supabaseAdmin } from '../supabase';

export async function getPaymentById(id: string) {
  const { data, error } = await supabaseAdmin.from('payments').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getPaymentByReference(reference_number: string) {
  const { data, error } = await supabaseAdmin.from('payments').select('*').eq('reference_number', reference_number).single();
  if (error) throw error;
  return data;
}

export async function listPayments(filters?: { trainee_id?: string; enrollment_id?: string; status?: string; payment_method?: string }) {
  let query = supabaseAdmin.from('payments').select('*');
  if (filters?.trainee_id) query = query.eq('trainee_id', filters.trainee_id);
  if (filters?.enrollment_id) query = query.eq('enrollment_id', filters.enrollment_id);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.payment_method) query = query.eq('payment_method', filters.payment_method);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createPayment(input: any) {
  const { data, error } = await supabaseAdmin.from('payments').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updatePayment(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('payments').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
