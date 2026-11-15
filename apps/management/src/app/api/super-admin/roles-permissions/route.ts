import { NextRequest, NextResponse } from 'next/server';
import {
  verifySuperAdminRequestAsync,
  createUnauthorizedResponse,
  createForbiddenResponse,
  logAuditEvent,
  getRolePermissionsFromDb,
  invalidateRolePermissionsCache,
} from '@newsim/auth';
import {
  getMandatoryPermissionsForRole,
  getPermissionsCatalogForRole,
  isFinancialPermissionId,
  normalizeRbacRole,
  RbacRole,
  sanitizePermissionsForRole,
} from '@newsim/utils';
import { db, dispatchNotificationEvent, NOTIFICATION_EVENTS, supabaseAdmin } from '@newsim/database';

const MANAGED_ROLES: RbacRole[] = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'TRAINEE'];

async function loadAllRolePermissions(): Promise<Record<string, string[]>> {
  const entries = await Promise.all(
    MANAGED_ROLES.map(async (r) => [r, await getRolePermissionsFromDb(r)] as const)
  );
  return Object.fromEntries(entries);
}

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'ROLE_PERMISSION_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const [roleMap, { data: profiles }] = await Promise.all([
    loadAllRolePermissions(),
    supabaseAdmin.from('profiles').select('role'),
  ]);

  const availablePermissionsByRole: Record<string, ReturnType<typeof getPermissionsCatalogForRole>> = {
    SUPER_ADMIN: getPermissionsCatalogForRole('SUPER_ADMIN'),
    ADMIN: getPermissionsCatalogForRole('ADMIN'),
    INSTRUCTOR: getPermissionsCatalogForRole('INSTRUCTOR'),
    TRAINEE: getPermissionsCatalogForRole('TRAINEE'),
  };

  const countForRole = (r: string) =>
    (profiles || []).filter((p: { role?: string | null }) => normalizeRbacRole(p.role) === r).length;

  return NextResponse.json({
    success: true,
    data: {
      availablePermissionsByRole,
      rolePermissions: roleMap,
      roles: [
        {
          id: 'SUPER_ADMIN',
          name: 'Super Administrator',
          description: 'Master governance portal for admin/instructor/trainee accounts, RBAC policies, security, audit trails, and system settings (financial access permanently isolated).',
          isProtected: true,
          userCount: countForRole('SUPER_ADMIN'),
        },
        {
          id: 'ADMIN',
          name: 'Administrator',
          description: 'Training center operations across courses, batches, enrollments, assessments, attendance, schedules, instructor leaves, certificates, and billing-scoped payments.',
          isProtected: false,
          userCount: countForRole('ADMIN'),
        },
        {
          id: 'INSTRUCTOR',
          name: 'Maritime Instructor',
          description: 'Assigned courses, supplementary materials, trainee progress, practical assessments, gradebook submission, attendance roll call, teaching schedules, and leave requests.',
          isProtected: false,
          userCount: countForRole('INSTRUCTOR'),
        },
        {
          id: 'TRAINEE',
          name: 'Maritime Trainee',
          description: 'Enrolled courses and daily learning, catalog enrollment, assessments, grades, attendance/progress, schedules, tuition payments, and certificates.',
          isProtected: false,
          userCount: countForRole('TRAINEE'),
        },
      ],
    },
  });
}

export async function PUT(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'ROLE_PERMISSION_UPDATE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { role, permissions } = body;

    if (!role || typeof role !== 'string' || !Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: 'Role and permissions array are required.' },
        { status: 400 }
      );
    }

    const rawRole = role.trim().toUpperCase().replace(/[-\s]+/g, '_');
    if (!MANAGED_ROLES.includes(rawRole as RbacRole)) {
      return NextResponse.json(
        { success: false, error: `Unsupported role '${role}'.` },
        { status: 400 }
      );
    }
    const normRole = rawRole as RbacRole;

    // Least-Privilege Safeguard: SUPER_ADMIN cannot be assigned financial payment permissions
    if (normRole === 'SUPER_ADMIN') {
      const forbiddenFinancialPerms = permissions.filter(
        (p: unknown) => typeof p === 'string' && isFinancialPermissionId(p)
      );
      if (forbiddenFinancialPerms.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Least-Privilege Safeguard: Super Administrator cannot hold financial payment permissions (${forbiddenFinancialPerms.join(', ')}).`,
          },
          { status: 403 }
        );
      }

      const normalizedInput = permissions.map((p: unknown) => String(p || '').toUpperCase().trim());
      const mandatorySuperAdminPerms = getMandatoryPermissionsForRole('SUPER_ADMIN');
      const missingMandatory = mandatorySuperAdminPerms.filter((p) => !normalizedInput.includes(p));
      if (missingMandatory.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Master Super Admin Safeguard: Critical system governance permissions cannot be removed: ${missingMandatory.join(', ')}`,
          },
          { status: 403 }
        );
      }
    }

    // Keep only valid permissions belonging to this role's real portal modules
    const sanitizedPermissions = sanitizePermissionsForRole(normRole, permissions);

    // Persist to Supabase role_permissions table
    const { error: delErr } = await supabaseAdmin.from('role_permissions').delete().eq('role', normRole);
    if (delErr) throw delErr;

    if (sanitizedPermissions.length > 0) {
      const rows = sanitizedPermissions.map((p: string) => ({
        role: normRole,
        permission: p,
      }));
      const { error: insErr } = await supabaseAdmin.from('role_permissions').insert(rows);
      if (insErr) throw insErr;
    }

    // Synchronize caches immediately across server memory
    db.updateRolePermissions(normRole, sanitizedPermissions);
    invalidateRolePermissionsCache(normRole);

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: auth.user.id,
        action: 'ROLE_PERMISSIONS_UPDATED',
        entity_type: 'ROLE_PERMISSION',
        entity_id: normRole,
        new_values: { role: normRole, permissionsCount: sanitizedPermissions.length, permissions: sanitizedPermissions },
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('Could not write audit log:', auditErr);
    }

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: 'PERMISSION_CHANGED',
      targetType: 'ROLE',
      targetId: normRole,
      details: { role: normRole, permissionsCount: sanitizedPermissions.length },
      ipAddress: ip,
      userAgent,
      severity: 'WARNING',
    });

    dispatchNotificationEvent({
      event: NOTIFICATION_EVENTS.ROLE_PERMISSIONS_UPDATED,
      entityType: 'ROLE',
      metadata: {
        targetRole: normRole,
        permissionsCount: sanitizedPermissions.length,
      },
    }).catch(() => {});

    const updatedRoleMap = await loadAllRolePermissions();

    return NextResponse.json({
      success: true,
      message: `Permissions updated for role ${normRole}.`,
      rolePermissions: updatedRoleMap,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to update role permissions.';
    console.error('Failed to update role permissions in Supabase:', error);
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
