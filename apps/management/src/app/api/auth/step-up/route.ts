import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import { getSessionFromRequest, logAuditEvent } from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in again.' },
        { status: 401 }
      );
    }

    const { activeUser } = session;
    const body = await req.json();
    const { password, actionName } = body;

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // 1. Password check
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Current Super Admin password is required.' },
        { status: 400 }
      );
    }

    // 2. Validate password via Supabase Auth
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: activeUser.email,
      password,
    });

    let passwordValid = !authError && !!authData.user;

    // Fallback: bcrypt comparison only if an actual hash is present on activeUser
    if (!passwordValid && activeUser.passwordHash) {
      try {
        passwordValid = await bcrypt.compare(password, activeUser.passwordHash);
      } catch {}
    }

    if (!passwordValid) {
      logAuditEvent({
        actorId: activeUser.id,
        actorEmail: activeUser.email,
        actorRole: activeUser.role,
        action: 'STEP_UP_AUTH_FAILED',
        details: { reason: 'Invalid password', actionName },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'CRITICAL',
      });

      return NextResponse.json(
        { success: false, error: 'Incorrect Super Admin password. Please verify and try again.' },
        { status: 401 }
      );
    }

    logAuditEvent({
      actorId: activeUser.id,
      actorEmail: activeUser.email,
      actorRole: activeUser.role,
      action: 'STEP_UP_AUTH_SUCCESS',
      details: { actionName },
      ipAddress: ip,
      userAgent,
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({
      success: true,
      message: 'Password verified successfully. Operation authorized.',
    });
  } catch (error: any) {
    console.error('Step-up authentication error:', error);
    return NextResponse.json(
      { success: false, error: 'Step-up authentication failed.' },
      { status: 500 }
    );
  }
}
