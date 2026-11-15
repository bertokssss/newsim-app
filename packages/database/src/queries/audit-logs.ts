import { supabaseAdmin } from '../supabase';

export async function getAuditLogById(id: string) {
  const { data, error } = await supabaseAdmin.from('audit_logs').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listAuditLogs(filters?: { actor_id?: string; entity_type?: string; action?: string; limit?: number; offset?: number }) {
  let query = supabaseAdmin.from('audit_logs').select('*', { count: 'exact' });
  if (filters?.actor_id) query = query.eq('actor_id', filters.actor_id);
  if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type);
  if (filters?.action) query = query.eq('action', filters.action);
  
  if (filters?.limit !== undefined && filters?.offset !== undefined) {
    query = query.range(filters.offset, filters.offset + filters.limit - 1);
  } else if (filters?.limit !== undefined) {
    query = query.limit(filters.limit);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function createAuditLog(input: any) {
  const { data, error } = await supabaseAdmin.from('audit_logs').insert(input).select().single();
  if (error) throw error;
  return data;
}
