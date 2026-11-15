import { supabaseAdmin } from '../supabase';

export interface BatchRecord {
  id: string;
  course_id: string;
  package_id?: string | null;
  training_center_id?: string | null;
  batch_code: string;
  start_date: string;
  end_date?: string | null;
  capacity: number;
  enrolled_count: number;
  queue_order?: number;
  status: 'OPEN' | 'QUEUED' | 'IN_PROGRESS' | 'FULL' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
  courses?: {
    id: string;
    code: string;
    name: string;
    price: number;
    duration_hours?: number;
  };
  course_packages?: {
    id: string;
    package_code: string;
    name: string;
    package_price: number;
  };
  training_centers?: {
    id: string;
    name: string;
  };
}

export async function listBatches(filters?: {
  course_id?: string;
  package_id?: string;
  status?: string;
  training_center_id?: string;
  search?: string;
}) {
  let query = supabaseAdmin
    .from('batches')
    .select(`
      *,
      courses (id, code, name, price, duration_hours),
      course_packages (id, package_code, name, package_price),
      training_centers (id, name)
    `)
    .order('start_date', { ascending: true });

  if (filters?.course_id) {
    query = query.eq('course_id', filters.course_id);
  }
  if (filters?.package_id) {
    query = query.eq('package_id', filters.package_id);
  }
  if (filters?.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }
  if (filters?.training_center_id) {
    query = query.eq('training_center_id', filters.training_center_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  let batches = data || [];
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    batches = batches.filter((b: any) =>
      b.batch_code?.toLowerCase().includes(s) ||
      b.courses?.name?.toLowerCase().includes(s) ||
      b.courses?.code?.toLowerCase().includes(s)
    );
  }

  return batches;
}

export async function getBatchById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('batches')
    .select(`
      *,
      courses (id, code, name, price, duration_hours, capacity),
      course_packages (id, package_code, name, package_price),
      training_centers (id, name)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getBatchesForCourse(courseId: string, onlyOpen: boolean = true) {
  let query = supabaseAdmin
    .from('batches')
    .select(`
      *,
      training_centers (name)
    `)
    .eq('course_id', courseId)
    .order('start_date', { ascending: true });

  if (onlyOpen) {
    query = query.eq('status', 'OPEN');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createBatch(input: {
  course_id: string;
  package_id?: string | null;
  training_center_id?: string | null;
  batch_code: string;
  start_date: string;
  end_date?: string | null;
  capacity?: number;
  status?: 'OPEN' | 'CLOSED' | 'FULL' | 'COMPLETED' | 'CANCELLED';
}) {
  const { data, error } = await supabaseAdmin
    .from('batches')
    .insert({
      course_id: input.course_id,
      package_id: input.package_id || null,
      training_center_id: input.training_center_id || null,
      batch_code: input.batch_code.trim().toUpperCase(),
      start_date: input.start_date,
      end_date: input.end_date || null,
      capacity: Math.min(Math.max(1, input.capacity || 24), 50),
      enrolled_count: 0,
      status: input.status || 'OPEN',
    })
    .select(`
      *,
      courses (id, code, name, price),
      training_centers (id, name)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateBatch(id: string, input: Partial<{
  batch_code: string;
  start_date: string;
  end_date: string | null;
  capacity: number;
  status: 'OPEN' | 'CLOSED' | 'FULL' | 'COMPLETED' | 'CANCELLED';
}>) {
  const updates: any = {
    updated_at: new Date().toISOString(),
  };
  if (input.batch_code !== undefined) updates.batch_code = input.batch_code.trim().toUpperCase();
  if (input.start_date !== undefined) updates.start_date = input.start_date;
  if (input.end_date !== undefined) updates.end_date = input.end_date;
  if (input.capacity !== undefined) updates.capacity = Math.min(Math.max(1, input.capacity), 50);
  if (input.status !== undefined) updates.status = input.status;

  const { data, error } = await supabaseAdmin
    .from('batches')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      courses (id, code, name, price),
      training_centers (id, name)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBatch(id: string) {
  // Check if there are active enrollments
  const { count, error: countErr } = await supabaseAdmin
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('batch_id', id)
    .not('status', 'in', '("CANCELLED","REJECTED")');

  if (countErr) throw countErr;
  if (count && count > 0) {
    throw new Error(`Cannot delete batch with ${count} active enrollment(s). Cancel them first or mark batch as CANCELLED.`);
  }

  const { error } = await supabaseAdmin
    .from('batches')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Atomic batch enrollment using PostgreSQL FOR UPDATE locking
 */
export async function enrollTraineeInBatchRpc(params: {
  batchId: string;
  traineeId: string;
  courseId: string;
  packageId?: string | null;
  trainingCenterId?: string | null;
}): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('enroll_in_batch', {
    p_batch_id: params.batchId,
    p_trainee_id: params.traineeId,
    p_course_id: params.courseId,
    p_package_id: params.packageId || null,
    p_training_center_id: params.trainingCenterId || null,
  });

  if (error) throw error;
  return data; // returns the new enrollment UUID
}

/**
 * Cancel or reject an enrollment and automatically decrement the batch enrolled_count
 */
export async function cancelBatchEnrollmentRpc(enrollmentId: string, newStatus: string = 'CANCELLED'): Promise<void> {
  const { error } = await supabaseAdmin.rpc('cancel_batch_enrollment', {
    p_enrollment_id: enrollmentId,
    p_new_status: newStatus,
  });

  if (error) throw error;
}

/**
 * Progress a batch status (e.g. to IN_PROGRESS, COMPLETED, FULL) and automatically advance the batch queue
 */
export async function progressBatchStatusRpc(batchId: string, newStatus: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('progress_batch_status', {
    p_batch_id: batchId,
    p_new_status: newStatus,
  });

  if (error) throw error;
}
