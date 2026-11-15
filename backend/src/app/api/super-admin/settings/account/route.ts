import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';
import { verifyTOTP, generateRecoveryCodes } from '@newsim/auth';
import { logAuditEvent } from '@newsim/auth';

export async function PUT(req: NextRequest) {
  const auth = verifySuperAdminRequest(req);
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const user = auth.user;
    const body = await req.json();
    const { action, firstName, lastName, phone, department, currentPassword, newPassword, mfaCode } = body;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // 1. Update Basic Profile
    if (action === 'UPDATE_PROFILE') {
      if (firstName) user.firstName = firstName.trim();
      if (lastName) user.lastName = lastName.trim();
      if (phone !== undefined) user.phone = phone;
      if (department) user.department = department.trim();
      user.updatedAt = new Date().toISOString();

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
        message: 'Profile information updated successfully.',
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          department: user.department,
        },
      });
    }

    // 2. Change Password
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

      // Verify current password
      const pwMatch = await bcrypt.compare(currentPassword, user.passwordHash);
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

      // Verify MFA if enabled
      if (user.mfaEnabled && user.mfaSecret) {
        if (!mfaCode || !verifyTOTP(mfaCode, user.mfaSecret)) {
          return NextResponse.json(
            { success: false, error: 'Valid 6-digit MFA security code is required to change password.' },
            { status: 400 }
          );
        }
      }

      // Hash and update
      user.passwordHash = await bcrypt.hash(newPassword, 10);
      user.mustChangePassword = false;
      user.updatedAt = new Date().toISOString();

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

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully. Other active sessions have been terminated for security.',
      });
    }

    // 3. Regenerate Recovery Codes
    if (action === 'REGENERATE_RECOVERY_CODES') {
      if (!currentPassword) {
        return NextResponse.json({ success: false, error: 'Current password is required.' }, { status: 400 });
      }

      const pwMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!pwMatch) {
        return NextResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 400 });
      }

      if (user.mfaEnabled && user.mfaSecret) {
        if (!mfaCode || !verifyTOTP(mfaCode, user.mfaSecret)) {
          return NextResponse.json({ success: false, error: 'Valid MFA code is required.' }, { status: 400 });
        }
      }

      const { plaintext, hashed } = generateRecoveryCodes(6);
      user.recoveryCodes = JSON.stringify(hashed);

      logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'MFA_RECOVERY_CODES_REGENERATED',
        targetType: 'USER',
        targetId: user.id,
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });

      return NextResponse.json({
        success: true,
        message: 'New recovery codes generated. Store them safely.',
        recoveryCodes: plaintext,
      });
    }

    // 4. Sign out all other sessions
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
      { success: false, error: 'Account operation failed.' },
      { status: 500 }
    );
  }
}
