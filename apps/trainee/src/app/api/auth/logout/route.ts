import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, clearSessionCookies } from '@newsim/auth';
import { db } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req, 'TRAINEE');
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    if (session) {
      db.revokeSession(session.sessionId);
      logAuditEvent({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: 'LOGOUT',
        targetType: 'SESSION',
        targetId: session.sessionId,
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });
    }

    const res = NextResponse.json({ success: true, message: 'Logged out successfully.' });
    clearSessionCookies(res, 'TRAINEE');
    for (const c of req.cookies.getAll()) {
      if (c.name.startsWith('sb-')) {
        res.cookies.delete(c.name);
      }
    }
    return res;
  } catch (error: any) {
    const res = NextResponse.json({ success: true, message: 'Session terminated.' });
    clearSessionCookies(res, 'TRAINEE');
    for (const c of req.cookies.getAll()) {
      if (c.name.startsWith('sb-')) {
        res.cookies.delete(c.name);
      }
    }
    return res;
  }
}
