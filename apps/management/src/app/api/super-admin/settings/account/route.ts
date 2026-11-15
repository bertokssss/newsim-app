import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import {
  verifySuperAdminRequestAsync,
  createUnauthorizedResponse,
  createForbiddenResponse,
  verifyTOTP,
  logAuditEvent,
  validateStrongPassword,
  getProfileByAuthId,
  initializePortalTotpSetup,
  completePortalTotpSetup,
  regenerateUserRecoveryCodes,
} from '@newsim/auth';
import { db, dispatchNotificationEvent, NOTIFICATION_EVENTS, supabaseAdmin } from '@newsim/database';

export const dynamic = 'force-dynamic';

async function handleAccountRequest(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req);
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const user = auth.user;
    const body = await req.json();
    const { action, firstName, lastName, phone, department, avatarUrl, currentPassword, newPassword, mfaCode } = body;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // 1. Update Basic Profile
    if (action === 'UPDATE_PROFILE') {
      const profileUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (firstName !== undefined) {
        user.firstName = firstName.trim();
        profileUpdates.first_name = firstName.trim();
      }
      if (lastName !== undefined) {
        user.lastName = lastName.trim();
        profileUpdates.last_name = lastName.trim();
      }
      if (phone !== undefined) {
        user.phone = phone.trim();
        profileUpdates.phone = phone.trim();
      }
      if (avatarUrl !== undefined) {
        (user as any).avatarUrl = avatarUrl;
        profileUpdates.avatar_url = avatarUrl;
      }
      if (department !== undefined) {
        user.department = department.trim();
      }
      user.updatedAt = new Date().toISOString();

      try {
        const { error: profErr } = await supabaseAdmin
          .from('profiles')
          .update(profileUpdates)
          .eq('id', user.id);

        if (profErr) {
          console.warn('Super admin profile update supabase notice:', profErr);
        }
      } catch (err) {
        console.warn('Super admin update profile err:', err);
      }

      logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'SUPER_ADMIN_PROFILE_UPDATED',
        targetType: 'USER',
        targetId: user.id,
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      return NextResponse.json({
        success: true,
        message: 'Super Admin profile updated successfully.',
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          department: user.department,
          avatarUrl: (user as any).avatarUrl || null,
        },
      });
    }

    // 2. Update Avatar Photo
    if (action === 'UPDATE_AVATAR') {
      try {
        await supabaseAdmin
          .from('profiles')
          .update({
            avatar_url: avatarUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      } catch (err) {
        console.warn('Super admin avatar update notice:', err);
      }

      (user as any).avatarUrl = avatarUrl || null;

      logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'SUPER_ADMIN_AVATAR_UPDATED',
        targetType: 'USER',
        targetId: user.id,
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      return NextResponse.json({
        success: true,
        message: 'Super Admin avatar photo updated successfully.',
        avatarUrl,
      });
    }

    // 3. Change Password
    if (action === 'CHANGE_PASSWORD') {
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { success: false, error: 'Current password and new password are required.' },
          { status: 400 }
        );
      }

      if (newPassword.length < 12) {
        return NextResponse.json(
          { success: false, error: 'New password must be at least 12 characters long.' },
          { status: 400 }
        );
      }

      const passValidation = validateStrongPassword(newPassword);
      if (!passValidation.valid) {
        return NextResponse.json(
          { success: false, error: passValidation.error },
          { status: 400 }
        );
      }

      // Verify current password against Supabase Auth first, then legacy hash fallback
      let pwMatch = false;
      try {
        const { signInWithPassword } = await import('@newsim/auth');
        await signInWithPassword(user.email, currentPassword);
        pwMatch = true;
      } catch {
        if (user.passwordHash) {
          try {
            pwMatch = await bcrypt.compare(currentPassword, user.passwordHash);
          } catch {}
        }
      }

      if (!pwMatch) {
        logAuditEvent({
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'PASSWORD_CHANGE_FAILED',
          details: { reason: 'Incorrect current password' },
          ipAddress: ip,
          userAgent,
          status: 'FAILED',
          severity: 'WARNING',
        });
        return NextResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 400 });
      }

      // Verify MFA if enabled in live Supabase profile
      const liveProfile = await getProfileByAuthId(user.id);
      const liveSecret = liveProfile?.mfa_secret || user.mfaSecret;
      const liveMfaEnabled = Boolean(liveProfile ? liveProfile.mfa_enabled && liveProfile.mfa_secret : user.mfaEnabled);
      if (liveMfaEnabled && liveSecret) {
        if (!mfaCode || !verifyTOTP(mfaCode, liveSecret)) {
          return NextResponse.json(
            { success: false, error: 'Valid 6-digit MFA security code is required to change password.' },
            { status: 400 }
          );
        }
      }

      // Update in Supabase Auth
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: newPassword,
        });
      } catch (authErr) {
        console.warn('Supabase auth password update notice:', authErr);
      }

      // Hash and update local user & profiles
      user.passwordHash = await bcrypt.hash(newPassword, 10);
      user.mustChangePassword = false;
      user.updatedAt = new Date().toISOString();

      try {
        await supabaseAdmin
          .from('profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', user.id);
      } catch {}

      // Revoke all other sessions for security
      const revokedCount = db.revokeOtherSessionsForUser(user.id, auth.sessionId || '');

      logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'PASSWORD_CHANGED',
        targetType: 'USER',
        targetId: user.id,
        details: { otherSessionsRevoked: revokedCount },
        ipAddress: ip,
        userAgent,
        severity: 'CRITICAL',
      });

      dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.PASSWORD_CHANGED,
        targetUserId: user.id,
        targetRole: 'SUPER_ADMIN',
        entityType: 'USER',
        entityId: user.id,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully. Other active sessions have been terminated for security.',
      });
    }

    // 4. Initialize or Complete TOTP Setup (if not yet enrolled)
    if (action === 'INIT_MFA_SETUP') {
      const setup = initializePortalTotpSetup({
        userId: user.id,
        email: user.email,
        issuer: 'NEWSIM',
      });
      return NextResponse.json({ success: true, ...setup });
    }

    if (action === 'COMPLETE_MFA_SETUP') {
      const result = await completePortalTotpSetup({
        userId: user.id,
        email: user.email,
        role: user.role,
        setupToken: String(body.setupToken || ''),
        code: String(body.code || mfaCode || ''),
        ip,
        userAgent,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      user.mfaEnabled = true;
      dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.MFA_UPDATED,
        targetUserId: user.id,
        targetRole: 'SUPER_ADMIN',
        entityType: 'USER',
        entityId: user.id,
      }).catch(() => {});
      return NextResponse.json({
        success: true,
        mfaEnabled: true,
        recoveryCodes: result.recoveryCodes,
        message: 'Two-Factor Authentication (TOTP) activated successfully.',
      });
    }

    // 5. Regenerate Recovery Codes
    if (action === 'REGENERATE_RECOVERY_CODES') {
      const result = await regenerateUserRecoveryCodes({
        userId: user.id,
        email: user.email,
        role: user.role,
        currentPassword,
        mfaCode,
        fallbackHash: user.passwordHash,
        ip,
        userAgent,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }

      dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.MFA_UPDATED,
        targetUserId: user.id,
        targetRole: 'SUPER_ADMIN',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          detail: 'New emergency MFA recovery codes were generated for your Super Admin account.',
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: 'New recovery codes generated. Store them safely.',
        recoveryCodes: result.recoveryCodes,
      });
    }

    // 5. Sign out all other sessions
    if (action === 'REVOKE_OTHER_SESSIONS') {
      const revokedCount = db.revokeOtherSessionsForUser(user.id, auth.sessionId || '');

      logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'SESSIONS_BULK_REVOKED',
        targetType: 'SESSION',
        targetId: user.id,
        details: { count: revokedCount },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      return NextResponse.json({
        success: true,
        message: `Successfully terminated ${revokedCount} other active session(s).`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid account action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Account operation failed.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return handleAccountRequest(req);
}

export async function POST(req: NextRequest) {
  return handleAccountRequest(req);
}
