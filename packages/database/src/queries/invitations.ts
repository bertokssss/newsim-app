import { supabaseAdmin } from '../supabase';

export async function getInvitationById(id: string) {
  const { data, error } = await supabaseAdmin.from('invitations').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getInvitationByToken(token_hash: string) {
  const { data, error } = await supabaseAdmin.from('invitations').select('*').eq('token_hash', token_hash).single();
  if (error) throw error;
  return data;
}

export async function listInvitations(filters?: { status?: string }) {
  let query = supabaseAdmin.from('invitations').select('*');
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createInvitation(input: any) {
  const { data, error } = await supabaseAdmin.from('invitations').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateInvitation(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('invitations').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function acceptInvitation(id: string) {
  const { data, error } = await supabaseAdmin.from('invitations').update({ status: 'accepted' }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
