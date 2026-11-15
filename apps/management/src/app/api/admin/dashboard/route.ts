import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  applyCenterFilter,
  formatEnrollment,
  formatMoney,
  formatPayment,
  formatSchedule,
  isAdminContext,
  requireAdmin,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;

  try {
    let traineeQuery = supabaseAdmin
      .from('trainees')
      .select('profile_id, enrollment_status, created_at, profiles!inner(status)', { count: 'exact' });
    traineeQuery = applyCenterFilter(traineeQuery, ctx.centerId);

    let enrollmentQuery = supabaseAdmin
      .from('enrollments')
      .select('*, trainees(profile_id, profiles(first_name, last_name, email, avatar_url)), courses(code, name, price), training_centers(name), payments(status, amount, created_at)');
    enrollmentQuery = applyCenterFilter(enrollmentQuery, ctx.centerId);

    let paymentQuery = supabaseAdmin
      .from('payments')
      .select('*, trainees(profiles(first_name, last_name, email, avatar_url)), enrollments(courses(name))');
    if (ctx.centerId) {
      paymentQuery = paymentQuery.eq('enrollments.training_center_id', ctx.centerId);
    }

    let scheduleQuery = supabaseAdmin
      .from('schedules')
      .select('*, courses(code, name), instructors(profiles(first_name, last_name, avatar_url)), training_centers(name)');
    scheduleQuery = applyCenterFilter(scheduleQuery, ctx.centerId);

    let courseQuery = supabaseAdmin.from('courses').select('id, status', { count: 'exact' });
    courseQuery = applyCenterFilter(courseQuery, ctx.centerId);

    let certQuery = supabaseAdmin.from('certificates').select('id, status, issued_at');
    if (ctx.centerId) {
      certQuery = certQuery.eq('courses.training_center_id', ctx.centerId);
    }

    let attendanceQuery = supabaseAdmin.from('attendance').select('id, status, created_at, schedules!inner(start_at, training_center_id)');
    if (ctx.centerId) {
      attendanceQuery = attendanceQuery.eq('schedules.training_center_id', ctx.centerId);
    }

    const [
      traineesRes,
      enrollmentsRes,
      paymentsRes,
      schedulesRes,
      coursesRes,
      certsRes,
      attendanceRes,
    ] = await Promise.all([
      traineeQuery,
      enrollmentQuery,
      ctx.hasFinancialAccess ? paymentQuery : Promise.resolve({ data: [] }),
      scheduleQuery,
      courseQuery,
      certQuery,
      attendanceQuery,
    ]);

    const trainees = traineesRes.data || [];
    const enrollments = enrollmentsRes.data || [];
    const payments = (paymentsRes.data || []).map(formatPayment);
    const schedules = (schedulesRes.data || []).map(formatSchedule);
    const certificates = certsRes.data || [];
    const attendance = attendanceRes.data || [];

    const activeTrainees = trainees.filter((t: any) => {
      const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
      return (profile?.status || '').toString().toUpperCase() === 'ACTIVE';
    }).length;

    const TIMEZONE = 'Asia/Manila';
    const now = new Date();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now); // 'YYYY-MM-DD' in PHT

    const monthParts = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, year: 'numeric', month: 'numeric' }).formatToParts(now);
    const curYear = parseInt(monthParts.find(p => p.type === 'year')?.value || '2026', 10);
    const curMonth = parseInt(monthParts.find(p => p.type === 'month')?.value || '10', 10);
    const currentMonthKey = `${curYear}-${String(curMonth).padStart(2, '0')}`;

    const newTraineesThisMonth = trainees.filter((t: any) => {
      if (!t.created_at) return false;
      const tMonth = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit' }).format(new Date(t.created_at)).slice(0, 7);
      return tMonth === currentMonthKey;
    }).length;

    const pendingApplications = enrollments.filter((e: any) =>
      ['PENDING', 'UNDER_REVIEW', 'PENDING_REVIEW', 'PAYMENT_PENDING', 'NEW'].includes((e.status || '').toUpperCase())
    ).length;
    const activeEnrollments = enrollments.filter((e: any) =>
      ['ACTIVE', 'ENROLLED', 'APPROVED', 'ONGOING'].includes((e.status || '').toUpperCase())
    ).length;
    const completedTraining = enrollments.filter((e: any) => (e.status || '').toUpperCase() === 'COMPLETED').length;

    const verifiedPayments = payments.filter((p: any) => ['VERIFIED', 'PAID'].includes(p.status));
    const pendingPayments = payments.filter((p: any) => p.status === 'PENDING');
    const revenue = verifiedPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const gcashPayments = verifiedPayments.filter((p: any) => (p.method || '').toUpperCase().includes('GCASH'));
    const mayaPayments = verifiedPayments.filter((p: any) => {
      const m = (p.method || '').toUpperCase();
      return m.includes('MAYA') || m.includes('PAYMAYA');
    });
    const gcashTotal = gcashPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const mayaTotal = mayaPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const otherTotal = Math.max(0, revenue - gcashTotal - mayaTotal);

    const getPHTDate = (d: any) => d ? new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date(d)) : '';

    const todayPayments = verifiedPayments.filter((p: any) => getPHTDate(p.verifiedAt || p.createdAt) === today);
    const todayPaymentTotal = todayPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const ongoingSessions = schedules.filter((s: any) => {
      if (s.status === 'CANCELLED' || s.status === 'COMPLETED') return false;
      if (s.status === 'ONGOING') return true;
      if (s.startAt && s.endAt) {
        const sTime = new Date(s.startAt);
        const eTime = new Date(s.endAt);
        return sTime <= now && now <= eTime;
      }
      return false;
    });
    const upcomingSessions = schedules.filter((s: any) => {
      if (s.status === 'CANCELLED' || s.status === 'COMPLETED') return false;
      const startTime = s.startAt ? new Date(s.startAt) : null;
      const endTime = s.endAt ? new Date(s.endAt) : startTime;
      if (endTime && endTime < now) return false;
      if (s.status === 'SCHEDULED') return true;
      if (startTime) return startTime > now;
      return false;
    });
    const todaySchedules = schedules.filter((s: any) => s.date === today).slice(0, 6);

    const todayAttendance = attendance.filter((a: any) => {
      const start = a.schedules?.start_at || a.created_at;
      return getPHTDate(start) === today;
    });
    const present = todayAttendance.filter((a: any) => (a.status || '').toUpperCase() === 'PRESENT').length;
    const absent = todayAttendance.filter((a: any) => (a.status || '').toUpperCase() === 'ABSENT').length;
    const late = todayAttendance.filter((a: any) => (a.status || '').toUpperCase() === 'LATE').length;
    const excused = todayAttendance.filter((a: any) => (a.status || '').toUpperCase() === 'EXCUSED').length;
    const totalAttendance = todayAttendance.length || 1;

    const issuedThisMonth = certificates.filter((c: any) => {
      if (!c.issued_at) return false;
      const cMonth = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit' }).format(new Date(c.issued_at)).slice(0, 7);
      return cMonth === currentMonthKey;
    }).length;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const trendMap = new Map<string, { enrollments: number; completions: number }>();
    monthNames.forEach(m => trendMap.set(m, { enrollments: 0, completions: 0 }));

    for (const enrollment of enrollments) {
      const month = enrollment.created_at
        ? new Date(enrollment.created_at).toLocaleString('en-US', { month: 'short', timeZone: TIMEZONE })
        : 'N/A';
      const current = trendMap.get(month) || { enrollments: 0, completions: 0 };
      current.enrollments += 1;
      if ((enrollment.status || '').toUpperCase() === 'COMPLETED') current.completions += 1;
      trendMap.set(month, current);
    }

    const traineeTrendMap = new Map<string, { count: number }>();
    monthNames.forEach(m => traineeTrendMap.set(m, { count: 0 }));

    for (const trainee of trainees) {
      const month = trainee.created_at
        ? new Date(trainee.created_at).toLocaleString('en-US', { month: 'short', timeZone: TIMEZONE })
        : 'N/A';
      const current = traineeTrendMap.get(month) || { count: 0 };
      current.count += 1;
      traineeTrendMap.set(month, current);
    }

    const traineeTrend = Array.from(traineeTrendMap.entries())
      .filter(([name]) => monthNames.includes(name))
      .map(([name, values]) => ({ name, trainees: values.count }))
      .sort((a, b) => monthNames.indexOf(a.name) - monthNames.indexOf(b.name));

    const revenueTrendMap = new Map<string, { gcash: number; maya: number; other: number; total: number }>();
    monthNames.forEach(m => revenueTrendMap.set(m, { gcash: 0, maya: 0, other: 0, total: 0 }));

    for (const payment of verifiedPayments) {
      const pDate = payment.verifiedAt || payment.createdAt;
      const month = pDate
        ? new Date(pDate).toLocaleString('en-US', { month: 'short', timeZone: TIMEZONE })
        : 'N/A';
      const current = revenueTrendMap.get(month) || { gcash: 0, maya: 0, other: 0, total: 0 };
      const amt = Number(payment.amount || 0);
      const m = (payment.method || '').toUpperCase();
      if (m.includes('GCASH')) {
        current.gcash += amt;
      } else if (m.includes('MAYA') || m.includes('PAYMAYA')) {
        current.maya += amt;
      } else {
        current.other += amt;
      }
      current.total += amt;
      revenueTrendMap.set(month, current);
    }

    const revenueTrend = Array.from(revenueTrendMap.entries())
      .filter(([name]) => monthNames.includes(name))
      .map(([name, values]) => ({
        name,
        gcash: values.gcash,
        maya: values.maya,
        other: values.other,
        total: values.total,
      }))
      .sort((a, b) => monthNames.indexOf(a.name) - monthNames.indexOf(b.name));

    const recentActivity: Array<{ time: string; actor: string; action: string; entity: string }> = [];

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          monthlyRevenue: ctx.hasFinancialAccess
            ? {
                value: formatMoney(revenue),
                change: `${formatMoney(gcashTotal)} GCash • ${formatMoney(mayaTotal)} Maya`,
                rawTotal: revenue,
                gcashTotal,
                mayaTotal,
                otherTotal,
                formattedGcash: formatMoney(gcashTotal),
                formattedMaya: formatMoney(mayaTotal),
              }
            : { value: 'Restricted', change: 'Authorized billing staff only' },
          totalTrainees: {
            value: trainees.length.toLocaleString(),
            active: activeTrainees.toLocaleString(),
            change: `${newTraineesThisMonth} new this month`,
          },
          activeEnrollments: {
            value: activeEnrollments.toLocaleString(),
            pending: pendingApplications,
            change: `${pendingApplications} awaiting review`,
          },
          ongoingSessions: {
            value: String(ongoingSessions.length),
            upcoming: upcomingSessions.length,
            change: `${ongoingSessions.length} live sessions`,
          },
          pendingPayments: {
            value: ctx.hasFinancialAccess ? String(pendingPayments.length) : 'Restricted',
            todayTotal: ctx.hasFinancialAccess ? formatMoney(todayPaymentTotal) : '—',
            change: ctx.hasFinancialAccess ? 'Needs verification' : 'Billing staff only',
          },
        },
        traineeOverview: {
          totalTrainees: trainees.length,
          activeTrainees,
          newTraineesThisMonth,
          pendingApplications,
          activeEnrollments,
          completedTraining,
        },
        trainingOverview: {
          activeCourses: coursesRes.count || 0,
          ongoingSessions: ongoingSessions.length,
          upcomingSessions: upcomingSessions.length,
          completedSessions: schedules.filter((s: any) => s.status === 'COMPLETED').length,
          cancelledSessions: schedules.filter((s: any) => s.status === 'CANCELLED').length,
        },
        attendanceToday: {
          presentRate: Math.round((present / totalAttendance) * 100),
          absentRate: Math.round((absent / totalAttendance) * 100),
          lateRate: Math.round((late / totalAttendance) * 100),
          excusedRate: Math.round((excused / totalAttendance) * 100),
          present,
          absent,
          late,
          excused,
          totalCheckedIn: todayAttendance.length,
        },
        enrollmentOverview: {
          pendingApplications,
          paymentPending: pendingPayments.length,
          readyForEnrollment: enrollments.filter((e: any) => (e.status || '').toUpperCase() === 'APPROVED').length,
          approvedToday: enrollments.filter(
            (e: any) => (e.enrolled_at || '').slice(0, 10) === today
          ).length,
          rejectedToday: enrollments.filter(
            (e: any) => (e.status || '').toUpperCase() === 'REJECTED' && (e.updated_at || '').slice(0, 10) === today
          ).length,
        },
        paymentOverview: ctx.hasFinancialAccess
          ? {
              pendingVerification: pendingPayments.length,
              approvedToday: todayPayments.length,
              rejectedToday: payments.filter(
                (p: any) => p.status === 'REJECTED' && (p.createdAt || '').slice(0, 10) === today
              ).length,
              todayTotal: formatMoney(todayPaymentTotal),
            }
          : {
              pendingVerification: 0,
              approvedToday: 0,
              rejectedToday: 0,
              todayTotal: '—',
              isRestricted: true,
            },
        certificateOverview: {
          readyToIssue: certificates.filter((c: any) => (c.status || '').toUpperCase() === 'READY').length,
          issuedThisMonth,
          pending: certificates.filter((c: any) => (c.status || '').toUpperCase() === 'PENDING').length,
          requests: 0,
        },
        todaySchedules,
        pendingPaymentsList: ctx.hasFinancialAccess ? pendingPayments.slice(0, 5) : [],
        hasFinancialAccess: ctx.hasFinancialAccess,
        permissions: ctx.permissions,
        recentEnrollmentsList: enrollments.slice(0, 5).map((e: any) => formatEnrollment(e, { includeFinancial: ctx.hasFinancialAccess })),
        recentActivity,
        enrollmentTrend: Array.from(trendMap.entries())
          .filter(([name]) => monthNames.includes(name))
          .map(([name, values]) => ({
            name,
            enrollments: values.enrollments,
            completions: values.completions,
          }))
          .sort((a, b) => monthNames.indexOf(a.name) - monthNames.indexOf(b.name)),
        traineeTrend,
        revenueBreakdown: ctx.hasFinancialAccess
          ? {
              totalGross: revenue,
              formattedTotalGross: formatMoney(revenue),
              gcashTotal,
              formattedGcashTotal: formatMoney(gcashTotal),
              mayaTotal,
              formattedMayaTotal: formatMoney(mayaTotal),
              otherTotal,
              formattedOtherTotal: formatMoney(otherTotal),
            }
          : null,
        revenueTrend: ctx.hasFinancialAccess ? revenueTrend : [],
      },
    });
  } catch (error) {
    console.error('Failed to load admin dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error loading dashboard metrics' },
      { status: 500 }
    );
  }
}
