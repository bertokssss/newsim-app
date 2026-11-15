import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getTraineeProfileData, updateTraineeProfileData, dispatchNotificationEvent, NOTIFICATION_EVENTS } from '@newsim/database';
import {
  verifyTraineeRequestAsync,
  createUnauthorizedResponse,
  createForbiddenResponse,
  validateStrongPassword,
  initializePortalTotpSetup,
  completePortalTotpSetup,
  regenerateUserRecoveryCodes,
  userHasLocalPassword,
} from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const [profile, hasLocalPassword] = await Promise.all([
      getTraineeProfileData(traineeId),
      userHasLocalPassword(traineeId),
    ]);
    return NextResponse.json({ success: true, data: { ...profile, hasLocalPassword } });
  } catch (error) {
    console.error('Failed to load trainee profile from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load trainee profile' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const body = await req.json();
    const { action, firstName, lastName, phone, currentPassword, newPassword, srn, avatarUrl } = body;

    if (action === 'UPDATE_PROFILE') {
      try {
        const updates: { firstName?: string; lastName?: string; phone?: string; srn?: string; avatarUrl?: string | null } = {
          firstName,
          lastName,
          phone,
        };
        if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
        if (srn !== undefined && typeof srn === 'string') {
          const cleanSrn = srn.trim();
          if (cleanSrn) updates.srn = cleanSrn;
        }
        await updateTraineeProfileData(traineeId, updates);
        return NextResponse.json({ success: true, message: 'Profile updated successfully' });
      } catch (err: any) {
        const isDuplicate = err?.code === 'DUPLICATE_SRN' || err?.message?.includes('already associated');
        return NextResponse.json(
          {
            success: false,
            error: isDuplicate
              ? 'This SRN is already associated with another trainee account.'
              : err?.message || 'Failed to update profile.',
          },
          { status: isDuplicate ? 409 : 400 }
        );
      }
    }

        if (action === 'UPDATE_AVATAR') {
      await updateTraineeProfileData(traineeId, { avatarUrl: avatarUrl || null });
      return NextResponse.json({ success: true, message: 'Profile picture updated successfully', avatarUrl });
    }

if (action === 'UPDATE_SRN' || action === 'SAVE_SRN') {
      const trimmedSrn = (srn || '').trim();
      if (!trimmedSrn) {
        return NextResponse.json(
          { success: false, error: 'Please enter a valid Seafarer Registration Number (SRN).' },
          { status: 400 }
        );
      }

      try {
        await updateTraineeProfileData(traineeId, { srn: trimmedSrn });
        try {
          await dispatchNotificationEvent({
            event: NOTIFICATION_EVENTS.SRN_UPDATED,
            traineeId,
            metadata: { srn: trimmedSrn },
          });
        } catch {}

        return NextResponse.json({
          success: true,
          message: 'Seafarer Registration Number saved successfully.',
          srn: trimmedSrn,
        });
      } catch (err: any) {
        const isDuplicate = err?.code === 'DUPLICATE_SRN' || err?.message?.includes('already associated');
        try {
          await dispatchNotificationEvent({
            event: NOTIFICATION_EVENTS.SRN_VALIDATION_FAILED,
            traineeId,
            metadata: { srn: trimmedSrn },
          });
        } catch {}

        return NextResponse.json(
          {
            success: false,
            error: isDuplicate
              ? 'This SRN is already associated with another trainee account.'
              : err?.message || 'Failed to save SRN.',
            code: isDuplicate ? 'DUPLICATE_SRN' : 'SRN_UPDATE_FAILED',
          },
          { status: isDuplicate ? 409 : 400 }
        );
      }
    }

    if (action === 'CHANGE_PASSWORD') {
      if (!currentPassword || typeof currentPassword !== 'string') {
        return NextResponse.json({ success: false, error: 'Current password is required.' }, { status: 400 });
      }
      const { signInWithPassword } = await import('@newsim/auth');
      try {
        await signInWithPassword(auth.user.email, currentPassword);
      } catch {
        return NextResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 401 });
      }

      const passValidation = validateStrongPassword(newPassword);
      if (!passValidation.valid) {
        return NextResponse.json({ success: false, error: passValidation.error }, { status: 400 });
      }

      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(traineeId, {
        password: newPassword,
      });

      if (authErr) {
        return NextResponse.json({ success: false, error: authErr.message || 'Failed to update password' }, { status: 400 });
      }

      try {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.PASSWORD_CHANGED,
          traineeId,
        });
      } catch {}

      return NextResponse.json({ success: true, message: 'Password updated successfully' });
    }

    if (action === 'INIT_MFA_SETUP') {
      const setup = initializePortalTotpSetup({
        userId: traineeId,
        email: auth.user.email,
        issuer: 'NEWSIM Maritime System',
      });
      return NextResponse.json({ success: true, ...setup });
    }

    if (action === 'COMPLETE_MFA_SETUP') {
      const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
      const userAgent = req.headers.get('user-agent') || 'Browser';
      const result = await completePortalTotpSetup({
        userId: traineeId,
        email: auth.user.email,
        role: 'TRAINEE',
        setupToken: String(body.setupToken || ''),
        code: String(body.code || ''),
        ip,
        userAgent,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      try {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.MFA_UPDATED,
          traineeId,
        });
      } catch {}

      return NextResponse.json({
        success: true,
        mfaEnabled: true,
        recoveryCodes: result.recoveryCodes,
        message: 'Two-Factor Authentication (TOTP) activated successfully.',
      });
    }

    if (action === 'REGENERATE_RECOVERY_CODES') {
      const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
      const userAgent = req.headers.get('user-agent') || 'Browser';
      const result = await regenerateUserRecoveryCodes({
        userId: traineeId,
        email: auth.user.email,
        role: 'TRAINEE',
        currentPassword,
        mfaCode: body.mfaCode,
        fallbackHash: auth.user.passwordHash,
        ip,
        userAgent,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      try {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.MFA_UPDATED,
          traineeId,
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: 'New recovery codes generated. Store them safely.',
        recoveryCodes: result.recoveryCodes,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update profile in Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
