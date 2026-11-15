import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, dispatchNotificationEvent, NOTIFICATION_EVENTS } from '@newsim/database';
import {
  BATCH_SELECT,
  formatBatch,
  isAdminContext,
  requestMeta,
  requireAdmin,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'COURSE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('batches')
      .select(`
        ${BATCH_SELECT},
        enrollments (
          id,
          status,
          enrolled_at,
          trainees (profile_id, trainee_number, profiles(first_name, last_name, email))
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }

    if (ctx.centerId && data.training_center_id && data.training_center_id !== ctx.centerId) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: formatBatch(data) });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      batchCode,
      startDate,
      endDate,
      capacity,
      status,
      instructorId,
      startTime,
      endTime,
    } = body;
    const { ip, userAgent } = requestMeta(request);

    const { data: existing, error: existErr } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existErr || !existing) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }

    if (ctx.centerId && existing.training_center_id && existing.training_center_id !== ctx.centerId) {
      return NextResponse.json({ success: false, error: 'Batch not found in your assigned center' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (batchCode !== undefined) updates.batch_code = batchCode.trim().toUpperCase();
    if (startDate !== undefined) updates.start_date = startDate;
    if (endDate !== undefined) updates.end_date = endDate || null;
    if (startTime !== undefined) updates.start_time = startTime || null;
    if (endTime !== undefined) updates.end_time = endTime || null;
    if (instructorId !== undefined) updates.instructor_id = instructorId || null;

    if (capacity !== undefined) {
      // SECTION 18: Maximum batch capacity = 24 trainees
      const capInt = Math.min(Math.max(1, parseInt(capacity, 10) || 24), 24);
      updates.capacity = capInt;
      // If capacity increased above enrolled_count and was full, reopen
      if (existing.status === 'FULL' && capInt > existing.enrolled_count) {
        updates.status = 'OPEN';
      }
    }
    if (status !== undefined) {
      updates.status = status.toUpperCase();
    }

    // SECTION 30: Preceding batch conflict check if start date is updated
    const finalStartDate = updates.start_date !== undefined ? (updates.start_date as string) : existing.start_date;
    const courseId = existing.course_id;

    if (updates.start_date !== undefined && courseId) {
      const { data: courseBatches } = await supabaseAdmin
        .from('batches')
        .select('id, batch_code, start_date, end_date, status')
        .eq('course_id', courseId)
        .neq('id', id)
        .not('status', 'in', '("CANCELLED")');

      if (courseBatches && courseBatches.length > 0) {
        const newStart = new Date(finalStartDate).getTime();
        for (const b of courseBatches) {
          if (b.end_date) {
            const bStart = new Date(b.start_date).getTime();
            const bEnd = new Date(b.end_date).getTime();
            if (newStart >= bStart && newStart <= bEnd) {
              return NextResponse.json({
                success: false,
                error: `Batch schedule conflicts with the preceding batch. (${b.batch_code} runs until ${b.end_date})`,
                code: 'BATCH_SCHEDULE_CONFLICT',
              }, { status: 400 });
            }
          }
        }
      }
    }

    // SECTION 31 & 32: Instructor schedule conflict check
    const finalInstructorId = updates.instructor_id !== undefined ? (updates.instructor_id as string) : existing.instructor_id;
    if (finalInstructorId) {
      const { data: instructorRow } = await supabaseAdmin
        .from('instructors')
        .select('profile_id, employment_status, profiles(first_name, last_name, status)')
        .eq('profile_id', finalInstructorId)
        .maybeSingle();

      if (!instructorRow) {
        return NextResponse.json({ success: false, error: 'Selected instructor does not exist.' }, { status: 400 });
      }

      const instStatus = (instructorRow.employment_status || (instructorRow.profiles as any)?.status || 'ACTIVE').toUpperCase();
      if (instStatus === 'INACTIVE' || instStatus === 'SUSPENDED') {
        return NextResponse.json({ success: false, error: 'Selected instructor is not active.' }, { status: 400 });
      }

      const checkStart = updates.start_date !== undefined ? (updates.start_date as string) : existing.start_date;
      const checkEnd = updates.end_date !== undefined ? (updates.end_date as string) : existing.end_date;
      const checkStartTime = updates.start_time !== undefined ? (updates.start_time as string) : existing.start_time;
      const checkEndTime = updates.end_time !== undefined ? (updates.end_time as string) : existing.end_time;

      const { data: overlappingBatches } = await supabaseAdmin
        .from('batches')
        .select('id, batch_code, start_date, end_date, start_time, end_time')
        .eq('instructor_id', finalInstructorId)
        .neq('id', id)
        .not('status', 'in', '("CANCELLED","COMPLETED")');

      if (overlappingBatches && overlappingBatches.length > 0) {
        const newStart = new Date(checkStart).getTime();
        const newEnd = checkEnd ? new Date(checkEnd).getTime() : newStart;

        for (const ob of overlappingBatches) {
          const obStart = new Date(ob.start_date).getTime();
          const obEnd = ob.end_date ? new Date(ob.end_date).getTime() : obStart;

          if (newStart <= obEnd && newEnd >= obStart) {
            let timeConflict = true;
            if (checkStartTime && checkEndTime && ob.start_time && ob.end_time) {
              timeConflict = (checkStartTime < ob.end_time && checkEndTime > ob.start_time);
            }
            if (timeConflict) {
              return NextResponse.json({
                success: false,
                error: 'Instructor schedule conflict. The selected instructor is already assigned to another session during this time.',
                code: 'INSTRUCTOR_SCHEDULE_CONFLICT',
              }, { status: 400 });
            }
          }
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('batches')
      .update(updates)
      .eq('id', id)
      .select(BATCH_SELECT)
      .single();

    if (error) throw error;

    // If batch transitioned to IN_PROGRESS, FULL, CLOSED, or COMPLETED, promote next QUEUED batch
    if (updates.status && ['IN_PROGRESS', 'FULL', 'CLOSED', 'COMPLETED'].includes(updates.status as string)) {
      try {
        await supabaseAdmin.rpc('progress_batch_status', {
          p_batch_id: id,
          p_new_status: updates.status,
        });
      } catch (rpcErr) {
        console.warn('progress_batch_status RPC notice:', rpcErr);
      }
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'BATCH_UPDATED',
      entityType: 'BATCH',
      entityId: id,
      details: { updates },
      ip,
      userAgent,
    });

    // Role-Aware Notifications per Section 11 Recipient Matrix
    try {
      if (updates.start_date || updates.end_date || updates.start_time || updates.end_time) {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.SCHEDULE_CHANGED,
          batchId: id,
          courseId: existing.course_id,
          entityType: 'BATCH',
          entityId: id,
          metadata: {
            batchName: data.batch_code,
          },
        });
      }

      if (instructorId !== undefined && instructorId !== existing.instructor_id && instructorId) {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.INSTRUCTOR_ASSIGNED,
          batchId: id,
          instructorId,
          courseId: existing.course_id,
          entityType: 'BATCH',
          entityId: id,
          metadata: {
            batchName: data.batch_code,
          },
        });
      }

      if (updates.status === 'CANCELLED') {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.BATCH_CANCELLED,
          batchId: id,
          courseId: existing.course_id,
          entityType: 'BATCH',
          entityId: id,
          metadata: {
            batchName: data.batch_code,
          },
        });
      }
    } catch (notifErr) {
      console.warn('Batch update notification dispatch notice:', notifErr);
    }

    return NextResponse.json({ success: true, data: formatBatch(data) });
  } catch (error: any) {
    console.error('Failed to update batch:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update batch' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const { ip, userAgent } = requestMeta(request);

    // Check for active enrollments
    const { count, error: countErr } = await supabaseAdmin
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', id)
      .not('status', 'in', '("CANCELLED","REJECTED")');

    if (countErr) throw countErr;
    if (count && count > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete batch with ${count} active enrollment(s). Mark batch as CANCELLED or transfer trainees first.`,
      }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('batches')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'BATCH_DELETED',
      entityType: 'BATCH',
      entityId: id,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, message: 'Batch deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete batch:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to delete batch' }, { status: 500 });
  }
}
