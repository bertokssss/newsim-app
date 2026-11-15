import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { hasModulePermission } from '@newsim/utils';
import { supabaseAdmin } from '@newsim/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req);
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const perms = auth.user.permissions || [];
  const { searchParams } = new URL(req.url);
  const rawQ = searchParams.get('q')?.trim() || '';
  const { escapePostgrestFilter } = await import('@newsim/database');
  const q = escapePostgrestFilter(rawQ);

  if (!q) {
    return NextResponse.json({
      success: true,
      data: {
        admins: [],
        instructors: [],
        trainees: [],
        auditLogs: [],
      },
    });
  }

  const canAdminView = hasModulePermission(perms, 'ADMIN_VIEW', 'SUPER_ADMIN');
  const canInstructorView = hasModulePermission(perms, 'INSTRUCTOR_VIEW', 'SUPER_ADMIN');
  const canTraineeView = hasModulePermission(perms, 'TRAINEE_VIEW', 'SUPER_ADMIN');
  const canAuditView = hasModulePermission(perms, 'AUDIT_LOG_VIEW', 'SUPER_ADMIN');

  try {
    const [
      { data: dbAdmins, error: adminErr },
      { data: dbInstructors, error: instErr },
      { data: dbTrainees, error: traineeErr },
      { data: dbAuditLogs, error: auditErr },
    ] = await Promise.all([
      canAdminView
        ? supabaseAdmin
            .from('profiles')
            .select('id, email, first_name, last_name, role, status, avatar_url')
            .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
            .in('role', ['ADMIN', 'SUPER_ADMIN'])
            .limit(6)
        : Promise.resolve({ data: [], error: null }),
      canInstructorView
        ? supabaseAdmin
            .from('profiles')
            .select('id, email, first_name, last_name, role, status, avatar_url')
            .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
            .eq('role', 'INSTRUCTOR')
            .limit(6)
        : Promise.resolve({ data: [], error: null }),
      canTraineeView
        ? supabaseAdmin
            .from('profiles')
            .select('id, email, first_name, last_name, username, role, status, avatar_url')
            .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,username.ilike.%${q}%`)
            .eq('role', 'TRAINEE')
            .limit(6)
        : Promise.resolve({ data: [], error: null }),
      canAuditView
        ? supabaseAdmin
            .from('audit_logs')
            .select('id, action, entity_type, created_at, profiles(email, role, first_name, last_name, avatar_url)')
            .ilike('action', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(6)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (adminErr) console.error('SuperAdmin Search: Admin error', adminErr);
    if (instErr) console.error('SuperAdmin Search: Instructor error', instErr);
    if (traineeErr) console.error('SuperAdmin Search: Trainee error', traineeErr);
    if (auditErr) console.error('SuperAdmin Search: Audit error', auditErr);

    const admins = (dbAdmins || []).map((u: any) => ({
      id: u.id,
      title: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Administrator',
      subtitle: `${u.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} • ${u.email}`,
      link: '/super-admin/admins',
      category: 'Admins',
      status: u.status || 'ACTIVE',
      avatarUrl: u.avatar_url || null,
    }));

    const instructors = (dbInstructors || []).map((u: any) => ({
      id: u.id,
      title: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Instructor',
      subtitle: `Instructor • ${u.email}`,
      link: '/super-admin/instructor-accounts',
      category: 'Instructors',
      status: u.status || 'ACTIVE',
      avatarUrl: u.avatar_url || null,
    }));

    const trainees = (dbTrainees || []).map((u: any) => ({
      id: u.id,
      title: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Trainee',
      subtitle: `Trainee • ${u.username || u.email}`,
      link: '/super-admin/trainee-accounts',
      category: 'Trainees',
      status: u.status || 'ACTIVE',
      avatarUrl: u.avatar_url || null,
    }));

    const auditLogs = (dbAuditLogs || []).map((l: any) => {
      const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
      return {
        id: l.id,
        title: l.action || 'Audit Event',
        subtitle: `${p?.email || 'System'} • ${l.created_at ? new Date(l.created_at).toLocaleString() : ''}`,
        link: '/super-admin/audit-logs',
        category: 'Audit Logs',
        status: 'ACTIVE',
        avatarUrl: p?.avatar_url || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        admins,
        instructors,
        trainees,
        auditLogs,
      },
    });
  } catch (error) {
    console.error('SuperAdmin Search unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 });
  }
}
