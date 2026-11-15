import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, clearSessionCookies, logAuditEvent, signOut } from '@newsim/auth';

export async function POST(req: NextRequest) {
  const roleParam = req.nextUrl.searchParams.get('role');
  const referer = req.headers.get('referer') || '';
  const inferredRole =
    roleParam ||
    (referer.includes('/super-admin')
      ? 'SUPER_ADMIN'
      : referer.includes('/admin')
        ? 'ADMIN'
        : undefined);
  try {
    const session = getSessionFromRequest(req, inferredRole);
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    if (session) {
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

      // Try Supabase Auth signOut if access token present
      try {
        const authHeader = req.headers.get('authorization');
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
        if (token) {
          await signOut(token);
        }
      } catch {
        // Ignore token invalidation errors on logout
      }
    }

    const res = NextResponse.json({ success: true, message: 'Logged out successfully.' });
    clearSessionCookies(res, inferredRole || session?.role || 'ADMIN');
    return res;
  } catch (error: any) {
    const res = NextResponse.json({ success: true, message: 'Session terminated.' });
    clearSessionCookies(res, inferredRole || 'ADMIN');
    return res;
  }
}
