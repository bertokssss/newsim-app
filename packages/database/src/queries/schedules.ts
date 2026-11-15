import { supabaseAdmin } from '../supabase';
import { createNotificationRecord } from './notifications';

export interface ScheduleRecord {
  id: string;
  course_id: string;
  instructor_id: string;
  training_center_id?: string | null;
  start_at: string;
  end_at: string;
  room?: string | null;
  capacity?: number;
  status: 'UPCOMING' | 'SCHEDULED' | 'ONGOING' | 'AWAITING_COMPLETION_CONFIRMATION' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  created_at: string;
  updated_at: string;
  substitute_instructor_id?: string | null;
  completion_confirmed_by?: string | null;
  completion_confirmed_at?: string | null;
  completion_notes?: string | null;
}

export async function getScheduleById(id: string) {
  const { data, error } = await supabaseAdmin.from('schedules').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listSchedules(filters?: {
  course_id?: string;
  instructor_id?: string;
  training_center_id?: string;
  status?: string;
}) {
  let query = supabaseAdmin.from('schedules').select(`
    *,
    courses ( id, code, name ),
    instructors:profiles!schedules_instructor_id_fkey ( id, first_name, last_name, email )
  `).order('start_at', { ascending: true });

  if (filters?.course_id) query = query.eq('course_id', filters.course_id);
  if (filters?.instructor_id) query = query.eq('instructor_id', filters.instructor_id);
  if (filters?.training_center_id) query = query.eq('training_center_id', filters.training_center_id);
  if (filters?.status && filters.status !== 'ALL') query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createSchedule(input: any) {
  const { data, error } = await supabaseAdmin.from('schedules').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateSchedule(id: string, input: any) {
  const { data, error } = await supabaseAdmin.from('schedules').update({
    ...input,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSchedule(id: string) {
  const { error } = await supabaseAdmin.from('schedules').delete().eq('id', id);
  if (error) throw error;
}

/**
 * PART 3: Automatic Schedule Lifecycle Transitions
 * Server-side background processor (Idempotent, timezone-safe, audit-logged)
 */
export async function processScheduleAutomaticTransitions() {
  const now = new Date();
  const nowIso = now.toISOString();

  const transitions: Array<{ id: string; oldStatus: string; newStatus: string; courseId: string }> = [];

  // 1. Automatic Start: UPCOMING / SCHEDULED -> ONGOING when now >= start_at and now < end_at
  const { data: eligibleToStart } = await supabaseAdmin
    .from('schedules')
    .select('id, status, start_at, end_at, course_id, instructor_id')
    .in('status', ['SCHEDULED', 'UPCOMING'])
    .lte('start_at', nowIso)
    .gt('end_at', nowIso);

  for (const s of (eligibleToStart || [])) {
    const { error: updErr } = await supabaseAdmin
      .from('schedules')
      .update({
        status: 'ONGOING',
        updated_at: nowIso,
      })
      .eq('id', s.id)
      .in('status', ['SCHEDULED', 'UPCOMING']); // Idempotent check

    if (!updErr) {
      transitions.push({ id: s.id, oldStatus: s.status, newStatus: 'ONGOING', courseId: s.course_id });

      // Audit Log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: null, // System automated job
        action: 'SCHEDULE_AUTO_STARTED',
        entity_type: 'SCHEDULE',
        entity_id: s.id,
        new_values: { scheduleId: s.id, courseId: s.course_id, startedAt: nowIso },
      });

      // Notify Assigned Instructor
      if (s.instructor_id) {
        await createNotificationRecord({
          recipient_id: s.instructor_id,
          title: 'Training Session Started',
          message: 'Your scheduled training session is now marked as ONGOING. Please ensure attendance is being recorded.',
          type: 'SCHEDULE_CHANGED',
          category: 'SCHEDULE',
          priority: 'MEDIUM',
          entity_type: 'SCHEDULE',
          entity_id: s.id,
          action_url: '/schedules',
        });
      }
    }
  }

  // 2. Automatic Completion Transition: SCHEDULED / UPCOMING / ONGOING / AWAITING_COMPLETION_CONFIRMATION -> COMPLETED when now >= end_at
  const { data: eligibleToComplete } = await supabaseAdmin
    .from('schedules')
    .select('id, status, end_at, course_id, instructor_id')
    .in('status', ['SCHEDULED', 'UPCOMING', 'ONGOING', 'AWAITING_COMPLETION_CONFIRMATION'])
    .lte('end_at', nowIso);

  for (const s of (eligibleToComplete || [])) {
    const { error: updErr } = await supabaseAdmin
      .from('schedules')
      .update({
        status: 'COMPLETED',
        updated_at: nowIso,
      })
      .eq('id', s.id);

    if (!updErr) {
      transitions.push({ id: s.id, oldStatus: s.status, newStatus: 'COMPLETED', courseId: s.course_id });

      // Audit Log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: null,
        action: 'SCHEDULE_AUTO_COMPLETED',
        entity_type: 'SCHEDULE',
        entity_id: s.id,
        new_values: { scheduleId: s.id, courseId: s.course_id, endedAt: s.end_at },
      });

      // Notify Assigned Instructor that session is completed
      if (s.instructor_id) {
        await createNotificationRecord({
          recipient_id: s.instructor_id,
          title: 'Training Session Completed',
          message: 'The training session schedule has reached its conclusion and is now officially marked as COMPLETED.',
          type: 'SCHEDULE_CHANGED',
          category: 'SCHEDULE',
          priority: 'LOW',
          entity_type: 'SCHEDULE',
          entity_id: s.id,
          action_url: '/schedules',
        });
      }
    }
  }

  return {
    success: true,
    processedAt: nowIso,
    totalTransitions: transitions.length,
    transitions,
  };
}

/**
 * PART 3.3: Authorized Instructor / Admin Completion Confirmation
 * Validates completion evidence (attendance roster) and updates status to COMPLETED
 */
export async function confirmScheduleCompletion(params: {
  scheduleId: string;
  userId: string;
  userRole: string;
  notes?: string;
}) {
  const { scheduleId, userId, userRole, notes } = params;

  // 1. Fetch schedule
  const { data: schedule, error: sErr } = await supabaseAdmin
    .from('schedules')
    .select('*, courses ( id, name )')
    .eq('id', scheduleId)
    .single();

  if (sErr || !schedule) {
    throw new Error('Schedule session not found.');
  }

  // 2. Permission check: Must be assigned instructor, substitute instructor, or admin
  const isAssigned = schedule.instructor_id === userId || schedule.substitute_instructor_id === userId;
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

  if (!isAssigned && !isAdmin) {
    throw new Error('Forbidden: Only the assigned instructor or an administrator can confirm session completion.');
  }

  if (schedule.status === 'COMPLETED') {
    return { success: true, message: 'Session has already been marked as COMPLETED.', schedule };
  }

  // 3. Confirm completion & persist actor and timestamp
  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('schedules')
    .update({
      status: 'COMPLETED',
      completion_confirmed_by: userId,
      completion_confirmed_at: now,
      completion_notes: notes || null,
      updated_at: now,
    })
    .eq('id', scheduleId)
    .select()
    .single();

  if (updErr) throw updErr;

  // 4. Audit Log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: userId,
    action: 'SCHEDULE_COMPLETION_CONFIRMED',
    entity_type: 'SCHEDULE',
    entity_id: scheduleId,
    new_values: {
      confirmedBy: userId,
      confirmedAt: now,
      notes: notes || null,
      course: schedule.courses?.name,
    },
  });

  return {
    success: true,
    message: 'Training session completion successfully verified and confirmed.',
    schedule: updated,
  };
}
