import { NextRequest } from 'next/server';
import { db, supabaseAdmin } from '@newsim/database';
import {
  getDefaultPermissionsForRole,
  hasModulePermission,
  isFinancialPermissionId,
  normalizeRbacRole,
  RbacRole,
  sanitizePermissionsForRole,
} from '@newsim/utils';
import {
  SuperAdminAuthResult,
  verifyAdminRequest,
  verifyInstructorRequest,
  verifySuperAdminRequest,
  verifyTraineeRequest,
} from './auth-guard';

const ROLE_PERM_CACHE_TTL_MS = 5_000;

interface RolePermCacheEntry {
  permissions: string[];
  expiresAt: number;
}

const rolePermCache = new Map<RbacRole, RolePermCacheEntry>();
let tableSeededCache: { seeded: boolean; expiresAt: number } | null = null;

/**
 * Clears cached role permissions inside this server process immediately after an admin update.
 */
export function invalidateRolePermissionsCache(role?: string): void {
  if (role) {
    rolePermCache.delete(normalizeRbacRole(role));
  } else {
    rolePermCache.clear();
  }
  tableSeededCache = null;
}

async function isRolePermissionsTableSeeded(): Promise<boolean> {
  if (tableSeededCache && tableSeededCache.expiresAt > Date.now()) {
    return tableSeededCache.seeded;
  }
  try {
    const { count, error } = await supabaseAdmin
      .from('role_permissions')
      .select('role', { count: 'exact', head: true });
    if (error) return false;
    const seeded = (count ?? 0) > 0;
    tableSeededCache = { seeded, expiresAt: Date.now() + ROLE_PERM_CACHE_TTL_MS };
    return seeded;
  } catch {
    return false;
  }
}

/**
 * Loads live module permissions for a role from Supabase `role_permissions` with a 5-second cache.
 * Falls back to role defaults only if the database table is completely unseeded or unreachable.
 */
export async function getRolePermissionsFromDb(role: string): Promise<string[]> {
  const normRole = normalizeRbacRole(role);
  const cached = rolePermCache.get(normRole);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('role_permissions')
      .select('permission')
      .eq('role', normRole);

    if (error) {
      throw error;
    }

    const rows = (data || []).map((r: { permission: string }) => String(r.permission || '').toUpperCase().trim()).filter(Boolean);

    if (rows.length > 0) {
      const sanitized = sanitizePermissionsForRole(normRole, rows);
      rolePermCache.set(normRole, {
        permissions: sanitized,
        expiresAt: Date.now() + ROLE_PERM_CACHE_TTL_MS,
      });
      return sanitized;
    }

    // 0 rows for this specific role: distinguish between empty unseeded table vs intentionally cleared role
    const tableSeeded = await isRolePermissionsTableSeeded();
    if (!tableSeeded) {
      const defaults = getDefaultPermissionsForRole(normRole);
      rolePermCache.set(normRole, {
        permissions: defaults,
        expiresAt: Date.now() + ROLE_PERM_CACHE_TTL_MS,
      });
      return defaults;
    }

    const resolved = sanitizePermissionsForRole(normRole, []);
    rolePermCache.set(normRole, {
      permissions: resolved,
      expiresAt: Date.now() + ROLE_PERM_CACHE_TTL_MS,
    });
    return resolved;
  } catch {
    const allPerms = db.getRolePermissions();
    const mem = Array.isArray(allPerms[normRole]) ? allPerms[normRole] : [];
    const fallback = mem.length > 0
      ? sanitizePermissionsForRole(normRole, mem)
      : getDefaultPermissionsForRole(normRole);
    return fallback;
  }
}

/**
 * Resolves effective module permissions for an authenticated user:
 * - SUPER_ADMIN: live `role_permissions` (strictly non-financial, mandatory governance preserved)
 * - INSTRUCTOR / TRAINEE: live `role_permissions`
 * - ADMIN: live `role_permissions('ADMIN')` intersected with per-admin `admins.permissions`
 *   (or non-financial ADMIN policy if `admins.permissions` is empty — financial rights MUST be explicit).
 */
export async function resolveEffectivePermissionsForUser(
  userId: string,
  role: string,
  explicitAdminPerms?: string[] | null
): Promise<string[]> {
  const normRole = normalizeRbacRole(role);
  const rolePolicy = await getRolePermissionsFromDb(normRole);

  if (normRole !== 'ADMIN') {
    return rolePolicy;
  }

  let rawAdminPerms: string[] = [];
  if (Array.isArray(explicitAdminPerms)) {
    rawAdminPerms = explicitAdminPerms;
  } else {
    try {
      const { data: adminRow } = await supabaseAdmin
        .from('admins')
        .select('permissions')
        .eq('profile_id', userId)
        .maybeSingle();
      if (adminRow && Array.isArray(adminRow.permissions)) {
        rawAdminPerms = adminRow.permissions;
      }
    } catch {
      rawAdminPerms = [];
    }
  }

  const normalizedAdminPerms = rawAdminPerms
    .map((p) => String(p || '').toUpperCase().trim())
    .filter(Boolean);

  if (normalizedAdminPerms.length === 0) {
    // Default operational admin with no explicit overrides: inherit non-financial ADMIN modules only
    return rolePolicy.filter((p) => !isFinancialPermissionId(p));
  }

  if (normalizedAdminPerms.includes('ALL')) {
    return rolePolicy;
  }

  // Intersect explicit per-admin grants (with safe compatibility aliases) against the role-wide ADMIN policy
  const effective = new Set<string>();
  for (const perm of normalizedAdminPerms) {
    if (perm === 'ATTENDANCE_MONITOR' && hasModulePermission(rolePolicy, 'ATTENDANCE_MANAGE', 'ADMIN')) {
      effective.add('ATTENDANCE_MANAGE');
    } else if (perm === 'USER_VIEW' && hasModulePermission(rolePolicy, 'ENROLLMENT_VIEW', 'ADMIN')) {
      effective.add('ENROLLMENT_VIEW');
    } else if (
      (perm === 'FINANCIAL_REPORTS' || perm === 'FINANCIAL_ACCESS') &&
      hasModulePermission(rolePolicy, 'PAYMENT_VIEW', 'ADMIN')
    ) {
      effective.add('PAYMENT_VIEW');
    } else if (hasModulePermission(rolePolicy, perm, 'ADMIN')) {
      effective.add(perm);
    }
  }

  return Array.from(effective);
}

