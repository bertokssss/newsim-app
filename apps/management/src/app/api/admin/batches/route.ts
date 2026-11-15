import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, dispatchNotificationEvent, NOTIFICATION_EVENTS } from '@newsim/database';
import {
  BATCH_SELECT,
  applyCenterFilter,
  formatBatch,
  isAdminContext,
  matchesSearch,
  requestMeta,
  requireAdmin,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'COURSE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const courseId = searchParams.get('courseId') || searchParams.get('course_id') || '';
    const status = (searchParams.get('status') || 'ALL').toUpperCase();

    let query = supabaseAdmin
      .from('batches')
      .select(BATCH_SELECT)
      .order('start_date', { ascending: true });

    query = applyCenterFilter(query, ctx.centerId);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }
    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    let batches = (data || []).map(formatBatch);
    if (search) {
      batches = batches.filter((b: any) =>
        matchesSearch([b.batchCode, b.courseCode, b.courseTitle, b.centerName], search)
      );
    }

    const stats = {
      total: batches.length,
      open: batches.filter((b: any) => b.status === 'OPEN').length,
      queued: batches.filter((b: any) => b.status === 'QUEUED').length,
      inProgress: batches.filter((b: any) => b.status === 'IN_PROGRESS').length,
      full: batches.filter((b: any) => b.status === 'FULL').length,
      closed: batches.filter((b: any) => b.status === 'CLOSED').length,
      completed: batches.filter((b: any) => b.status === 'COMPLETED').length,
      totalEnrolled: batches.reduce((sum: number, b: any) => sum + (b.enrolledCount || 0), 0),
      totalCapacity: batches.reduce((sum: number, b: any) => sum + (b.capacity || 24), 0),
    };

    return NextResponse.json({ success: true, data: batches, stats });
  } catch (error: any) {
    console.error('Failed to list batches:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const {
      courseId,
      packageId,
      batchCode,
      startDate,
      endDate,
      capacity = 24,
      instructorId,
      startTime,
      endTime,
    } = body;
    const { ip, userAgent } = requestMeta(request);

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 });
    }
    if (!startDate) {
      return NextResponse.json({ success: false, error: 'Start date is required' }, { status: 400 });
    }

    // SECTION 18: Maximum batch capacity = 24 trainees
    const maxCapacity = Math.min(Math.max(1, parseInt(capacity, 10) || 24), 24);

    // SECTION 30: BATCH SCHEDULING RULE
    // A new batch must not commence before the preceding batch has completed its required duration.
    const { data: courseBatches } = await supabaseAdmin
      .from('batches')
      .select('id, batch_code, start_date, end_date, status')
      .eq('course_id', courseId)
      .not('status', 'in', '("CANCELLED")');

    if (courseBatches && courseBatches.length > 0) {
      const newStart = new Date(startDate).getTime();
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

    // SECTION 31 & 32: INSTRUCTOR CONFLICT & ASSIGNMENT VALIDATION
    if (instructorId) {
      const { data: instructorRow } = await supabaseAdmin
        .from('instructors')
        .select('profile_id, employment_status, profiles(first_name, last_name, status)')
        .eq('profile_id', instructorId)
        .maybeSingle();

      if (!instructorRow) {
        return NextResponse.json({ success: false, error: 'Selected instructor does not exist.' }, { status: 400 });
      }

      const instStatus = (instructorRow.employment_status || (instructorRow.profiles as any)?.status || 'ACTIVE').toUpperCase();
      if (instStatus === 'INACTIVE' || instStatus === 'SUSPENDED') {
        return NextResponse.json({ success: false, error: 'Selected instructor is not active.' }, { status: 400 });
      }

      // Check overlapping batches assigned to this instructor
      const { data: overlappingBatches } = await supabaseAdmin
        .from('batches')
        .select('id, batch_code, start_date, end_date, start_time, end_time')
        .eq('instructor_id', instructorId)
        .not('status', 'in', '("CANCELLED","COMPLETED")');

      if (overlappingBatches && overlappingBatches.length > 0) {
        const newStart = new Date(startDate).getTime();
        const newEnd = endDate ? new Date(endDate).getTime() : newStart;

        for (const ob of overlappingBatches) {
          const obStart = new Date(ob.start_date).getTime();
          const obEnd = ob.end_date ? new Date(ob.end_date).getTime() : obStart;

          if (newStart <= obEnd && newEnd >= obStart) {
            let timeConflict = true;
            if (startTime && endTime && ob.start_time && ob.end_time) {
              timeConflict = (startTime < ob.end_time && endTime > ob.start_time);
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

    // Auto-generate batch code if not provided
    let finalCode = (batchCode || '').trim().toUpperCase();
    if (!finalCode) {
      const { data: c } = await supabaseAdmin.from('courses').select('code').eq('id', courseId).single();
      const prefix = c?.code || 'CRS';
      finalCode = `${prefix}-B${startDate.replace(/-/g, '')}`;
    }

    // Check code uniqueness
    const { data: existingCode } = await supabaseAdmin
      .from('batches')
      .select('id')
      .eq('batch_code', finalCode)
      .maybeSingle();

    if (existingCode) {
      return NextResponse.json({ success: false, error: `Batch code ${finalCode} already exists.` }, { status: 409 });
    }

    // Determine queue order & initial status based on existing course cohorts
    const { data: existingBatches } = await supabaseAdmin
      .from('batches')
      .select('id, status, queue_order')
      .eq('course_id', courseId);

    const hasOpenCohort = existingBatches?.some((b: any) => b.status === 'OPEN');
    const maxQueue = existingBatches?.reduce((max: number, b: any) => Math.max(max, b.queue_order || 1), 0) || 0;
    const initialStatus = body.status || (hasOpenCohort ? 'QUEUED' : 'OPEN');
    const queueOrder = maxQueue + 1;
    const targetCenterId = ctx.centerId || body.trainingCenterId || null;

    const { data, error } = await supabaseAdmin
      .from('batches')
      .insert({
        course_id: courseId,
        package_id: packageId || null,
        training_center_id: targetCenterId,
        batch_code: finalCode,
        start_date: startDate,
        end_date: endDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        instructor_id: instructorId || null,
        capacity: maxCapacity,
        enrolled_count: 0,
        status: initialStatus,
        queue_order: queueOrder,
      })
      .select(BATCH_SELECT)
      .single();

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'BATCH_CREATED',
      entityType: 'BATCH',
      entityId: data.id,
      details: { batchCode: finalCode, courseId, startDate, capacity: maxCapacity, instructorId },
      ip,
      userAgent,
    });

    // Dispatch BATCH_CREATED & INSTRUCTOR_ASSIGNED notifications (Section 11 Recipient Matrix)
    try {
      await dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.BATCH_CREATED,
        batchId: data.id,
        courseId,
        entityType: 'BATCH',
        entityId: data.id,
        metadata: {
          batchName: finalCode,
          courseName: data.courses?.name,
        },
      });

      if (instructorId) {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.INSTRUCTOR_ASSIGNED,
          batchId: data.id,
          instructorId,
          courseId,
          entityType: 'BATCH',
          entityId: data.id,
          metadata: {
            batchName: finalCode,
            courseName: data.courses?.name,
          },
        });
      }
    } catch (notifErr) {
      console.warn('Batch creation notification dispatch notice:', notifErr);
    }

    return NextResponse.json({ success: true, data: formatBatch(data) }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create batch:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create batch' }, { status: 500 });
  }
}
