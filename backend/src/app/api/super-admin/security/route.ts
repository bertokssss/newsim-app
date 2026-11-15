import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

export async function GET(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'SECURITY_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const allUsers = db.getUsers();
  const privilegedUsers = allUsers.filter((u) => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN');
  const mfaEnabledPrivileged = privilegedUsers.filter((u) => u.mfaEnabled).length;
  const mfaCoverage = Math.round((mfaEnabledPrivileged / (privilegedUsers.length || 1)) * 100);

  const activeSessions = db.getSessions();
  const securityEvents = db.getSecurityEvents();
  const loginAuditLogs = db.getAuditLogs().filter((l) => l.action.startsWith('LOGIN_') || l.action === 'LOGOUT').slice(0, 30);
  const failedAttempts24h = db.getAuditLogs().filter((l) => l.action === 'LOGIN_FAILED' && new Date(l.timestamp).getTime() > Date.now() - 24 * 3600000).length;
  const lockedAccounts = allUsers.filter((u) => u.status === 'LOCKED').length;

  return NextResponse.json({
    success: true,
    data: {
      overview: {
        securityStatus: lockedAccounts > 5 ? 'ELEVATED_ALERT' : 'PROTECTED',
        mfaCoverage: `${mfaCoverage}%`,
        failedLoginAttempts24h: failedAttempts24h,
        lockedAccounts,
        suspiciousEventsCount: securityEvents.filter((e) => !e.resolved).length,
        activeSessionsCount: activeSessions.length,
      },
      loginActivity: loginAuditLogs.map((l) => ({
        id: l.id,
        timestamp: l.timestamp,
        actorEmail: l.actorEmail,
        actorRole: l.actorRole,
        action: l.action,
        status: l.status,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        details: l.details,
      })),
      activeSessions: activeSessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userEmail: s.userEmail,
        userRole: s.userRole,
        userName: s.userName,
        device: s.device,
        ipAddress: s.ipAddress,
        loginTime: s.createdAt,
        lastActivity: s.lastActiveAt,
        isCurrent: auth.sessionId === s.id,
      })),
      securityEvents: securityEvents.map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        eventType: e.eventType,
        severity: e.severity,
        targetUser: e.targetUser || 'System-wide',
        ipAddress: e.ipAddress,
        description: e.description,
        resolved: e.resolved,
      })),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'SESSION_REVOKE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { action, sessionId, eventId } = body;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    if (action === 'REVOKE_SESSION') {
      if (!sessionId) {
        return NextResponse.json({ success: false, error: 'Session ID is required.' }, { status: 400 });
      }

      const revoked = db.revokeSession(sessionId);
      if (!revoked) {
        return NextResponse.json({ success: false, error: 'Session not found or already terminated.' }, { status: 404 });
      }

      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'SESSION_REVOKED',
        targetType: 'SESSION',
        targetId: sessionId,
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });

      return NextResponse.json({
        success: true,
        message: 'Session has been revoked immediately.',
      });
    }

    if (action === 'RESOLVE_SECURITY_EVENT') {
      if (!eventId) {
        return NextResponse.json({ success: false, error: 'Event ID is required.' }, { status: 400 });
      }

      db.resolveSecurityEvent(eventId);

      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'SECURITY_EVENT_RESOLVED',
        targetType: 'SECURITY_EVENT',
        targetId: eventId,
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      return NextResponse.json({
        success: true,
        message: 'Security event marked as resolved.',
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
