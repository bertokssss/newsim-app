import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, clearSessionCookies } from '@newsim/auth';
import { logAuditEvent } from '@newsim/auth';
import { supabaseAdmin } from '@newsim/database';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    if (session) {
      // Sign out from Supabase Auth (invalidate Supabase session)
      try {
        await supabaseAdmin.auth.admin.signOut(session.userId);
      } catch {
        // Continue even if Supabase sign-out fails — still clear cookies
      }

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
    clearSessionCookies(res);
    return res;
  } catch (error: any) {
    const res = NextResponse.json({ success: true, message: 'Session terminated.' });
    clearSessionCookies(res);
    return res;
  }
}
