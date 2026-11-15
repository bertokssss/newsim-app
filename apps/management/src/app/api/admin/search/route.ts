import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { escapePostgrestFilter } from '@newsim/auth';
import { hasModulePermission } from '@newsim/utils';
import {
  requireAdmin,
  isAdminContext,
  applyCenterFilter,
  formatProfileName,
  unwrap,
  toUiEnrollmentStatus,
  toUiPaymentStatus,
  toUiCertificateStatus,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!isAdminContext(ctx)) return ctx;

  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get('q')?.trim() || '';
  const q = escapePostgrestFilter(rawQ);

  if (!q) {
    return NextResponse.json({
      success: true,
      data: {
        trainees: [],
        courses: [],
        enrollments: [],
        instructors: [],
        schedules: [],
        payments: [],
        certificates: [],
      },
    });
  }

  try {
    const canEnrollment = hasModulePermission(ctx.permissions, 'ENROLLMENT_VIEW', ctx.user.role);
    const canCourse = hasModulePermission(ctx.permissions, 'COURSE_VIEW', ctx.user.role);
    const canInstructor = hasModulePermission(ctx.permissions, 'INSTRUCTOR_VIEW', ctx.user.role);
    const canSchedule = hasModulePermission(ctx.permissions, 'SCHEDULE_VIEW', ctx.user.role);
    const canCertificate = hasModulePermission(ctx.permissions, 'CERTIFICATE_VIEW', ctx.user.role);

    const [
      { data: dbTrainees, error: traineeErr },
      { data: dbCourses, error: courseErr },
      { data: dbEnrollments, error: enrErr },
      { data: dbInstructors, error: instErr },
      { data: dbSchedules, error: schedErr },
      { data: dbPayments, error: payErr },
      { data: dbCertificates, error: certErr },
    ] = await Promise.all([
      // 1. Trainees from profiles + trainees table
      canEnrollment
        ? supabaseAdmin
            .from('profiles')
            .select('id, email, first_name, last_name, username, status, avatar_url, trainees(trainee_number, enrollment_status)')
            .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,username.ilike.%${q}%`)
            .eq('role', 'TRAINEE')
            .limit(6)
        : Promise.resolve({ data: [], error: null }),

      // 2. Courses
      canCourse
        ? applyCenterFilter(
            supabaseAdmin
              .from('courses')
              .select('id, code, name, category, price, duration_hours, capacity, status')
              .or(`code.ilike.%${q}%,name.ilike.%${q}%,category.ilike.%${q}%`),
            ctx.centerId
          ).limit(6)
        : Promise.resolve({ data: [], error: null }),

      // 3. Enrollments with course & trainee details
      canEnrollment
        ? applyCenterFilter(
            supabaseAdmin
              .from('enrollments')
              .select(`
                id, status, created_at,
                courses(id, code, name),
                trainees(profile_id, trainee_number, profiles(first_name, last_name, email, avatar_url))
              `),
            ctx.centerId
          ).limit(6)
        : Promise.resolve({ data: [], error: null }),

      // 4. Instructors
      canInstructor
        ? supabaseAdmin
            .from('profiles')
            .select('id, email, first_name, last_name, status, avatar_url')
            .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
            .eq('role', 'INSTRUCTOR')
            .limit(6)
        : Promise.resolve({ data: [], error: null }),

      // 5. Schedules with courses
      canSchedule
        ? applyCenterFilter(
            supabaseAdmin
              .from('schedules')
              .select(`
                id, room, status, start_at, end_at,
                courses(id, code, name)
              `)
              .or(`room.ilike.%${q}%,status.ilike.%${q}%`),
            ctx.centerId
          ).limit(6)
        : Promise.resolve({ data: [], error: null }),

      // 6. Payments with trainees & enrollments (restricted strictly to financial-authorized admins)
      ctx.hasFinancialAccess
        ? supabaseAdmin
            .from('payments')
            .select(`
              id, reference_number, amount, payment_method, status, created_at,
              trainees(profiles(first_name, last_name, email, avatar_url)),
              enrollments(training_center_id, courses(code, name))
            `)
            .or(`reference_number.ilike.%${q}%,payment_method.ilike.%${q}%,status.ilike.%${q}%`)
            .limit(6)
        : Promise.resolve({ data: [], error: null }),

      // 7. Certificates with trainees & courses
      canCertificate
        ? supabaseAdmin
            .from('certificates')
            .select(`
              id, certificate_number, status, issued_at,
              courses(code, name),
              trainees(profiles(first_name, last_name, email, avatar_url))
            `)
            .or(`certificate_number.ilike.%${q}%,status.ilike.%${q}%`)
            .limit(6)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (traineeErr) console.error('Admin Search: Trainee error', traineeErr);
    if (courseErr) console.error('Admin Search: Course error', courseErr);
    if (enrErr) console.error('Admin Search: Enrollment error', enrErr);
    if (instErr) console.error('Admin Search: Instructor error', instErr);
    if (schedErr) console.error('Admin Search: Schedule error', schedErr);
    if (payErr) console.error('Admin Search: Payment error', payErr);
    if (certErr) console.error('Admin Search: Certificate error', certErr);

    const trainees = (dbTrainees || []).map((p: any) => {
      const traineeRecord = unwrap(p.trainees);
      const srn = traineeRecord?.trainee_number || p.username || 'No SRN';
      return {
        id: p.id,
        title: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Trainee',
        subtitle: `${srn} • ${p.email}`,
        link: '/admin/enrollments',
        category: 'Trainees',
        status: p.status || 'ACTIVE',
        avatarUrl: p.avatar_url || null,
      };
    });

    const courses = (dbCourses || []).map((c: any) => ({
      id: c.id,
      title: `${c.code}: ${c.name}`,
      subtitle: `${c.category || 'STCW Course'} • ₱${Number(c.price || 0).toLocaleString()}`,
      link: '/admin/courses',
      category: 'Courses',
      status: c.status || 'PUBLISHED',
    }));

    const enrollments = (dbEnrollments || []).map((e: any) => {
      const trainee = unwrap(e.trainees);
      const profile = unwrap(trainee?.profiles);
      const course = unwrap(e.courses);
      const studentName = formatProfileName(profile);
      const enrNo = `ENR-${String(e.id).slice(0, 8).toUpperCase()}`;
      return {
        id: e.id,
        title: `${enrNo}: ${studentName}`,
        subtitle: course ? `${course.code} - ${course.name}` : 'Course Enrollment',
        link: '/admin/enrollments',
        category: 'Enrollments',
        status: toUiEnrollmentStatus(e.status),
        avatarUrl: profile?.avatar_url || null,
      };
    });

    const instructors = (dbInstructors || []).map((i: any) => ({
      id: i.id,
      title: `${i.first_name || ''} ${i.last_name || ''}`.trim() || 'Instructor',
      subtitle: `Instructor • ${i.email}`,
      link: '/admin/instructors',
      category: 'Instructors',
      status: i.status || 'ACTIVE',
      avatarUrl: i.avatar_url || null,
    }));

    const schedules = (dbSchedules || []).map((s: any) => {
      const course = unwrap(s.courses);
      const start = s.start_at ? new Date(s.start_at).toLocaleDateString() : '';
      return {
        id: s.id,
        title: course ? `${course.code}: ${course.name}` : `Session in ${s.room || 'Room'}`,
        subtitle: `${s.room || 'Simulator'} • ${start || 'Scheduled'}`,
        link: '/admin/schedules',
        category: 'Schedules',
        status: s.status || 'SCHEDULED',
      };
    });

    const payments = (ctx.hasFinancialAccess ? (dbPayments || []) : [])
      .filter((p: any) => {
        if (!ctx.centerId) return true;
        const enr = unwrap(p.enrollments);
        return !enr?.training_center_id || enr.training_center_id === ctx.centerId;
      })
      .map((p: any) => {
      const trainee = unwrap(p.trainees);
      const profile = unwrap(trainee?.profiles);
      const enr = unwrap(p.enrollments);
      const course = unwrap(enr?.courses);
      const payNo = p.reference_number || `PAY-${String(p.id).slice(0, 8).toUpperCase()}`;
      return {
        id: p.id,
        title: `${payNo}: ₱${Number(p.amount || 0).toLocaleString()} (${p.payment_method || 'CASH'})`,
        subtitle: `${formatProfileName(profile)} • ${course?.code || 'Course'}`,
        link: '/admin/payments',
        category: 'Payments',
        status: toUiPaymentStatus(p.status),
        avatarUrl: profile?.avatar_url || null,
      };
    });

    const certificates = (dbCertificates || []).map((cert: any) => {
      const trainee = unwrap(cert.trainees);
      const profile = unwrap(trainee?.profiles);
      const course = unwrap(cert.courses);
      return {
        id: cert.id,
        title: cert.certificate_number || `CERT-${String(cert.id).slice(0, 8).toUpperCase()}`,
        subtitle: `${formatProfileName(profile)} • ${course?.name || 'Certified'}`,
        link: '/admin/certificates',
        category: 'Certificates',
        status: toUiCertificateStatus(cert.status),
        avatarUrl: profile?.avatar_url || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        trainees,
        courses,
        enrollments,
        instructors,
        schedules,
        payments,
        certificates,
      },
    });
  } catch (error) {
    console.error('Admin Search unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 });
  }
}
