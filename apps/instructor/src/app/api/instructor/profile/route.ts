import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotificationEvent, NOTIFICATION_EVENTS, getInstructorProfileData, updateInstructorProfileData, supabaseAdmin } from '@newsim/database';
import {
  getSessionFromRequest,
  validateStrongPassword,
  logAuditEvent,
  initializePortalTotpSetup,
  completePortalTotpSetup,
  regenerateUserRecoveryCodes,
} from '@newsim/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req, 'INSTRUCTOR');
    const instructorId = session?.activeUser?.id;

    if (!instructorId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getInstructorProfileData(instructorId);
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Failed to load profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, firstName, lastName, phone, specialization, bio, licenseNumber, avatarUrl, currentPassword, newPassword } = body;

    const session = getSessionFromRequest(req, 'INSTRUCTOR');
    const instructorId = session?.activeUser?.id;

    if (!session?.activeUser || !instructorId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or instructor not found' }, { status: 401 });
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    if (action === 'UPDATE_PROFILE') {
      await updateInstructorProfileData(instructorId, {
        firstName,
        lastName,
        phone,
        specialization,
        bio,
        licenseNumber,
        avatarUrl,
      });

      logAuditEvent({
        actorId: instructorId,
        actorEmail: session.activeUser.email,
        actorRole: 'INSTRUCTOR',
        action: 'INSTRUCTOR_PROFILE_UPDATED',
        targetType: 'USER',
        targetId: instructorId,
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    }

    if (action === 'UPDATE_AVATAR') {
      await updateInstructorProfileData(instructorId, {
        avatarUrl: avatarUrl || null,
      });

      return NextResponse.json({
        success: true,
        message: 'Profile photo updated successfully',
        avatarUrl,
      });
    }

    if (action === 'CHANGE_PASSWORD') {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ success: false, error: 'Current and new passwords are required' }, { status: 400 });
      }

      const passValidation = validateStrongPassword(newPassword);
      if (!passValidation.valid) {
        return NextResponse.json({ success: false, error: passValidation.error }, { status: 400 });
      }

      // Verify current password with Supabase Auth or local hash
      let verified = false;
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const authClient = createClient(supabaseUrl, supabaseAnonKey);
        const { error: verifyError } = await authClient.auth.signInWithPassword({
          email: session.activeUser.email,
          password: currentPassword,
        });
        if (!verifyError) verified = true;
      } catch {}

      if (!verified && session.activeUser.passwordHash) {
        const match = await bcrypt.compare(currentPassword, session.activeUser.passwordHash);
        if (match) verified = true;
      }

      if (!verified) {
        return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 });
      }

      // Update in Supabase Auth
      try {
        await supabaseAdmin.auth.admin.updateUserById(instructorId, {
          password: newPassword,
        });
      } catch (authErr) {
        console.warn('Supabase auth password update notice:', authErr);
      }

      // Update in local DB & profiles
      const newHash = await bcrypt.hash(newPassword, 10);
      session.activeUser.passwordHash = newHash;
      await supabaseAdmin
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', instructorId);

      logAuditEvent({
        actorId: instructorId,
        actorEmail: session.activeUser.email,
        actorRole: 'INSTRUCTOR',
        action: 'PASSWORD_CHANGED',
        targetType: 'USER',
        targetId: instructorId,
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });

      dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.PASSWORD_CHANGED,
        targetUserId: instructorId,
        targetRole: 'INSTRUCTOR',
        entityType: 'USER',
        entityId: instructorId,
      }).catch(() => {});

      return NextResponse.json({ success: true, message: 'Password changed successfully' });
    }

    if (action === 'INIT_MFA_SETUP') {
      const setup = initializePortalTotpSetup({
        userId: instructorId,
        email: session.activeUser.email,
        issuer: 'NEWSIM',
      });
      return NextResponse.json({ success: true, ...setup });
    }

    if (action === 'COMPLETE_MFA_SETUP') {
      const result = await completePortalTotpSetup({
        userId: instructorId,
        email: session.activeUser.email,
        role: 'INSTRUCTOR',
        setupToken: String(body.setupToken || ''),
        code: String(body.code || ''),
        ip,
        userAgent,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.MFA_UPDATED,
        targetUserId: instructorId,
        targetRole: 'INSTRUCTOR',
        entityType: 'USER',
        entityId: instructorId,
      }).catch(() => {});
      return NextResponse.json({
        success: true,
        mfaEnabled: true,
        recoveryCodes: result.recoveryCodes,
        message: 'Two-Factor Authentication (TOTP) enabled successfully.',
      });
    }

    if (action === 'REGENERATE_RECOVERY_CODES') {
      const result = await regenerateUserRecoveryCodes({
        userId: instructorId,
        email: session.activeUser.email,
        role: 'INSTRUCTOR',
        currentPassword,
        mfaCode: body.mfaCode,
        fallbackHash: session.activeUser.passwordHash,
        ip,
        userAgent,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.MFA_UPDATED,
        targetUserId: instructorId,
        targetRole: 'INSTRUCTOR',
        entityType: 'USER',
        entityId: instructorId,
        metadata: {
          detail: 'New emergency MFA recovery codes were generated for your Instructor account.',
        },
      }).catch(() => {});
      return NextResponse.json({
        success: true,
        message: 'New recovery codes generated. Store them safely.',
        recoveryCodes: result.recoveryCodes,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update profile:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update profile' }, { status: 500 });
  }
}
