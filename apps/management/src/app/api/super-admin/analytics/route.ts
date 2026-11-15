import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { supabaseAdmin } from '@newsim/database';

export const dynamic = 'force-dynamic';

const TIMEZONE = 'Asia/Manila';

function getPHTParts(dateInput: string | Date | number) {
  const d = new Date(dateInput);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return {
    year: parseInt(getPart('year'), 10),
    month: parseInt(getPart('month'), 10), // 1-12
    day: parseInt(getPart('day'), 10),     // 1-31
  };
}

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'REPORT_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const { searchParams } = new URL(req.url);
    const timeRange = (searchParams.get('timeRange') || '30d').toLowerCase();

    // 1. Fetch real database entities
    const [
      { data: allProfiles },
      { data: allEnrollments },
      { data: allCourses },
      { data: allSchedules },
      { data: allInstructors },
      { data: auditLogs },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, first_name, last_name, email, role, status, avatar_url, created_at, created_by, mfa_enabled, last_login_at'),
      supabaseAdmin.from('enrollments').select('id, status, created_at, enrolled_at, course_id, trainee_id'),
      supabaseAdmin.from('courses').select('id, name, code, status'),
      supabaseAdmin.from('schedules').select('id, status, course_id, instructor_id, start_at, end_at'),
      supabaseAdmin.from('instructors').select('profile_id, employment_status'),
      supabaseAdmin.from('audit_logs').select('id, action, created_at, actor_id, entity_type, entity_id, new_values, profiles(first_name, last_name, email, role, avatar_url)').order('created_at', { ascending: false }).limit(50),
    ]);

    const profiles = allProfiles || [];
    const enrollments = allEnrollments || [];
    const courses = allCourses || [];
    const schedules = allSchedules || [];
    const instructorsList = allInstructors || [];

    // Profile breakdowns
    const totalAccounts = profiles.length;
    const traineeProfiles = profiles.filter((p: any) => (p.role || '').toUpperCase() === 'TRAINEE');
    const activeTrainees = traineeProfiles.filter((p: any) => (p.status || '').toUpperCase() === 'ACTIVE').length;
    const pendingTrainees = traineeProfiles.filter((p: any) => (p.status || '').toUpperCase() === 'PENDING').length;
    const lockedTrainees = traineeProfiles.filter((p: any) => (p.status || '').toUpperCase() === 'LOCKED').length;

    const instructorProfiles = profiles.filter((p: any) => (p.role || '').toUpperCase() === 'INSTRUCTOR');
    const totalInstructors = instructorProfiles.length;

    const adminProfiles = profiles.filter((p: any) => ['ADMIN', 'SUPER_ADMIN'].includes((p.role || '').toUpperCase()));
    const totalAdmins = adminProfiles.length;

    // Faculty & Simulator Metrics
    const activeTeachingInstructors = new Set(
      schedules.filter((s: any) => ['ONGOING', 'UPCOMING', 'SCHEDULED'].includes(s.status)).map((s: any) => s.instructor_id).filter(Boolean)
    ).size;
    const liveSimulators = schedules.filter((s: any) => s.status === 'ONGOING').length;
    const upcomingSessions = schedules.filter((s: any) => ['UPCOMING', 'SCHEDULED'].includes(s.status)).length;

    // Accounts created by admins vs self-registered
    const createdByAdmin = profiles.filter((p: any) => p.created_by).length;
    const selfRegistered = totalAccounts - createdByAdmin;

    // MFA & Security
    const mfaCount = profiles.filter((p: any) => p.mfa_enabled).length;
    const mfaCoverage = totalAccounts > 0 ? `${Math.round((mfaCount / totalAccounts) * 100)}%` : '100%';

    // Enrollment Pipeline
    const apps = enrollments.length;
    const approved = enrollments.filter((e: any) => !['PENDING', 'REJECTED', 'CANCELLED'].includes(e.status)).length;
    const enrolled = enrollments.filter((e: any) => ['ENROLLED', 'ONGOING', 'COMPLETED'].includes(e.status)).length;
    const completed = enrollments.filter((e: any) => e.status === 'COMPLETED').length;

    const getPct = (val: number, max: number) => (max > 0 ? `${((val / max) * 100).toFixed(1)}%` : '0%');

    const pipeline = {
      applications: apps,
      applicationsPct: getPct(apps, apps),
      approved: approved,
      approvedPct: getPct(approved, apps),
      enrolled: enrolled,
      enrolledPct: getPct(enrolled, apps),
      inTraining: schedules.filter((s: any) => s.status === 'ONGOING').length,
      inTrainingPct: getPct(schedules.filter((s: any) => s.status === 'ONGOING').length, apps),
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

    // Timeline Chart Data: Trainees & Enrollments (NO Revenue)
    interface ChartPoint {
      key: string;
      name: string;
      trainees: number;
      enrollments: number;
      rawDate: Date;
    }

    const intervals: ChartPoint[] = [];
    const now = new Date();

    if (timeRange === '7d' || timeRange === 'today') {
      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(now.getTime() - i * 24 * 3600 * 1000);
        const pht = getPHTParts(targetDate);
        const key = `${pht.year}-${String(pht.month).padStart(2, '0')}-${String(pht.day).padStart(2, '0')}`;
        const name = new Intl.DateTimeFormat('en-US', {
          timeZone: TIMEZONE,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }).format(targetDate);
        intervals.push({ key, name, trainees: 0, enrollments: 0, rawDate: targetDate });
      }
    } else if (timeRange === '30d') {
      for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(now.getTime() - i * 5 * 24 * 3600 * 1000);
        const pht = getPHTParts(targetDate);
        const key = `${pht.year}-${String(pht.month).padStart(2, '0')}-${String(pht.day).padStart(2, '0')}`;
        const name = new Intl.DateTimeFormat('en-US', {
          timeZone: TIMEZONE,
          month: 'short',
          day: 'numeric',
        }).format(targetDate);
        intervals.push({ key, name, trainees: 0, enrollments: 0, rawDate: targetDate });
      }
    } else if (timeRange === '90d' || timeRange === '180d') {
      const stepMonths = timeRange === '180d' ? 6 : 3;
      for (let i = stepMonths - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const name = new Intl.DateTimeFormat('en-US', {
          timeZone: TIMEZONE,
          month: 'short',
          year: 'numeric',
        }).format(d);
        intervals.push({ key, name, trainees: 0, enrollments: 0, rawDate: d });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const name = new Intl.DateTimeFormat('en-US', {
          timeZone: TIMEZONE,
          month: 'short',
        }).format(d);
        intervals.push({ key, name, trainees: 0, enrollments: 0, rawDate: d });
      }
    }

    traineeProfiles.forEach((p: any) => {
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

    enrollments.forEach((e: any) => {
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

    const chartData = intervals.map((pt) => ({
      name: pt.name,
      trainees: pt.trainees,
      enrollments: pt.enrollments,
    }));

    return NextResponse.json({
      success: true,
      data: {
        userOverview: {
          totalAccounts,
          activeTrainees,
          pendingTrainees,
          lockedTrainees,
          totalTrainees: traineeProfiles.length,
          admins: totalAdmins,
          instructors: totalInstructors,
        },
        accountLifecycle: {
          totalAccounts,
          createdByAdmin,
          selfRegistered,
          mfaCoverage,
          lockedAccounts: lockedTrainees,
        },
        trainingOverview: {
          certifiedCourses: courses.length,
          liveSessions: liveSimulators,
          upcomingSessions,
          completionsYTD: completed,
          completionRate,
        },
        instructorMetrics: {
          totalInstructors,
          activeTeaching: activeTeachingInstructors,
          sessionsConductedMonth: schedules.length,
          avgStudentRating: null,
        },
        enrollmentPipeline: pipeline,
        chartData,
        recentActivity: (() => {
          const profileById = new Map<string, any>();
          const profileByEmail = new Map<string, any>();
          for (const prof of profiles) {
            if (prof.id) profileById.set(prof.id, prof);
            if (prof.email) profileByEmail.set(String(prof.email).toLowerCase(), prof);
          }

          return (auditLogs || []).slice(0, 10).map((log: any) => {
            const joined = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
            const details = log.new_values && typeof log.new_values === 'object' ? log.new_values : {};
            const fallbackEmail = String(details.actorEmail || details.email || details.targetEmail || '').toLowerCase();
            const p =
              joined ||
              (log.actor_id ? profileById.get(log.actor_id) : null) ||
              (log.entity_id ? profileById.get(log.entity_id) : null) ||
              (fallbackEmail ? profileByEmail.get(fallbackEmail) : null);

            return {
              id: log.id,
              action: (log.action || '').replace(/_/g, ' '),
              rawAction: log.action,
              actor: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email : (fallbackEmail || 'System Admin'),
              actorEmail: p?.email || fallbackEmail || null,
              actorAvatarUrl: p?.avatar_url || null,
              role: (p?.role || details.actorRole || 'SYSTEM').toUpperCase(),
              time: log.created_at
                ? new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })
                : '',
              timestamp: log.created_at ? new Date(log.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : '',
              entityType: log.entity_type,
              entityId: log.entity_id,
            };
          });
        })(),
        securityOverview: {
          status: 'OPERATIONAL',
          mfaCoverage,
          totalAuditEvents: (auditLogs || []).length,
        },
        systemTimestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error in Super Admin analytics API:', error);
    return NextResponse.json({ success: false, error: 'Failed to process analytics' }, { status: 500 });
  }
}
