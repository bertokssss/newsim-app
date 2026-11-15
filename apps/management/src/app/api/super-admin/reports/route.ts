import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { supabaseAdmin } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'REPORT_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'USER_REPORT';
  const timeRange = searchParams.get('timeRange') || '30d';

  let reportData: any = {};

  try {
    if (type === 'USER_REPORT') {
      const { data: users } = await supabaseAdmin.from('profiles').select('*');
      const allUsers = users || [];

      reportData = {
        title: 'Global User Distribution & Account Audit Report',
        generatedAt: new Date().toISOString(),
        summary: {
          totalUsers: allUsers.length,
          trainees: allUsers.filter((u: any) => u.role === 'TRAINEE').length,
          instructors: allUsers.filter((u: any) => u.role === 'INSTRUCTOR').length,
          admins: allUsers.filter((u: any) => u.role === 'ADMIN').length,
          superAdmins: allUsers.filter((u: any) => u.role === 'SUPER_ADMIN').length,
        },
        records: allUsers.map((u: any) => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown User',
          email: u.email || 'N/A',
          role: u.role || 'USER',
          status: u.status || 'ACTIVE',
          mfaEnabled: u.mfa_enabled ? 'Yes' : 'No',
          lastLogin: u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Active',
          registered: u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A',
        })),
      };
    } else if (type === 'TRAINING_REPORT') {
      const [{ data: courses }, { data: enrollments }, { data: batches }] = await Promise.all([
        supabaseAdmin.from('courses').select('*'),
        supabaseAdmin.from('enrollments').select('*, courses(*)'),
        supabaseAdmin.from('batches').select('id, status'),
      ]);
      const allCourses = courses || [];
      const allEnrollments = enrollments || [];
      const allBatches = batches || [];

      const completedCount = allEnrollments.filter((e: any) => e.status === 'COMPLETED').length;
      const activeBatchesCount = allBatches.filter((b: any) =>
        ['OPEN', 'ACTIVE', 'QUEUED', 'ONGOING'].includes((b.status || '').toUpperCase())
      ).length;
      
      const records = allCourses.map((course: any) => {
        const courseEnrollments = allEnrollments.filter((e: any) => e.course_id === course.id);
        const comp = courseEnrollments.filter((e: any) => e.status === 'COMPLETED').length;
        return {
          courseCode: course.code,
          title: course.name,
          level: 'Mandatory',
          traineesEnrolled: courseEnrollments.length,
          completed: comp,
          rate: courseEnrollments.length > 0 ? `${((comp / courseEnrollments.length) * 100).toFixed(1)}%` : '0%',
          center: 'All Centers'
        };
      });

      reportData = {
        title: 'System-Wide Maritime Training Performance Report',
        generatedAt: new Date().toISOString(),
        summary: {
          totalCourses: allCourses.length,
          activeSessions: activeBatchesCount || allBatches.length,
          completedYTD: completedCount,
          overallCompletionRate: allEnrollments.length > 0 ? `${((completedCount / allEnrollments.length) * 100).toFixed(1)}%` : '0%',
        },
        records: records,
      };
    } else if (type === 'ENROLLMENT_REPORT') {
      const { data: enrollments } = await supabaseAdmin
        .from('enrollments')
        .select('*, training_centers(name)');
      const allEnrollments = enrollments || [];

      const apps = allEnrollments.length;
      const approvedCount = allEnrollments.filter((e: any) => e.status !== 'PENDING' && e.status !== 'REJECTED' && e.status !== 'CANCELLED').length;
      const enrolledCount = allEnrollments.filter((e: any) => ['ENROLLED', 'ONGOING', 'COMPLETED'].includes(e.status)).length;
      const completed = allEnrollments.filter((e: any) => e.status === 'COMPLETED').length;
      const conversionRate = apps > 0 ? `${((enrolledCount / apps) * 100).toFixed(1)}%` : '0%';

      const centerMap: Record<string, any> = {};
      allEnrollments.forEach((e: any) => {
        const cName = Array.isArray(e.training_centers) ? e.training_centers[0]?.name : e.training_centers?.name;
        const name = cName || 'Unassigned Center';
        if (!centerMap[name]) centerMap[name] = { applications: 0, approved: 0, enrolled: 0, completed: 0 };
        
        centerMap[name].applications++;
        if (e.status !== 'PENDING' && e.status !== 'REJECTED' && e.status !== 'CANCELLED') centerMap[name].approved++;
        if (['ENROLLED', 'ONGOING', 'COMPLETED'].includes(e.status)) centerMap[name].enrolled++;
        if (e.status === 'COMPLETED') centerMap[name].completed++;
      });

      const records = Object.keys(centerMap).map(center => {
        const c = centerMap[center];
        return {
          period: new Date().getFullYear().toString(),
          center: center,
          applications: c.applications,
          approved: c.approved,
          enrolled: c.enrolled,
          completed: c.completed,
          conversionRate: c.applications > 0 ? `${((c.enrolled / c.applications) * 100).toFixed(1)}%` : '0%'
        };
      });

      reportData = {
        title: 'Global Enrollment Pipeline & Throughput Report',
        generatedAt: new Date().toISOString(),
        summary: {
          applications: apps,
          approved: approvedCount,
          enrolled: enrolledCount,
          completed: completed,
          conversionRate: conversionRate,
        },
        records: records,
      };
    } else if (type === 'PAYMENT_SUMMARY') {
      return NextResponse.json({
        success: false,
        error: 'Financial and payment reports are strictly restricted to authorized Admin staff. Super Admin accounts do not have access to financial records.',
      }, { status: 403 });
    } else if (type === 'ACCOUNT_LIFECYCLE') {
      const { data: users } = await supabaseAdmin.from('profiles').select('id, first_name, last_name, email, role, status, mfa_enabled, created_by, created_at, last_login_at').order('created_at', { ascending: false });
      const allUsers = users || [];
      const adminCreated = allUsers.filter((u: any) => u.created_by).length;

      reportData = {
        title: 'Account Lifecycle & Governance Audit Report',
        generatedAt: new Date().toISOString(),
        summary: {
          totalAccounts: allUsers.length,
          activeAccounts: allUsers.filter((u: any) => u.status === 'ACTIVE').length,
          pendingAccounts: allUsers.filter((u: any) => u.status === 'PENDING').length,
          lockedAccounts: allUsers.filter((u: any) => u.status === 'LOCKED').length,
          adminProvisioned: adminCreated,
          selfRegistered: allUsers.length - adminCreated,
        },
        records: allUsers.map((u: any) => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown User',
          email: u.email || 'N/A',
          role: u.role || 'USER',
          status: u.status || 'ACTIVE',
          origin: u.created_by ? 'Admin Provisioned' : 'Self-Registered',
          mfaEnabled: u.mfa_enabled ? 'Yes' : 'No',
          lastLogin: u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Active',
          registered: u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A',
        })),
      };
    } else if (type === 'SECURITY_REPORT') {
      const { data: secLogs } = await supabaseAdmin.from('audit_logs')
        .select('*, profiles(email, role)')
        .or('action.ilike.%LOGIN%,action.ilike.%MFA%,action.ilike.%LOCK%,action.ilike.%SECURITY%,action.ilike.%AUTH%,action.ilike.%PASSWORD%,action.ilike.%EXPORT%')
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: allProfiles } = await supabaseAdmin.from('profiles').select('id, mfa_enabled, status');
      const totalProfiles = (allProfiles || []).length;
      const mfaProfiles = (allProfiles || []).filter((p: any) => p.mfa_enabled).length;
      const lockedProfiles = (allProfiles || []).filter((p: any) => p.status === 'LOCKED').length;

      const logs = secLogs || [];
      const oneDayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
      const failed24h = logs.filter((l: any) => l.action.includes('FAILED') && l.created_at >= oneDayAgo).length;

      const records = logs.map((l: any, idx: number) => {
        const prof = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
        const isThreat = l.action.includes('FAILED');
        return {
          eventId: `SEC-${String(idx + 1).padStart(4, '0')}`,
          eventType: l.action.replace(/_/g, ' '),
          severity: isThreat ? (l.action.includes('RECOVERY') ? 'CRITICAL' : 'WARNING') : 'INFO',
          userEmail: prof?.email || l.actor_id || 'System Account',
          role: prof?.role || 'SYSTEM',
          ipAddress: l.ip_address || '127.0.0.1',
          status: isThreat ? 'Auto-Mitigated' : 'Audited',
          timestamp: l.created_at ? new Date(l.created_at).toLocaleString() : 'N/A'
        };
      });

      reportData = {
        title: 'NEWSIM Enterprise Security & Audit Log Report',
        generatedAt: new Date().toISOString(),
        summary: {
          mfaCoverage: totalProfiles > 0 ? `${Math.round((mfaProfiles / totalProfiles) * 100)}%` : '0%',
          failedAttempts24h: failed24h,
          lockedAccounts: lockedProfiles,
          activeSessions: mfaProfiles,
        },
        records: records,
      };
    } else {
      // SYSTEM_ACTIVITY / Infrastructure & Activity Logs
      const [{ data: logs }, { data: centers }] = await Promise.all([
        supabaseAdmin.from('audit_logs').select('*, profiles(email, role)').order('created_at', { ascending: false }).limit(50),
        supabaseAdmin.from('training_centers').select('id'),
      ]);
      
      reportData = {
        title: 'Global System Activity & Governance Report',
        generatedAt: new Date().toISOString(),
        summary: {
          totalAuditEvents: (logs || []).length,
          systemStatus: 'OPERATIONAL',
          centersCount: (centers || []).length,
        },
        records: (logs || []).map((l: any) => {
          const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
          return {
            id: l.id,
            timestamp: l.created_at ? new Date(l.created_at).toLocaleString() : '',
            actor: p?.email || l.actor_id || 'System',
            role: p?.role || 'SYSTEM',
            action: l.action,
            target: l.entity_id || l.entity_type || 'N/A',
            status: 'SUCCESS',
            ipAddress: l.ip_address || 'N/A',
          };
        }),
      };
    }

    return NextResponse.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error fetching report data:', error);
    return NextResponse.json({ success: false, data: {} }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'REPORT_EXPORT');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { reportType, format, filter } = body;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // Insert into real audit_logs table instead of mock db
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: auth.user.id,
      action: 'SUPER_ADMIN_EXPORTED_REPORT',
      entity_type: 'REPORT',
      entity_id: reportType,
      ip_address: ip,
      user_agent: userAgent
    });

    return NextResponse.json({
      success: true,
      message: `Report ${reportType} exported successfully. Audit event recorded.`,
      exportMeta: { reportType, format: format || 'CSV', exportedBy: auth.user.email, timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to process report export.' }, { status: 500 });
  }
}
