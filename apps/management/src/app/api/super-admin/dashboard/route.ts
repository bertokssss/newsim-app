import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { getUnreadNotificationCount, supabaseAdmin } from '@newsim/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req);
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401
      ? createUnauthorizedResponse(auth.error)
      : createForbiddenResponse(auth.error);
  }

  try {
    const { searchParams } = new URL(req.url);
    const timeRange = (searchParams.get('timeRange') || '30d').toLowerCase();

    // 1. Fetch real account counts by role and status
    const [
      { data: allProfiles },
      { data: activeSchedules },
      { data: enrollments },
      { data: courses },
      { data: instructorAssignments },
      { data: auditLogs },
      unreadNotifications,
      { data: trainingCenters },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, role, status, created_at, mfa_enabled'),
      supabaseAdmin.from('schedules').select('id, status, course_id, instructor_id, start_at, end_at'),
      supabaseAdmin.from('enrollments').select('id, status, created_at, enrolled_at, course_id'),
      supabaseAdmin.from('courses').select('id, code, name, status'),
      supabaseAdmin.from('instructors').select('profile_id, employment_status'),
      supabaseAdmin.from('audit_logs').select('id, action, entity_type, entity_id, created_at, profiles(first_name, last_name, email, role, avatar_url)').order('created_at', { ascending: false }).limit(10),
      getUnreadNotificationCount(auth.user.id, 'SUPER_ADMIN', { permissions: auth.user.permissions }),
      supabaseAdmin.from('training_centers').select('id, name, code'),
    ]);

    const profilesList = allProfiles || [];
    const activeTrainees = profilesList.filter(
      (p: any) => (p.role || '').toUpperCase() === 'TRAINEE' && (p.status || '').toUpperCase() === 'ACTIVE'
    ).length;
    const pendingTrainees = profilesList.filter(
      (p: any) => (p.role || '').toUpperCase() === 'TRAINEE' && (p.status || '').toUpperCase() === 'PENDING'
    ).length;
    const totalTrainees = profilesList.filter((p: any) => (p.role || '').toUpperCase() === 'TRAINEE').length;

    const instructors = profilesList.filter((p: any) => (p.role || '').toUpperCase() === 'INSTRUCTOR').length;
    const admins = profilesList.filter((p: any) =>
      ['ADMIN', 'SUPER_ADMIN'].includes((p.role || '').toUpperCase())
    ).length;
    const totalProfiles = profilesList.length;

    const mfaEnabledCount = profilesList.filter((p: any) => p.mfa_enabled).length;
    const mfaCoverage = totalProfiles > 0 ? `${Math.round((mfaEnabledCount / totalProfiles) * 100)}%` : '100%';

    // Instructors assigned to ongoing or upcoming schedules
    const schedulesList = activeSchedules || [];
    const liveSimulators = schedulesList.filter((s: any) => s.status === 'ONGOING').length;
    const upcomingSchedules = schedulesList.filter((s: any) => s.status === 'UPCOMING' || s.status === 'SCHEDULED').length;
    const activeInstructorIds = new Set(schedulesList.map((s: any) => s.instructor_id).filter(Boolean));
    const activeTeachingInstructors = activeInstructorIds.size;

    // 2. Real Enrollment Pipeline (Strictly non-financial)
    const allEnrollments = enrollments || [];
    const apps = allEnrollments.length;
    const approved = allEnrollments.filter((e: any) => !['PENDING', 'REJECTED', 'CANCELLED'].includes(e.status)).length;
    const enrolled = allEnrollments.filter((e: any) => ['ENROLLED', 'ONGOING', 'COMPLETED'].includes(e.status)).length;
    const completed = allEnrollments.filter((e: any) => e.status === 'COMPLETED').length;

    const getPct = (val: number, max: number) => (max > 0 ? `${((val / max) * 100).toFixed(1)}%` : '0%');

    const pipeline = {
      applications: apps,
      applicationsPct: getPct(apps, apps),
      approved: approved,
      approvedPct: getPct(approved, apps),
      paid: enrolled, // Pipeline progress count without financial figures
      paidPct: getPct(enrolled, apps),
      enrolled: enrolled,
      enrolledPct: getPct(enrolled, apps),
      completed: completed,
      completedPct: getPct(completed, apps),
      conversionRate: getPct(enrolled, apps),
    };

    let completionRate = '0%';
    if (completed > 0 && approved > 0) {
      completionRate = `${((completed / approved) * 100).toFixed(1)}%`;
    } else if (enrolled > 0) {
      completionRate = '100%';
    }

    // 3. Timeline Chart Data: Trainees & Enrollments (NO Revenue)
    interface ChartPoint {
      name: string;
      rawDate: Date;
      trainees: number;
      enrollments: number;
      revenue: number; // Keep 0 for Recharts compatibility without showing financial figures
    }

    const intervals: ChartPoint[] = [];
    const now = new Date();

    if (timeRange === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const name = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        intervals.push({ name, rawDate: d, trainees: 0, enrollments: 0, revenue: 0 });
      }
    } else if (timeRange === '30d') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i * 5);
        d.setHours(0, 0, 0, 0);
        const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        intervals.push({ name, rawDate: d, trainees: 0, enrollments: 0, revenue: 0 });
      }
    } else if (timeRange === '90d') {
      for (let i = 2; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        const name = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        intervals.push({ name, rawDate: d, trainees: 0, enrollments: 0, revenue: 0 });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        const name = d.toLocaleDateString('en-US', { month: 'short' });
        intervals.push({ name, rawDate: d, trainees: 0, enrollments: 0, revenue: 0 });
      }
    }

    // Populate timeline with profile registrations
    profilesList
      .filter((p: any) => (p.role || '').toUpperCase() === 'TRAINEE')
      .forEach((p: any) => {
        const pDate = new Date(p.created_at || now);
        let bestIdx = 0;
        let minDiff = Infinity;
        intervals.forEach((pt: any, idx: number) => {
          const diff = Math.abs(pDate.getTime() - pt.rawDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = idx;
          }
        });
        intervals[bestIdx].trainees += 1;
      });

    // Populate timeline with course enrollments
    allEnrollments.forEach((e: any) => {
      const eDate = new Date(e.enrolled_at || e.created_at || now);
      let bestIdx = 0;
      let minDiff = Infinity;
      intervals.forEach((pt: any, idx: number) => {
        const diff = Math.abs(eDate.getTime() - pt.rawDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = idx;
        }
      });
      intervals[bestIdx].enrollments += 1;
    });

    const chartData = intervals.map((pt: any) => ({
      name: pt.name,
      trainees: pt.trainees,
      enrollments: pt.enrollments,
      revenue: 0,
      cumulativeRevenue: 0,
    }));

    // 4. Real Audit Logs & System Activity (No Payment records!)
    const recentActivity = (auditLogs || []).map((log: any) => {
      const p = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
      return {
        id: log.id,
        action: log.action.replace(/_/g, ' '),
        rawAction: log.action,
        actor: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email : 'System Admin',
        actorAvatarUrl: p?.avatar_url || null,
        role: (p?.role || 'SYSTEM').toUpperCase(),
        time: log.created_at
          ? new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : '',
        timestamp: log.created_at ? new Date(log.created_at).toLocaleString() : '',
        entityType: log.entity_type,
        entityId: log.entity_id,
      };
    });

    // 5. Training Centers Overview (Trainee counts & active courses, no financial data)
    const centersList = (trainingCenters || []).map((tc: any) => ({
      center: tc.name,
      code: tc.code,
      traineesCount: totalTrainees,
      activeCoursesCount: (courses || []).length,
    }));

    return NextResponse.json({
      success: true,
      data: {
        userOverview: {
          activeTrainees: activeTrainees,
          pendingTrainees: pendingTrainees,
          totalAccounts: totalProfiles,
          admins: admins,
          instructors: instructors,
          activeTeachingInstructors: activeTeachingInstructors,
          ongoingSimulators: liveSimulators,
          upcomingSchedules: upcomingSchedules,
          traineeGrowth: `${activeTrainees} Active Seafarers`,
          simulatorSub: 'Full Mission & Desktop Sessions',
        },
        accountLifecycle: {
          total: totalProfiles,
          active: activeTrainees,
          pending: pendingTrainees,
          instructors: instructors,
          admins: admins,
        },
        trainingOverview: {
          completionRate: completionRate,
          completionGrowth: `${completed} Total Completed`,
          certifiedCourses: (courses || []).length,
          liveSessions: liveSimulators,
          completionsYTD: completed,
          topCourses: (courses || []).slice(0, 5).map((c: any) => ({
            id: c.id,
            name: c.name,
            code: c.code,
          })),
        },
        enrollmentPipeline: pipeline,
        chartData,
        recentActivity,
        recentTransactions: [], // Restricted from Super Admin
        centersList,
        unreadNotificationsCount: unreadNotifications || 0,
        securityOverview: {
          status: 'OPERATIONAL',
          mfaCoverage: mfaCoverage,
          activeSessionsCount: 1,
          totalAuditEvents: (auditLogs || []).length,
        },
        financialPrivacyNotice: 'Financial transactions and payment records are restricted to authorized Admin staff.',
        systemTimestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error fetching super admin dashboard data:', error);
    return NextResponse.json({ success: false, data: {} }, { status: 500 });
  }
}
