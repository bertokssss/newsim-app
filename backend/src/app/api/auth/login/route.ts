import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { logAuditEvent, signInAndGetProfile } from '@newsim/auth';
import { createSessionToken, setSessionCookies } from '@newsim/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'newsim-superadmin-secure-jwt-key-maritime-2026';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Please enter your email and password.' },
        { status: 400 }
      );
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // 1. Authenticate via Supabase Auth (single source of truth for passwords)
    let authData: any;
    let profile: any;

    try {
      const result = await signInAndGetProfile(identifier, password);
      authData = result.authData;
      profile = result.profile;
    } catch (error: any) {
      // Supabase Auth rejected the credentials
      logAuditEvent({
        actorEmail: identifier,
        actorRole: 'ANONYMOUS',
        action: 'LOGIN_FAILED',
        targetType: 'USER',
        details: { reason: 'Invalid credentials' },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'WARNING',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // 2. Verify profile exists
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Your account is not properly configured. Please contact the system administrator.' },
        { status: 403 }
      );
    }

    // 3. Build user object from Supabase profile
    const user = {
      id: profile.id || profile.user_id,
      email: profile.email,
      username: profile.email,
      role: profile.role?.toUpperCase() as string, // 'super_admin' -> 'SUPER_ADMIN'
      status: profile.status?.toUpperCase() as string,
      firstName: profile.first_name,
      lastName: profile.last_name,
      department: profile.department,
      mfaEnabled: profile.mfa_enabled ?? !!profile.mfa_secret,
      mfaSecret: profile.mfa_secret,
      mfaType: 'APP',
      recoveryCodes: profile.recovery_codes,
      failedLoginAttempts: 0,
      mustChangePassword: false,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };

    // 4. Verify role authorization (only SUPER_ADMIN and ADMIN can use management portal)
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to access the Super Admin portal.' },
        { status: 403 }
      );
    }

    // 5. Check account status
    if (user.status === 'SUSPENDED') {
      return NextResponse.json(
        { success: false, error: 'Your account has been suspended.', code: 'ACCOUNT_SUSPENDED' },
        { status: 403 }
      );
    }

    if (user.status === 'INACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Your account is currently inactive.', code: 'ACCOUNT_INACTIVE' },
        { status: 403 }
      );
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Your account is not active. Please contact the system administrator.' },
        { status: 403 }
      );
    }

    // 6. Check MFA requirements — mandatory for SUPER_ADMIN and ADMIN
    const isMfaMandatory = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.mfaEnabled;

    if (!user.mfaEnabled && isMfaMandatory) {
      // Must set up MFA first
      const mfaSetupToken = jwt.sign(
        { userId: user.id, purpose: 'MFA_SETUP', role: user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      return NextResponse.json({
        success: true,
        mfaRequired: true,
        mfaSetupRequired: true,
        mfaToken: mfaSetupToken,
        userRole: user.role,
      });
    }

    if (isMfaMandatory) {
      const mfaChallengeToken = jwt.sign(
        { userId: user.id, purpose: 'MFA_VERIFY', role: user.role },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      return NextResponse.json({
        success: true,
        mfaRequired: true,
        mfaSetupRequired: false,
        mfaToken: mfaChallengeToken,
        userRole: user.role,
      });
    }

    // 7. Non-MFA Login (role without mandatory MFA)
    const { token } = createSessionToken(user as any, ip, userAgent);

    logAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      targetType: 'SESSION',
      details: { method: 'PASSWORD' },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    const res = NextResponse.json({
      success: true,
      mfaRequired: false,
      userRole: user.role,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: `${user.firstName} ${user.lastName}`,
      },
      message: 'Authentication successful',
    });

    setSessionCookies(res, token, user.role);
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Unable to complete login. Please try again.' },
      { status: 500 }
    );
  }
}
