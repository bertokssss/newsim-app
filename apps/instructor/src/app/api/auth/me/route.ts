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

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Make sure Super Admin revocations are up to date before resolving the session
    await refreshSessionRevocations();

    const session = getSessionFromRequest(req, 'INSTRUCTOR');
    if (!session) {
      if (isSessionExpiredDueToInactivity(req, 'INSTRUCTOR')) {
        const res = NextResponse.json(
          { success: false, code: 'SESSION_EXPIRED_INACTIVITY', error: INACTIVITY_EXPIRED_MESSAGE },
          { status: 401 }
        );
        clearSessionCookies(res, 'INSTRUCTOR');
        return res;
      }

      const revoked = getRevokedSessionFromRequest(req, 'INSTRUCTOR');
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

    // Fetch fresh profile from Supabase
    let freshProfile: any = null;
    try {
      freshProfile = await getProfileByAuthId(activeUser.id);
    } catch {}

    const resolvedRole = (freshProfile?.role || activeUser.role || 'INSTRUCTOR').toUpperCase();
    const resolvedPermissions = await resolveEffectivePermissionsForUser(activeUser.id, resolvedRole);

    return NextResponse.json({
      success: true,
      user: {
        id: activeUser.id,
        email: freshProfile?.email || activeUser.email,
        username: freshProfile?.username || activeUser.username,
        role: resolvedRole,
        status: freshProfile?.status || activeUser.status,
        firstName: freshProfile?.first_name || activeUser.firstName,
        lastName: freshProfile?.last_name || activeUser.lastName,
        phone: freshProfile?.phone || activeUser.phone || '',
        avatarUrl: freshProfile?.avatar_url || (activeUser as any)?.avatarUrl || null,
        department: freshProfile?.department || activeUser.department,
        mfaEnabled: freshProfile ? Boolean(freshProfile.mfa_enabled && freshProfile.mfa_secret) : activeUser.mfaEnabled,
        lastLoginAt: freshProfile?.last_login_at || activeUser.lastLoginAt,
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
