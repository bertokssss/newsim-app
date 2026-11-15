import { NextRequest, NextResponse } from 'next/server';
import {
  verifySuperAdminRequestAsync,
  createUnauthorizedResponse,
  createForbiddenResponse,
  markUserSessionsRevoked,
  parseRevocationLog,
  SESSION_REVOCATION_ACTION,
} from '@newsim/auth';
import { supabaseAdmin, db, dispatchNotificationEvent, NOTIFICATION_EVENTS } from '@newsim/database';

function parseDevice(ua?: string | null): string {
  if (!ua) return 'Desktop (Windows / Browser)';
  if (/iPhone/i.test(ua)) return 'Mobile (iOS / Safari)';
  if (/iPad/i.test(ua)) return 'Tablet (iPadOS / Safari)';
  if (/Android/i.test(ua)) return 'Mobile (Android / Chrome)';
  if (/Edg/i.test(ua)) return 'Desktop (Windows / Edge)';
  if (/Chrome/i.test(ua)) return 'Desktop (Windows / Chrome)';
  if (/Firefox/i.test(ua)) return 'Desktop (Windows / Firefox)';
  if (/Macintosh/i.test(ua)) return 'Desktop (macOS / Safari)';
  return 'Desktop (Windows / Browser)';
}

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'SECURITY_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const revocationsSince = new Date(Date.now() - 24 * 3600000).toISOString();
    const [{ data: authUsersRes }, { data: users }, { data: logs }, { data: revocationLogs }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers(),
      supabaseAdmin.from('profiles').select('id, email, role, status, mfa_enabled, first_name, last_name, avatar_url, last_login_at, created_at'),
      supabaseAdmin.from('audit_logs')
        .select('*, profiles(email, role, first_name, last_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin.from('audit_logs')
        .select('entity_id, created_at, new_values')
        .eq('action', SESSION_REVOCATION_ACTION)
        .gte('created_at', revocationsSince),
    ]);

    const authUsers = authUsersRes?.users || [];
    const allUsers = users || [];
    const profMap = Object.fromEntries(allUsers.map((p: any) => [p.id, p]));
    const allAuditLogs = logs || [];

    // Filter logs relevant to security and login
    const loginAuditLogs = allAuditLogs.filter((l: any) =>
      /LOGIN|MFA|AUTH|LOGOUT|RECOVERY|LOCK|PASSWORD|SECURITY_EVENT_RESOLVED|SUPER_ADMIN_REVOKED_SESSION/i.test(l.action || '')
    );

    // Latest revocation timestamp per user (a session is hidden only if revoked after the user's last sign-in)
    const revokedAtByUser = new Map<string, number>();
    (revocationLogs || []).forEach((row: any) => {
      const parsed = parseRevocationLog(row);
      if (!parsed) return;
      markUserSessionsRevoked(parsed.userId, parsed.revokedAtMs);
      if (parsed.revokedAtMs > (revokedAtByUser.get(parsed.userId) || 0)) {
        revokedAtByUser.set(parsed.userId, parsed.revokedAtMs);
      }
    });

    const resolvedEventIds = new Set(
      allAuditLogs
        .filter((l: any) => l.action === 'SECURITY_EVENT_RESOLVED')
        .map((l: any) => l.entity_id)
    );

    const totalUsers = allUsers.length;
    const mfaUsers = allUsers.filter((u: any) => u.mfa_enabled).length;
    const mfaCoverage = totalUsers > 0 ? `${Math.round((mfaUsers / totalUsers) * 100)}%` : '0%';
    const lockedAccounts = allUsers.filter((u: any) => ['LOCKED', 'SUSPENDED'].includes((u.status || '').toUpperCase())).length;

    // Failed events in 24h
    const oneDayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
    const failedLogs24h = loginAuditLogs.filter(
      (l: any) => l.action.includes('FAILED') && l.created_at >= oneDayAgo
    );
    const failedAttempts24h = failedLogs24h.length;

    // Threat / Incident logs
    const threatLogs = loginAuditLogs.filter((l: any) =>
      l.action.includes('FAILED') || l.action.includes('LOCK') || l.action.includes('UNAUTHORIZED') || l.action.includes('REJECTED')
    );

    const profByEmail = Object.fromEntries(
      allUsers.filter((p: any) => p.email).map((p: any) => [String(p.email).toLowerCase(), p])
    );

    const resolveAuditProfile = (l: any) => {
      const joined = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
      if (joined) return joined;
      if (l.actor_id && profMap[l.actor_id]) return profMap[l.actor_id];
      if (l.entity_id && profMap[l.entity_id]) return profMap[l.entity_id];
      const details = l.new_values && typeof l.new_values === 'object' ? l.new_values : {};
      const emailKey = String(details.actorEmail || details.email || details.targetEmail || '').toLowerCase();
      return emailKey ? profByEmail[emailKey] || null : null;
    };

    const securityEvents = threatLogs.map((l: any) => {
      const prof = resolveAuditProfile(l);
      const isCritical = l.action.includes('RECOVERY') || l.action.includes('LOCK');
      return {
        id: l.id,
        eventType: l.action.replace(/_/g, ' '),
        severity: isCritical ? 'CRITICAL' : 'WARNING',
        description: l.action === 'LOGIN_MFA_FAILED'
          ? 'Repeated MFA 6-digit TOTP verification failure detected during sign-in.'
          : l.action === 'LOGIN_RECOVERY_CODE_FAILED'
          ? 'Invalid or single-use backup recovery code entered during privileged login.'
          : l.action === 'LOGIN_REJECTED_ROLE_MISMATCH'
          ? 'Account attempted login using a non-matching Admin / Super Admin role toggle.'
          : `Security anomaly triggered: ${l.action}`,
        targetUser: prof?.email || l.actor_id || 'System Account',
        targetName: prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || prof.email : 'System Account',
        targetAvatarUrl: prof?.avatar_url || null,
        ipAddress: l.ip_address || '127.0.0.1',
        timestamp: l.created_at,
        resolved: resolvedEventIds.has(l.id),
      };
    });

    // Formulate REALTIME Active Sessions from Supabase Auth + Profiles + Audit Logs
    const currentIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '::1';
    const currentUserAgent = req.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/154.0.0.0';

    const now = Date.now();
    const sessionWindow = 24 * 3600 * 1000; // 24 hours

    // Find accounts genuinely active within the 24h session window
    const activeAuthUsers = authUsers.filter((u: any) => {
      if (!u.last_sign_in_at) return false;
      const signTime = new Date(u.last_sign_in_at).getTime();
      if (now - signTime > sessionWindow) return false;
      // Revoked after their latest sign-in -> session is terminated until they log in again
      const revokedAt = revokedAtByUser.get(u.id);
      if (revokedAt && revokedAt >= signTime) return false;
      return true;
    });

    const activeSessions = activeAuthUsers.map((u: any) => {
      const prof = profMap[u.id];
      const isCurrent = (u.id === auth.user?.id || u.email === auth.user?.email);
      const userLog = allAuditLogs.find((l: any) => l.actor_id === u.id);

      const device = isCurrent ? parseDevice(currentUserAgent) : parseDevice(userLog?.user_agent);
      const ipAddress = isCurrent ? currentIp : (userLog?.ip_address || 'Unknown');
      const lastActivity = isCurrent ? new Date().toISOString() : (userLog?.created_at || u.last_sign_in_at);

      const name = prof 
        ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || prof.email.split('@')[0] 
        : u.user_metadata?.full_name || u.email.split('@')[0];

      return {
        id: `sess-${u.id}`,
        userId: u.id,
        userName: name,
        userEmail: u.email,
        userAvatarUrl: prof?.avatar_url || null,
        userRole: prof?.role || u.user_metadata?.role || 'TRAINEE',
        device,
        ipAddress,
        loginTime: u.last_sign_in_at,
        lastActivity,
        isCurrent,
      };
    }).sort((a: any, b: any) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          securityStatus: lockedAccounts > 0 ? 'ELEVATED_ALERT' : 'PROTECTED',
          mfaCoverage: mfaCoverage,
          failedLoginAttempts24h: failedAttempts24h,
          lockedAccounts: lockedAccounts,
          suspiciousEventsCount: securityEvents.length,
          activeSessionsCount: activeSessions.length,
        },
        loginActivity: loginAuditLogs.map((l: any) => {
          const p = resolveAuditProfile(l);
          const details = l.new_values && typeof l.new_values === 'object' ? l.new_values : {};
          const fallbackEmail = details.actorEmail || details.email || l.actor_id || 'Unknown';
          return {
            id: l.id,
            timestamp: l.created_at,
            actorEmail: p?.email || fallbackEmail,
            actorName: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email : fallbackEmail,
            actorAvatarUrl: p?.avatar_url || null,
            actorRole: p?.role || details.actorRole || 'SYSTEM',
            action: l.action,
            status: l.action.includes('FAILED') || l.action.includes('REJECTED') ? 'FAILURE' : 'SUCCESS',
            ipAddress: l.ip_address || '127.0.0.1',
            userAgent: l.user_agent || 'N/A',
            details,
          };
        }),
        activeSessions: activeSessions,
        securityEvents: securityEvents,
      },
    });
  } catch (error) {
    console.error('Error fetching security data:', error);
    return NextResponse.json({ success: false, data: {} }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'SESSION_REVOKE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { action, sessionId, eventId, userId, userEmail } = body;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    if (action === 'REVOKE_SESSION') {
      const targetUserId: string | null = userId || (sessionId ? String(sessionId).replace(/^sess-/, '') : null);
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!targetUserId || !UUID_RE.test(targetUserId)) {
        return NextResponse.json({ success: false, error: 'Invalid session target.' }, { status: 400 });
      }

      if (targetUserId === auth.user.id) {
        return NextResponse.json(
          { success: false, error: 'You cannot revoke your own current session. Use Sign Out instead.' },
          { status: 400 }
        );
      }

      const revokedAtMs = Date.now();
      const revokedAt = new Date(revokedAtMs).toISOString();

      // 1. Permanently record the revocation (this is what every portal syncs from).
      //    NOTE: audit_logs.entity_id is a UUID column, so it must hold the target user id.
      const { error: insertError } = await supabaseAdmin.from('audit_logs').insert({
        actor_id: auth.user.id,
        action: SESSION_REVOCATION_ACTION,
        entity_type: 'SESSION',
        entity_id: targetUserId,
        ip_address: ip,
        user_agent: userAgent,
        new_values: {
          sessionId,
          targetUserId,
          targetEmail: userEmail,
          revokedBy: auth.user.email,
          revokedAt,
        },
      });

      if (insertError) {
        console.error('Failed to persist session revocation:', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to revoke session. Please try again.' },
          { status: 500 }
        );
      }

      // 2. Apply immediately in this process (other portals pick it up on their next sync)
      markUserSessionsRevoked(targetUserId, revokedAtMs);
      try {
        if (sessionId) db.revokeSession(sessionId);
        db.revokeOtherSessionsForUser(targetUserId, '');
      } catch (err) {
        console.error('Error revoking local session:', err);
      }

      dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.SESSION_REVOKED,
        targetUserId,
        entityType: 'SESSION',
        entityId: targetUserId,
        metadata: {
          targetEmail: userEmail,
          isSelfTarget: true,
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Session has been terminated. ${userEmail || 'The user'} will be signed out of all portals.`,
      });
    }

    if (action === 'RESOLVE_SECURITY_EVENT') {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: auth.user.id,
        action: 'SECURITY_EVENT_RESOLVED',
        entity_type: 'SECURITY_EVENT',
        entity_id: eventId,
        ip_address: ip,
        user_agent: userAgent,
        new_values: { eventId, resolvedBy: auth.user.email, resolvedAt: new Date().toISOString() },
      });

      return NextResponse.json({
        success: true,
        message: `Security event ${eventId} marked as resolved. Audit log updated.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid security action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Security operation failed.' },
      { status: 500 }
    );
  }
}
