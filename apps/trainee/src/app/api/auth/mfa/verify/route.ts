import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin, db, UserRecord } from '@newsim/database';
import { 
  verifyTOTP, 
  verifyRecoveryCode, 
  getProfileByAuthId,
  createSessionToken, 
  setSessionCookies, 
  logAuditEvent,
  checkAccountLockout,
  recordFailedLogin,
  resetFailedLoginAttempts,
  PERMANENT_SUSPENSION_MESSAGE,
  PERMANENT_SUSPENSION_TITLE,
  getJwtSecret,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  resolveEffectivePermissionsForUser,
} from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`mfa-verify:${ip}`, { limit: 15, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return createRateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json();
    const { mfaToken, code, recoveryCode, isSetupVerification, setupSecret, setupRecoveryCodes } = body;

    if (!mfaToken) {
      return NextResponse.json(
        { success: false, error: 'MFA challenge token is missing.' },
        { status: 400 }
      );
    }

    let decoded: any;
    try {
      decoded = jwt.verify(mfaToken, getJwtSecret());
    } catch {
      return NextResponse.json(
        { success: false, error: 'MFA challenge has expired. Please sign in again.' },
        { status: 401 }
      );
    }

    const expectedPurpose = isSetupVerification ? 'MFA_SETUP' : 'MFA_VERIFY';
    if (decoded?.purpose !== expectedPurpose) {
      return NextResponse.json(
        { success: false, error: 'Invalid MFA challenge token purpose.' },
        { status: 403 }
      );
    }

    // Fetch user profile from Supabase
    const profile = await getProfileByAuthId(decoded.userId);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User account not found.' },
        { status: 403 }
      );
    }

    if ((profile.role || '').toString().toUpperCase() !== 'TRAINEE') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized role for trainee portal MFA verification.' },
        { status: 403 }
      );
    }

    const status = (profile.status || 'ACTIVE').toString().toUpperCase();
    if (status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'User account is inactive.' },
        { status: 403 }
      );
    }

    // Check account lockout
    const lockout = await checkAccountLockout(profile);
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
          error: lockout.message || `Your account is temporarily suspended due to consecutive failed attempts. Please try again in ${lockout.remainingMinutes} minute(s).`,
          lockoutUntil: lockout.lockoutUntil,
          remainingSeconds: lockout.remainingSeconds,
        },
        { status: 423 }
      );
    }

    const rememberMe = typeof body.rememberMe === 'boolean' ? body.rememberMe : !!decoded.rememberMe;
    const userRoleFormatted = 'TRAINEE';
    const resolvedPermissions = await resolveEffectivePermissionsForUser(decoded.userId, userRoleFormatted);

    // Format user record for session token
    const userRecord: UserRecord = {
      id: decoded.userId,
      email: profile.email,
      username: profile.username || profile.email,
      passwordHash: '',
      role: 'TRAINEE',
      status: 'ACTIVE',
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

    // Keep in-memory DB in sync for session validation
    try {
      if (!db.getUserById(userRecord.id)) {
        db.createUser(userRecord);
      }
    } catch {
      // non-blocking
    }

    const userAgent = req.headers.get('user-agent') || 'Browser';

    // Flow 1: Setup Verification
    if (isSetupVerification) {
      if (profile.mfa_enabled) {
        return NextResponse.json(
          { success: false, error: 'MFA is already enabled on this account.' },
          { status: 403 }
        );
      }

      if (!code || !setupSecret) {
        return NextResponse.json(
          { success: false, error: 'Verification code and setup secret are required.' },
          { status: 400 }
        );
      }

      const isValid = verifyTOTP(code, setupSecret);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid 6-digit TOTP code. Please check your authenticator clock and try again.' },
          { status: 400 }
        );
      }

      const updatePayload: any = { 
        mfa_secret: setupSecret,
        recovery_codes: typeof setupRecoveryCodes === 'string' ? setupRecoveryCodes : JSON.stringify(setupRecoveryCodes),
        mfa_enabled: true,
        last_login_at: new Date().toISOString(),
        failed_login_attempts: 0,
        lockout_until: null,
      };
      
      const updateRes = await supabaseAdmin
        .from('profiles')
        .update(updatePayload)
        .eq('id', profile.id)
        .neq('mfa_enabled', true);
      if (updateRes.error) {
        console.error("MFA Setup DB Update Error:", updateRes.error);
        return NextResponse.json({ success: false, error: 'DB Error: ' + updateRes.error.message }, { status: 500 });
      }

      logAuditEvent({
        actorId: decoded.userId,
        actorEmail: profile.email,
        actorRole: userRoleFormatted,
        action: 'MFA_ENABLED',
        targetType: 'USER',
        targetId: decoded.userId,
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      const { token } = createSessionToken(userRecord, ip, userAgent, rememberMe);
      const res = NextResponse.json({
        success: true,
        message: 'MFA successfully enrolled and verified.',
        user: {
          id: decoded.userId,
          email: profile.email,
          role: userRoleFormatted,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        },
      });

      setSessionCookies(res, token, userRoleFormatted, rememberMe);
      return res;
    }

    // Flow 2: Standard TOTP code verification
    if (code) {
      if (!profile.mfa_secret) {
        return NextResponse.json(
          { success: false, error: 'MFA secret is not configured for this account.' },
          { status: 400 }
        );
      }

      const isValid = verifyTOTP(code, profile.mfa_secret);
      if (!isValid) {
        logAuditEvent({
          actorId: decoded.userId,
          actorEmail: profile.email,
          actorRole: userRoleFormatted,
          action: 'LOGIN_MFA_FAILED',
          targetType: 'USER',
          targetId: decoded.userId,
          ipAddress: ip,
          userAgent,
          status: 'FAILED',
          severity: 'WARNING',
        });

        const lockResult = await recordFailedLogin(profile.id, profile);
        if (lockResult.isNowLocked) {
          return NextResponse.json(
            {
              success: false,
              code: lockResult.isPermanent ? 'ACCOUNT_PERMANENTLY_LOCKED' : 'ACCOUNT_LOCKED',
              error: lockResult.error,
              lockoutUntil: lockResult.lockoutUntil,
              remainingSeconds: lockResult.remainingSeconds,
            },
            { status: 423 }
          );
        }

        return NextResponse.json(
          { 
            success: false, 
            error: lockResult.error || `Invalid verification code. You have ${lockResult.attemptsRemaining} attempt${lockResult.attemptsRemaining === 1 ? '' : 's'} remaining.` 
          },
          { status: 400 }
        );
      }

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
        console.warn('Failed to update last_login_at in trainee profiles:', err);
      }

      logAuditEvent({
        actorId: decoded.userId,
        actorEmail: profile.email,
        actorRole: userRoleFormatted,
        action: 'LOGIN_SUCCESS',
        targetType: 'SESSION',
        details: { method: 'TOTP_MFA' },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      const { token } = createSessionToken(userRecord, ip, userAgent, rememberMe);
      const res = NextResponse.json({
        success: true,
        message: 'Authentication successful.',
        user: {
          id: decoded.userId,
          email: profile.email,
          role: userRoleFormatted,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        },
      });

      setSessionCookies(res, token, userRoleFormatted, rememberMe);
      return res;
    }

    // Flow 3: Recovery Code verification
    if (recoveryCode) {
      const storedRecoveryCodes = profile.recovery_codes ? 
        (typeof profile.recovery_codes === 'string' ? JSON.parse(profile.recovery_codes) : profile.recovery_codes) 
        : null;
        
      const { valid, updatedHashedCodesJson } = verifyRecoveryCode(recoveryCode, storedRecoveryCodes);
      if (!valid) {
        logAuditEvent({
          actorId: decoded.userId,
          actorEmail: profile.email,
          actorRole: userRoleFormatted,
          action: 'LOGIN_RECOVERY_CODE_FAILED',
          targetType: 'USER',
          targetId: decoded.userId,
          ipAddress: ip,
          userAgent,
          status: 'FAILED',
          severity: 'WARNING',
        });

        const lockResult = await recordFailedLogin(profile.id, profile);
        if (lockResult.isNowLocked) {
          return NextResponse.json(
            {
              success: false,
              code: lockResult.isPermanent ? 'ACCOUNT_PERMANENTLY_LOCKED' : 'ACCOUNT_LOCKED',
              error: lockResult.error,
              lockoutUntil: lockResult.lockoutUntil,
              remainingSeconds: lockResult.remainingSeconds,
            },
            { status: 423 }
          );
        }

        return NextResponse.json(
          { success: false, error: lockResult.error || `Invalid or already used recovery code. You have ${lockResult.attemptsRemaining} attempt${lockResult.attemptsRemaining === 1 ? '' : 's'} remaining.` },
          { status: 400 }
        );
      }

      await resetFailedLoginAttempts(profile.id);

      // Update remaining recovery codes and refresh last_login_at in Supabase
      const updatePayload = {
        recovery_codes: updatedHashedCodesJson || null,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabaseAdmin.from('profiles').update(updatePayload).eq('id', profile.id);

      logAuditEvent({
        actorId: decoded.userId,
        actorEmail: profile.email,
        actorRole: userRoleFormatted,
        action: 'LOGIN_SUCCESS_RECOVERY_CODE',
        targetType: 'SESSION',
        details: { method: 'RECOVERY_CODE' },
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });

      const { token } = createSessionToken(userRecord, ip, userAgent, rememberMe);
      const res = NextResponse.json({
        success: true,
        message: 'Authenticated via recovery code.',
        user: {
          id: decoded.userId,
          email: profile.email,
          role: userRoleFormatted,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        },
      });

      setSessionCookies(res, token, userRoleFormatted, rememberMe);
      return res;
    }

    return NextResponse.json(
      { success: false, error: 'Please provide either a TOTP code or recovery code.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Trainee MFA Verification Error:', error);
    return NextResponse.json(
      { success: false, error: 'MFA verification failed due to an unexpected error.' },
      { status: 500 }
    );
  }
}
