import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin, db, UserRecord } from '@newsim/database';
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
  sanitizeText,
  resolveEffectivePermissionsForUser,
} from '@newsim/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'Browser';
    const rl = checkRateLimit(`trainee-login:${ip}`, { limit: 25, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return createRateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json();
    if (isHoneypotTriggered(body)) {
      logAuditEvent({
        actorEmail: sanitizeText(body?.identifier, 120) || 'bot',
        actorRole: 'TRAINEE',
        action: 'SPAM_HONEYPOT_TRIGGERED',
        details: { endpoint: '/api/auth/login' },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'WARNING',
      });
      return NextResponse.json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
    }

    const { identifier, password, rememberMe } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Email or Trainee ID and password are required.' },
        { status: 400 }
      );
    }

    const rawIdentifier = sanitizeText(identifier, 200).replace(/[,()]/g, '');
    let loginEmail = rawIdentifier.toLowerCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawIdentifier);

    // If identifier does not have '@', resolve email by username or UUID in Supabase profiles
    if (!loginEmail.includes('@')) {
      try {
        const byUsername = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('username', rawIdentifier)
          .maybeSingle();

        if (byUsername.data?.email) {
          loginEmail = byUsername.data.email.toLowerCase();
        } else if (isUuid) {
          const byId = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('id', rawIdentifier)
            .maybeSingle();
          if (byId.data?.email) {
            loginEmail = byId.data.email.toLowerCase();
          }
        }
      } catch (e) {
        console.warn('Error resolving username in Supabase profiles:', e);
      }
    }

    // 1. Pre-check: If profile exists and is suspended or locked, return immediate response
    let preProfile: any = null;
    try {
      const byEmail = await supabaseAdmin
        .from('profiles')
        .select('*')
        .ilike('email', loginEmail)
        .maybeSingle();

      preProfile = byEmail.data;
      if (!preProfile && !rawIdentifier.includes('@')) {
        const byUsernameProfile = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('username', rawIdentifier)
          .maybeSingle();
        preProfile = byUsernameProfile.data;
      }

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

        if (preProfile.status?.toUpperCase() === 'PENDING') {
          return NextResponse.json(
            { success: false, error: 'Your account is pending email confirmation. Please check your email and click the confirmation link to activate your account.' },
            { status: 403 }
          );
        }
      }
    } catch (e) {
      console.warn('Pre-check profile error in trainee login:', e);
    }

    // 2. Authenticate via Supabase Auth
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (authError || !authData.user) {
      logAuditEvent({
        actorEmail: loginEmail,
        actorRole: 'ANONYMOUS',
        action: 'LOGIN_FAILED',
        targetType: 'USER',
        details: { reason: authError?.message || 'Invalid credentials' },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'WARNING',
      });

      const errMsg = authError?.message?.toLowerCase() || '';
      const isBanned = errMsg.includes('ban') || errMsg.includes('suspend');
      const isUnconfirmed = errMsg.includes('confirm') || errMsg.includes('not confirmed');

      if (isBanned) {
        return NextResponse.json(
          { success: false, error: 'Your account has been suspended. Please contact system administration.' },
          { status: 403 }
        );
      }
      if (isUnconfirmed) {
        return NextResponse.json(
          { success: false, error: 'Your account is pending email confirmation. Please check your email and click the confirmation link to activate your account.' },
          { status: 403 }
        );
      }

      if (preProfile) {
        const lockResult = await recordFailedLogin(preProfile.id, preProfile);
        if (lockResult.isNowLocked) {
          logAuditEvent({
            actorId: preProfile.id,
            actorEmail: loginEmail,
            actorRole: 'TRAINEE',
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
        { success: false, error: 'Invalid email or password. Please try again.' },
        { status: 401 }
      );
    }

    const authUser = authData.user;

    // Reset failed login attempts on successful password verification
    if (preProfile && (preProfile.failed_login_attempts > 0 || preProfile.lockout_until)) {
      await resetFailedLoginAttempts(preProfile.id);
    }

    // 3. Fetch User Profile from Supabase `public.profiles`
    let profile = await getProfileByAuthId(authUser.id);

    // Auto-provision ONLY as TRAINEE if user has verified email in Supabase Auth (never trust user_metadata.role)
    if (!profile && authUser.email_confirmed_at) {
      const { data: createdProfile } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authUser.id,
          email: authUser.email || loginEmail,
          username: authUser.user_metadata?.username || (authUser.email ? authUser.email.split('@')[0] : null),
          role: 'TRAINEE',
          first_name: authUser.user_metadata?.first_name || 'Trainee',
          last_name: authUser.user_metadata?.last_name || 'Account',
          status: 'ACTIVE',
        })
        .select()
        .maybeSingle();

      if (createdProfile) {
        profile = createdProfile;
      }
    }

    if (!profile) {
      logAuditEvent({
        actorId: authUser.id,
        actorEmail: authUser.email || loginEmail,
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

    // 4. Normalize & Check Role
    const rawRole = (profile.role || '').toString().toUpperCase();
    
    if (rawRole !== 'TRAINEE') {
      logAuditEvent({
        actorId: authUser.id,
        actorEmail: authUser.email || loginEmail,
        actorRole: rawRole,
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
          error: 'Your account is not authorized to access the Trainee Portal.' 
        },
        { status: 403 }
      );
    }

    // 5. Check Account Status
    const status = (profile.status || 'ACTIVE').toString().toUpperCase();
    if (status === 'INACTIVE' || status === 'SUSPENDED' || status === 'LOCKED') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Your account is ${status.toLowerCase()}. Please contact system administration.` 
        },
        { status: 403 }
      );
    }

    if (status === 'PENDING') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Your account is pending email confirmation. Please check your email and click the confirmation link to activate your account.' 
        },
        { status: 403 }
      );
    }

    // 6. Multi-Factor Authentication (TOTP / App Authenticator)
    const totpCheck = checkTotpRequirement(profile);

    if (totpCheck.mfaRequired) {
      if (totpCheck.mfaSetupRequired) {
        const mfaSetupToken = jwt.sign(
          { userId: authUser.id, purpose: 'MFA_SETUP', role: 'TRAINEE', rememberMe: !!rememberMe },
          getJwtSecret(),
          { expiresIn: '15m' }
        );

        return NextResponse.json({
          success: true,
          mfaRequired: true,
          mfaSetupRequired: true,
          mfaToken: mfaSetupToken,
          userRole: 'TRAINEE',
        });
      }

      const mfaChallengeToken = jwt.sign(
        { userId: authUser.id, purpose: 'MFA_VERIFY', role: 'TRAINEE', rememberMe: !!rememberMe },
        getJwtSecret(),
        { expiresIn: '10m' }
      );

      return NextResponse.json({
        success: true,
        mfaRequired: true,
        mfaSetupRequired: false,
        mfaToken: mfaChallengeToken,
        userRole: 'TRAINEE',
      });
    }

    const resolvedPermissions = await resolveEffectivePermissionsForUser(authUser.id, 'TRAINEE');

    // 7. Recent login (< 3 days ago) -> TOTP exempt session creation
    const userRecord: UserRecord = {
      id: authUser.id,
      email: authUser.email || loginEmail,
      username: profile.username || (authUser.email ? authUser.email.split('@')[0] : ''),
      passwordHash: '',
      role: 'TRAINEE',
      status: 'ACTIVE',
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      department: profile.department || '',
      permissions: resolvedPermissions,
      mfaEnabled: Boolean(profile.mfa_enabled && profile.mfa_secret),
      failedLoginAttempts: 0,
      mustChangePassword: false,
      createdAt: profile.created_at || new Date().toISOString(),
      updatedAt: profile.updated_at || new Date().toISOString(),
    };

    // Keep in-memory DB in sync for session validation if needed
    try {
      if (!db.getUserById(userRecord.id)) {
        db.createUser(userRecord);
      }
    } catch {
      // non-blocking
    }

    const { token } = createSessionToken(userRecord, ip, userAgent, !!rememberMe);

    // Update last_login_at in Supabase profiles
    try {
      await supabaseAdmin
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', authUser.id);
    } catch {
      // non-blocking
    }

    logAuditEvent({
      actorId: authUser.id,
      actorEmail: authUser.email || loginEmail,
      actorRole: 'TRAINEE',
      action: 'LOGIN_SUCCESS',
      targetType: 'SESSION',
      details: { method: 'PASSWORD', rememberMe: !!rememberMe },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        role: userRecord.role,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
      },
      redirectTo: '/dashboard',
    });

    setSessionCookies(response, token, 'TRAINEE', !!rememberMe);
    return response;
  } catch (error: any) {
    console.error('Supabase Auth Trainee Login Error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication service encountered an unexpected error.' },
      { status: 500 }
    );
  }
}
