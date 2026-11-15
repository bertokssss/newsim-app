import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionFromRequest,
  getProfileByAuthId,
  getRevokedSessionFromRequest,
  isSessionExpiredDueToInactivity,
  INACTIVITY_EXPIRED_MESSAGE,
  refreshSessionRevocations,
  clearSessionCookies,
  hasAcceptedCurrentTerms,
  TERMS_VERSION,
  resolveEffectivePermissionsForUser,
} from '@newsim/auth';
import { supabaseAdmin, resolveRealSrn } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    // Make sure Super Admin revocations are up to date before resolving the session
    await refreshSessionRevocations();

    const session = getSessionFromRequest(req, 'TRAINEE');
    if (!session) {
      if (isSessionExpiredDueToInactivity(req, 'TRAINEE')) {
        const res = NextResponse.json(
          { success: false, code: 'SESSION_EXPIRED_INACTIVITY', error: INACTIVITY_EXPIRED_MESSAGE },
          { status: 401 }
        );
        clearSessionCookies(res, 'TRAINEE');
        return res;
      }

      const revoked = getRevokedSessionFromRequest(req, 'TRAINEE');
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

    // Fetch fresh profile and trainee SRN from Supabase in parallel
    let freshProfile: any = null;
    let traineeRow: any = null;
    try {
      const [profRes, trnRes] = await Promise.all([
        getProfileByAuthId(activeUser.id),
        supabaseAdmin
          .from('trainees')
          .select('srn, trainee_number')
          .eq('profile_id', activeUser.id)
          .maybeSingle(),
      ]);
      freshProfile = profRes;
      traineeRow = trnRes.data;
    } catch {
      // Fall back to session user metadata
    }

    const role = (freshProfile?.role || activeUser.role || 'TRAINEE').toUpperCase();
    const resolvedSrn = resolveRealSrn(traineeRow, freshProfile);
    const termsAccepted =
      freshProfile?.terms_accepted_version === TERMS_VERSION
        ? true
        : await hasAcceptedCurrentTerms(activeUser.id);

    const resolvedPermissions = await resolveEffectivePermissionsForUser(activeUser.id, role);

    return NextResponse.json({
      success: true,
      termsAccepted,
      termsVersion: TERMS_VERSION,
      user: {
        id: activeUser.id,
        email: freshProfile?.email || activeUser.email,
        username: freshProfile?.username || activeUser.username,
        srn: resolvedSrn,
        role: role,
        status: freshProfile?.status || activeUser.status || 'ACTIVE',
        firstName: freshProfile?.first_name || activeUser.firstName,
        lastName: freshProfile?.last_name || activeUser.lastName,
        department: freshProfile?.department || activeUser.department,
        avatarUrl: freshProfile?.avatar_url || (activeUser as any).avatarUrl || null,
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