/**
 * Checks live RBAC role_permissions for Super Admin routes and guarantees payment isolation.
 */
export async function verifySuperAdminRequestAsync(
  req: NextRequest,
  requiredPermission?: string
): Promise<SuperAdminAuthResult> {
  const base = verifySuperAdminRequest(req, requiredPermission);
  if (!base.authorized || !base.user) {
    return base;
  }

  const effectivePermissions = await resolveEffectivePermissionsForUser(base.user.id, 'SUPER_ADMIN');
  const enrichedUser = {
    ...base.user,
    permissions: effectivePermissions,
  };

  if (requiredPermission && !hasModulePermission(effectivePermissions, requiredPermission, 'SUPER_ADMIN')) {
    return {
      authorized: false,
      error: `Insufficient permission: Missing required privilege '${requiredPermission}'.`,
      statusCode: 403,
    };
  }

  return {
    ...base,
    user: enrichedUser,
  };
}

/**
 * Checks live RBAC role_permissions for Admin and Super Admin routes and guarantees payment isolation.
 */
export async function verifyAdminRequestAsync(
  req: NextRequest,
  requiredPermission?: string
): Promise<SuperAdminAuthResult> {
  const base = verifyAdminRequest(req);
  if (!base.authorized || !base.user) {
    return base;
  }

  const normRole = normalizeRbacRole(base.user.role) === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

  if (requiredPermission) {
    const isPaymentPerm = [
      'PAYMENT_VIEW',
      'PAYMENT_VERIFY',
      'PAYMENT_REFUND',
      'FINANCIAL_REPORTS',
      'FINANCIAL_ACCESS',
    ].includes(requiredPermission.toUpperCase());

    if (isPaymentPerm && normRole === 'SUPER_ADMIN') {
      return {
        authorized: false,
        error: `Financial privacy restriction: Super Admin accounts are restricted from '${requiredPermission}'.`,
        statusCode: 403,
      };
    }
  }

  const effectivePermissions = await resolveEffectivePermissionsForUser(base.user.id, normRole);
  const enrichedUser = {
    ...base.user,
    permissions: effectivePermissions,
  };

  if (requiredPermission && !hasModulePermission(effectivePermissions, requiredPermission, normRole)) {
    return {
      authorized: false,
      error: `Insufficient permission: Missing required privilege '${requiredPermission}'.`,
      statusCode: 403,
    };
  }

  return {
    ...base,
    user: enrichedUser,
  };
}

/**
 * Checks live RBAC role_permissions for Instructor portal API routes.
 */
export async function verifyInstructorRequestAsync(
  req: NextRequest,
  requiredPermission?: string
): Promise<SuperAdminAuthResult> {
  const base = verifyInstructorRequest(req, requiredPermission);
  if (!base.authorized || !base.user) {
    return base;
  }

  const targetRole = normalizeRbacRole(base.user.role) === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'INSTRUCTOR';
  const effectivePermissions = await resolveEffectivePermissionsForUser(base.user.id, targetRole);
  const enrichedUser = {
    ...base.user,
    permissions: effectivePermissions,
  };

  if (requiredPermission && targetRole !== 'SUPER_ADMIN' && !hasModulePermission(effectivePermissions, requiredPermission, 'INSTRUCTOR')) {
    return {
      authorized: false,
      error: `Insufficient permission: Module access '${requiredPermission}' is disabled for Instructors.`,
      statusCode: 403,
    };
  }

  return {
    ...base,
    user: enrichedUser,
  };
}

/**
 * Checks live RBAC role_permissions for Trainee portal API routes.
 */
export async function verifyTraineeRequestAsync(
  req: NextRequest,
  requiredPermission?: string
): Promise<SuperAdminAuthResult> {
  const base = verifyTraineeRequest(req, requiredPermission);
  if (!base.authorized || !base.user) {
    return base;
  }

  const effectivePermissions = await resolveEffectivePermissionsForUser(base.user.id, 'TRAINEE');
  const enrichedUser = {
    ...base.user,
    permissions: effectivePermissions,
  };

  if (requiredPermission && !hasModulePermission(effectivePermissions, requiredPermission, 'TRAINEE')) {
    return {
      authorized: false,
      error: `Insufficient permission: Module access '${requiredPermission}' is disabled for Trainees.`,
      statusCode: 403,
    };
  }

  return {
    ...base,
    user: enrichedUser,
  };
}
