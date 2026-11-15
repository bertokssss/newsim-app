import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@newsim/database';
import { 
  getProfileByAuthId, 
  createSessionToken, 
  setSessionCookies, 
  logAuditEvent,
  checkAccountLockout,
  recordFailedLogin,
  resetFailedLoginAttempts,
  PERMANENT_SUSPENSION_MESSAGE,
  PERMANENT_SUSPENSION_TITLE,
  checkTotpRequirement,
  getJwtSecret,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  isHoneypotTriggered,
  sanitizeEmail,
  resolveEffectivePermissionsForUser,
} from '@newsim/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'Browser';
    const rl = checkRateLimit(`instructor-login:${ip}`, { limit: 20, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return createRateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json();
    if (isHoneypotTriggered(body)) {
      logAuditEvent({
        actorEmail: sanitizeEmail(body?.identifier) || 'bot',
        actorRole: 'INSTRUCTOR',
        action: 'SPAM_HONEYPOT_TRIGGERED',
        details: { endpoint: '/api/auth/login' },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'WARNING',
      });
      return NextResponse.json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
    }

    const { identifier, password, loginAs, rememberMe } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const email = sanitizeEmail(identifier);

    // Immediate check: If the profile is suspended or locked, handle right away
    const { data: preProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (preProfile) {
      const lockout = await checkAccountLockout(preProfile);
      if (lockout.isLocked) {
        if (lockout.isPermanent) {
          return NextResponse.json(
            {
              success: false,
              code: 'ACCOUNT_PERMANENTLY_LOCKED',
              title: PERMANENT_SUSPENSION_TITLE,
              error: lockout.message || PERMANENT_SUSPENSION_MESSAGE,
            },
            { status: 423 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            code: 'ACCOUNT_LOCKED',
            error: lockout.message || `Your account is temporarily suspended due to repeated incorrect login attempts. Please try again in ${lockout.remainingMinutes} minute${lockout.remainingMinutes === 1 ? '' : 's'} (${lockout.remainingSeconds}s).`,
            lockoutUntil: lockout.lockoutUntil,
            remainingSeconds: lockout.remainingSeconds,
          },
          { status: 423 }
        );
      }

      if (preProfile.status?.toUpperCase() === 'SUSPENDED') {
        return NextResponse.json(
          { success: false, error: 'Your account has been suspended. Please contact system administration.' },
          { status: 403 }
        );
      }
    }

    // Create a fresh client to avoid mutating the supabaseAdmin singleton
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // 1. Authenticate via Supabase Auth
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      logAuditEvent({
        actorEmail: email,
        actorRole: preProfile?.role?.toUpperCase() || 'ANONYMOUS',
        action: 'LOGIN_FAILED',
        targetType: 'USER',
        details: { reason: authError?.message || 'Invalid credentials' },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'WARNING',
      });

      const isBanned = authError?.message?.toLowerCase().includes('ban') || authError?.message?.toLowerCase().includes('suspend');
      if (isBanned) {
        return NextResponse.json(
          { success: false, error: 'Your account has been suspended. Please contact system administration.' },
          { status: 403 }
        );
      }

      if (preProfile) {
        const lockResult = await recordFailedLogin(preProfile.id, preProfile);
        if (lockResult.isNowLocked) {
          logAuditEvent({
            actorId: preProfile.id,
            actorEmail: email,
            actorRole: preProfile.role?.toUpperCase() || 'ANONYMOUS',
            action: lockResult.isPermanent ? 'ACCOUNT_PERMANENTLY_SUSPENDED' : 'ACCOUNT_TEMPORARILY_SUSPENDED',
            targetType: 'USER',
            targetId: preProfile.id,
            details: { reason: lockResult.error, lockoutUntil: lockResult.lockoutUntil },
            ipAddress: ip,
            userAgent,
            status: 'FAILED',
            severity: 'CRITICAL',
          });

          return NextResponse.json(
            {
              success: false,
              code: lockResult.isPermanent ? 'ACCOUNT_PERMANENTLY_LOCKED' : 'ACCOUNT_LOCKED',
              error: lockResult.error,
              lockoutUntil: lockResult.lockoutUntil,
              attemptsRemaining: 0,
              remainingSeconds: lockResult.remainingSeconds,
            },
            { status: 423 }
          );
        } else {
          return NextResponse.json(
            {
              success: false,
              error: lockResult.error || `Invalid email or password. You have ${lockResult.attemptsRemaining} attempt${lockResult.attemptsRemaining === 1 ? '' : 's'} remaining before account suspension.`,
              attemptsRemaining: lockResult.attemptsRemaining,
            },
            { status: 401 }
          );
        }
      }

      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const authUser = authData.user;

    // Reset failed login attempts on successful password verification
    if (preProfile && (preProfile.failed_login_attempts > 0 || preProfile.lockout_until)) {
      await resetFailedLoginAttempts(preProfile.id);
    }

    // 2. Fetch User Profile from Supabase `public.profiles` (strictly fail-closed: never auto-provision instructor accounts on login)
    const profile = await getProfileByAuthId(authUser.id);

    if (!profile) {
      logAuditEvent({
        actorId: authUser.id,
        actorEmail: authUser.email || email,
        actorRole: 'UNKNOWN',
        action: 'LOGIN_FAILED',
        targetType: 'USER',
        details: { reason: 'Profile not found' },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'WARNING',
      });

      return NextResponse.json(
        { 
          success: false, 
          error: 'Your account profile could not be found. Please contact an administrator.' 
        },
        { status: 403 }
      );
    }

    // 3. Normalize & Check Role
    const rawRole = (profile.role || '').toString().toLowerCase();
    
    if (rawRole !== 'instructor') {
      logAuditEvent({
        actorId: authUser.id,
        actorEmail: authUser.email || email,
        actorRole: rawRole.toUpperCase(),
        action: 'LOGIN_REJECTED_UNAUTHORIZED_PORTAL',
        targetType: 'USER',
        details: { role: rawRole },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'WARNING',
      });

      return NextResponse.json(
        { 
          success: false, 
          error: 'Your account is not authorized to access the Instructor Portal.' 
        },
        { status: 403 }
      );
    }

    // 4. Check Account Status
    const status = (profile.status || 'active').toString().toLowerCase();
    if (status === 'inactive' || status === 'suspended' || status === 'locked') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Your account is ${status}. Please contact system administration.` 
        },
        { status: 403 }
      );
    }

    if (status === 'pending') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Your account is pending email verification. Please check your email for the invitation link and click "Confirm It\'s Me" to activate your account.' 
        },
        { status: 403 }
      );
    }

    // Map role for client expected format
    const userRoleFormatted = 'INSTRUCTOR';

    // 5. Multi-Factor Authentication (TOTP / App Authenticator)
    // Policy:
    // - If first login / never set up TOTP: Provide QR code for app authenticator, then input code to log in.
    // - For subsequent logins: No TOTP required if active within 3 days (< 72h).
    // - If account is inactive for 3 days or more (>= 72h): Require TOTP code from app authenticator (like GitHub).
    const totpCheck = checkTotpRequirement(profile);

    if (totpCheck.mfaRequired) {
      if (totpCheck.mfaSetupRequired) {
        // First login -> App Authenticator QR Code Setup
        const mfaSetupToken = jwt.sign(
          { userId: authUser.id, purpose: 'MFA_SETUP', role: userRoleFormatted, rememberMe: !!rememberMe },
          getJwtSecret(),
          { expiresIn: '15m' }
        );

        return NextResponse.json({
          success: true,
          mfaRequired: true,
          mfaSetupRequired: true,
          mfaToken: mfaSetupToken,
          userRole: userRoleFormatted,
        });
      } else {
        // Inactive for 3 days or more -> Challenge with TOTP code
        const mfaChallengeToken = jwt.sign(
          { userId: authUser.id, purpose: 'MFA_VERIFY', role: userRoleFormatted, rememberMe: !!rememberMe },
          getJwtSecret(),
          { expiresIn: '10m' }
        );

        return NextResponse.json({
          success: true,
          mfaRequired: true,
          mfaSetupRequired: false,
          mfaToken: mfaChallengeToken,
          userRole: userRoleFormatted,
        });
      }
    }

    // Recent login (< 3 days ago) -> TOTP exempt!
    await resetFailedLoginAttempts(profile.id);

    try {
      await supabaseAdmin
        .from('profiles')
        .update({
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
    } catch (err) {
      console.warn('Failed to update last_login_at in instructor profiles:', err);
    }

    const resolvedPermissions = await resolveEffectivePermissionsForUser(authUser.id, 'INSTRUCTOR');

    const userRecord = {
      id: authUser.id,
      email: profile.email,
      username: profile.username || profile.email,
      passwordHash: '',
      role: 'INSTRUCTOR' as const,
      status: 'ACTIVE' as const,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      department: profile.department || '',
      permissions: resolvedPermissions,
      mfaEnabled: true,
      failedLoginAttempts: 0,
      mustChangePassword: false,
      createdAt: profile.created_at || new Date().toISOString(),
      updatedAt: profile.updated_at || new Date().toISOString(),
    };

    const { token } = createSessionToken(userRecord, ip, userAgent, !!rememberMe);

    logAuditEvent({
      actorId: authUser.id,
      actorEmail: profile.email,
      actorRole: 'INSTRUCTOR',
      action: 'LOGIN_SUCCESS',
      targetType: 'SESSION',
      details: { method: 'DIRECT_AUTHENTICATION_RECENT_EXEMPT', role: 'INSTRUCTOR', rememberMe: !!rememberMe },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    const res = NextResponse.json({
      success: true,
      mfaRequired: false,
      userRole: 'INSTRUCTOR',
      message: 'Authentication successful.',
      user: {
        id: authUser.id,
        email: profile.email,
        role: 'INSTRUCTOR',
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      },
    });

    setSessionCookies(res, token, 'INSTRUCTOR', !!rememberMe);
    return res;
  } catch (error: any) {
    console.error('Supabase Auth Instructor Login Error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to sign in right now. Please try again.' },
      { status: 500 }
    );
  }
}
