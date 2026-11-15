import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionFromRequest,
  getProfileByAuthId,
  getRevokedSessionFromRequest,
  isSessionExpiredDueToInactivity,
  INACTIVITY_EXPIRED_MESSAGE,
  refreshSessionRevocations,
  clearSessionCookies,
  resolveEffectivePermissionsForUser,
} from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const portalParam = req.nextUrl.searchParams.get('portal');
    const referer = req.headers.get('referer') || '';
    const isSuperAdminPortal = portalParam === 'super-admin' || (!portalParam && referer.includes('/super-admin'));
    const roleHint = isSuperAdminPortal ? 'SUPER_ADMIN' : 'ADMIN';

    // Make sure Super Admin revocations are up to date before resolving the session
    await refreshSessionRevocations();

    const session = getSessionFromRequest(req, roleHint);
    if (!session) {
      if (isSessionExpiredDueToInactivity(req, roleHint)) {
        const res = NextResponse.json(
          { success: false, code: 'SESSION_EXPIRED_INACTIVITY', error: INACTIVITY_EXPIRED_MESSAGE },
          { status: 401 }
        );
        clearSessionCookies(res, roleHint);
        return res;
      }

      const revoked = getRevokedSessionFromRequest(req, roleHint);
      if (revoked) {
        const res = NextResponse.json(
          { success: false, code: 'SESSION_REVOKED', error: 'Your session was revoked by a Super Administrator.' },
          { status: 401 }
        );
        clearSessionCookies(res, revoked.role);
        return res;
      }
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { activeUser, sessionId } = session;

    // Fetch fresh profile from Supabase if available
    let freshProfile = null;
    try {
      freshProfile = await getProfileByAuthId(activeUser.id);
    } catch {
      // Fall back to session user metadata
    }

    const role = (freshProfile?.role || activeUser.role || '').toUpperCase().replace(/[-\s]+/g, '_');

    // If explicitly querying for Super Admin portal, ensure user is a Super Admin
    if (isSuperAdminPortal && role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN') {
      return NextResponse.json(
        { 
          success: false, 
          code: 'SUPER_ADMIN_REQUIRED',
          error: 'Super Admin privileges required to access this portal.',
          userRole: role,
        },
        { status: 403 }
      );
    }

    // Enforce Management Role (SUPER_ADMIN or ADMIN)
    if (role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN' && role !== 'ADMIN' && role !== 'ADMINISTRATOR') {
      return NextResponse.json(
        { success: false, error: 'Your account is not authorized to access the Management Portal.' },
        { status: 403 }
      );
    }

    const resolvedPermissions = await resolveEffectivePermissionsForUser(activeUser.id, role);

    return NextResponse.json({
      success: true,
      user: {
        id: activeUser.id,
        email: activeUser.email,
        username: activeUser.username,
        role: role,
        status: freshProfile?.status || activeUser.status || 'ACTIVE',
        firstName: freshProfile?.first_name || activeUser.firstName,
        lastName: freshProfile?.last_name || activeUser.lastName,
        phone: freshProfile?.phone || activeUser.phone || '',
        avatarUrl: freshProfile?.avatar_url || (activeUser as any)?.avatarUrl || null,
        department: freshProfile?.department || activeUser.department,
        mfaEnabled: freshProfile ? Boolean(freshProfile.mfa_enabled && freshProfile.mfa_secret) : activeUser.mfaEnabled,
        lastLoginAt: activeUser.lastLoginAt,
        permissions: resolvedPermissions,
        sessionId,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve current user.' },
      { status: 500 }
    );
  }
}
