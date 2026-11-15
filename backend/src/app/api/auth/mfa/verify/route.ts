import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@newsim/database';
import { verifyTOTP, verifyRecoveryCode } from '@newsim/auth';
import { createSessionToken, setSessionCookies } from '@newsim/auth';
import { logAuditEvent, getProfileByAuthId, updateProfile } from '@newsim/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'newsim-superadmin-secure-jwt-key-maritime-2026';

export async function POST(req: NextRequest) {
  try {
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
      decoded = jwt.verify(mfaToken, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { success: false, error: 'MFA challenge has expired. Please sign in again.' },
        { status: 401 }
      );
    }

    let user = db.getUserById(decoded.userId);
    let isSupabaseUser = false;

    if (!user) {
      const profile = await getProfileByAuthId(decoded.userId);
      if (profile) {
        isSupabaseUser = true;
        user = {
          id: profile.user_id,
          email: profile.email,
          username: profile.email,
          passwordHash: '',
          role: profile.role.toUpperCase() as "SUPER_ADMIN" | "ADMIN" | "INSTRUCTOR" | "TRAINEE",
          status: profile.status.toUpperCase() as "ACTIVE" | "INACTIVE" | "SUSPENDED" | "LOCKED",
          firstName: profile.first_name,
          lastName: profile.last_name,
          department: profile.department,
          mfaEnabled: profile.mfa_enabled,
          mfaSecret: profile.mfa_secret,
          recoveryCodes: profile.recovery_codes,
          failedLoginAttempts: 0,
          mustChangePassword: false,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        };
      }
    }

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'User account is inactive or not found.' },
        { status: 403 }
      );
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // Flow 1: Setup Verification
    if (isSetupVerification) {
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

      // Activate MFA on user
      user.mfaEnabled = true;
      user.mfaSecret = setupSecret;
      if (setupRecoveryCodes) {
        user.recoveryCodes = setupRecoveryCodes;
      }
      user.lastLoginAt = new Date().toISOString();

      if (isSupabaseUser) {
        await updateProfile(user.id, {
          mfa_enabled: true,
          mfa_secret: setupSecret,
          recovery_codes: setupRecoveryCodes || null,
        });
      }

      logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'MFA_ENABLED',
        targetType: 'USER',
        targetId: user.id,
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      const { token } = createSessionToken(user, ip, userAgent);
      const res = NextResponse.json({
        success: true,
        message: 'MFA successfully enrolled and verified.',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: `${user.firstName} ${user.lastName}`,
        },
      });

      setSessionCookies(res, token, user.role);
      return res;
    }

    // Flow 2: Standard TOTP code verification
    if (code) {
      if (!user.mfaSecret) {
        return NextResponse.json(
          { success: false, error: 'MFA secret is not configured for this account.' },
          { status: 400 }
        );
      }

      const isValid = verifyTOTP(code, user.mfaSecret);
      if (!isValid) {
        logAuditEvent({
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'LOGIN_MFA_FAILED',
          targetType: 'USER',
          targetId: user.id,
          ipAddress: ip,
          userAgent,
          status: 'FAILED',
          severity: 'WARNING',
        });

        db.addSecurityEvent({
          eventType: 'MFA_FAILURE',
          severity: 'WARNING',
          targetUser: user.email,
          ipAddress: ip,
          userAgent,
          description: 'Failed TOTP verification attempt.',
          resolved: false,
        });

        return NextResponse.json(
          { success: false, error: 'Invalid 6-digit verification code. Please try again.' },
          { status: 400 }
        );
      }

      user.lastLoginAt = new Date().toISOString();

      logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'LOGIN_SUCCESS',
        targetType: 'SESSION',
        details: { method: 'TOTP_MFA' },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      const { token } = createSessionToken(user, ip, userAgent);
      const res = NextResponse.json({
        success: true,
        message: 'Authentication successful.',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: `${user.firstName} ${user.lastName}`,
        },
      });

      setSessionCookies(res, token, user.role);
      return res;
    }

    // Flow 3: Recovery Code verification
    if (recoveryCode) {
      const { valid, updatedHashedCodesJson } = verifyRecoveryCode(recoveryCode, user.recoveryCodes || null);
      if (!valid) {
        logAuditEvent({
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'LOGIN_RECOVERY_CODE_FAILED',
          targetType: 'USER',
          targetId: user.id,
          ipAddress: ip,
          userAgent,
          status: 'FAILED',
          severity: 'WARNING',
        });

        return NextResponse.json(
          { success: false, error: 'Invalid or already used recovery code.' },
          { status: 400 }
        );
      }

      user.recoveryCodes = updatedHashedCodesJson || undefined;
      user.lastLoginAt = new Date().toISOString();

      if (isSupabaseUser) {
        await updateProfile(user.id, {
          recovery_codes: updatedHashedCodesJson || null,
        });
      }

      logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'LOGIN_SUCCESS_RECOVERY_CODE',
        targetType: 'SESSION',
        details: { method: 'RECOVERY_CODE' },
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });

      db.addNotification({
        title: 'Recovery Code Consumed',
        message: `A backup recovery code was used by ${user.email} to access the system.`,
        severity: 'WARNING',
        type: 'SECURITY',
        isRead: false,
        link: '/super-admin/settings',
      });

      const { token } = createSessionToken(user, ip, userAgent);
      const res = NextResponse.json({
        success: true,
        message: 'Authenticated via recovery code.',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: `${user.firstName} ${user.lastName}`,
        },
      });

      setSessionCookies(res, token, user.role);
      return res;
    }

    return NextResponse.json(
      { success: false, error: 'Please provide either a TOTP code or recovery code.' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'MFA verification failed due to an unexpected error.' },
      { status: 500 }
    );
  }
}
