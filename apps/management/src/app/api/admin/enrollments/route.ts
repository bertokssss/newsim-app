import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  applyCenterFilter,
  ENROLLMENT_SELECT,
  formatEnrollment,
  isAdminContext,
  matchesSearch,
  requestMeta,
  requireAdmin,
  toDbEnrollmentStatus,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'ENROLLMENT_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    let query = supabaseAdmin.from('enrollments').select(ENROLLMENT_SELECT);
    query = applyCenterFilter(query, ctx.centerId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    let enrollments = (data || []).map((e: any) => formatEnrollment(e, { includeFinancial: ctx.hasFinancialAccess }));
    if (search) {
      enrollments = enrollments.filter((e: any) =>
        matchesSearch([e.enrollmentNo, e.traineeName, e.traineeEmail, e.courseTitle, e.courseCode], search)
      );
    }
    const counts = {
      ALL: enrollments.length,
      NEW: enrollments.filter((e: any) => e.status === 'NEW').length,
      UNDER_REVIEW: enrollments.filter((e: any) => e.status === 'UNDER_REVIEW').length,
      QUALIFICATION_CHECK: enrollments.filter((e: any) => e.status === 'QUALIFICATION_CHECK').length,
      APPROVED: enrollments.filter((e: any) => e.status === 'APPROVED').length,
      ENROLLED: enrollments.filter((e: any) => e.status === 'ENROLLED').length,
      COMPLETED: enrollments.filter((e: any) => e.status === 'COMPLETED').length,
    };

    const normStatus = (status || 'ALL').toUpperCase().trim().replace(/\s+/g, '_');
    let filtered = enrollments;
    if (normStatus === 'PAYMENT_PENDING') {
      filtered = enrollments.filter((e: any) => e.paymentStatus === 'PENDING');
    } else if (normStatus !== 'ALL') {
      filtered = enrollments.filter(
        (e: any) => (e.status || '').toUpperCase().trim().replace(/\s+/g, '_') === normStatus
      );
    }

    return NextResponse.json({
      success: true,
      data: filtered.slice(0, limit),
      counts,
    });
  } catch (error) {
    console.error('Failed to load enrollments:', error);
    return NextResponse.json({ success: false, error: 'Failed to load enrollments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'ENROLLMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { traineeId, courseId } = body;
    const { ip, userAgent } = requestMeta(request);

    if (!traineeId || !courseId) {
      return NextResponse.json(
        { success: false, error: 'Trainee and Course are required' },
        { status: 400 }
      );
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, training_center_id, price, capacity')
      .eq('id', courseId)
      .maybeSingle();
    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }
    if (ctx.centerId && course.training_center_id !== ctx.centerId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Cannot enroll trainees in another training center course' },
        { status: 403 }
      );
    }

    const { data: existingEnrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id, status')
      .eq('trainee_id', traineeId)
      .eq('course_id', courseId)
      .in('status', ['PENDING', 'APPROVED', 'ENROLLED', 'ACTIVE', 'COMPLETED'])
      .limit(1)
      .maybeSingle();
    if (existingEnrollment) {
      return NextResponse.json(
        { success: false, error: `Trainee already has an active or completed enrollment (${existingEnrollment.status}) for this course.` },
        { status: 409 }
      );
    }

    const maxCapacity = Math.min(course.capacity || 24, 24);
    const { count: enrolledCount } = await supabaseAdmin
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId)
      .neq('status', 'CANCELLED');

    if ((enrolledCount || 0) >= maxCapacity) {
      return NextResponse.json(
        { success: false, error: `Cannot enroll trainee: Course has reached its maximum capacity of ${maxCapacity} trainees.` },
        { status: 400 }
      );
    }

    const centerId = course.training_center_id || ctx.centerId;
    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .insert({
        trainee_id: traineeId,
        course_id: courseId,
        training_center_id: centerId,
        status: toDbEnrollmentStatus('APPROVED'),
        enrolled_at: new Date().toISOString(),
      })
      .select(ENROLLMENT_SELECT)
      .single();

    if (error) throw error;

    await supabaseAdmin.from('payments').insert({
      trainee_id: traineeId,
      enrollment_id: data.id,
      amount: course.price || 0,
      status: 'PENDING',
      payment_method: 'OTHER',
    });

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'ENROLLMENT_CREATED',
      entityType: 'ENROLLMENT',
      entityId: data.id,
      details: { traineeId, courseId },
      ip,
      userAgent,
    });

    const { data: created } = await supabaseAdmin
      .from('enrollments')
      .select(ENROLLMENT_SELECT)
      .eq('id', data.id)
      .single();

    return NextResponse.json({
      success: true,
      enrollment: formatEnrollment(created || data, { includeFinancial: ctx.hasFinancialAccess }),
    });
  } catch (error) {
    console.error('Failed to create enrollment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create enrollment' }, { status: 500 });
  }
}
