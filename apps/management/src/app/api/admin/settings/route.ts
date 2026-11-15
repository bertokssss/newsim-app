import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotificationEvent, NOTIFICATION_EVENTS, supabaseAdmin } from '@newsim/database';
import {
  validateStrongPassword,
  initializePortalTotpSetup,
  completePortalTotpSetup,
  regenerateUserRecoveryCodes,
} from '@newsim/auth';
import {
  isAdminContext,
  requestMeta,
  requireAdmin,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!isAdminContext(ctx)) return ctx;

  try {
    const [profileRes, adminRes] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, phone, avatar_url, status, mfa_enabled, mfa_secret')
        .eq('id', ctx.user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('admins')
        .select('position, employee_number')
        .eq('profile_id', ctx.user.id)
        .maybeSingle(),
    ]);

    const profile = profileRes.data;
    const admin = adminRes.data;

    return NextResponse.json({
      success: true,
      data: {
        id: ctx.user.id,
        firstName: profile?.first_name || ctx.user.firstName,
        lastName: profile?.last_name || ctx.user.lastName,
        email: profile?.email || ctx.user.email,
        username: ctx.user.username,
        phone: profile?.phone || ctx.user.phone,
        avatarUrl: profile?.avatar_url || null,
        department: admin?.position || ctx.user.department || 'Operations & Enrollment',
        employeeId: admin?.employee_number || ctx.user.employeeId || 'ADM-2024-001',
        srn: admin?.employee_number || 'SRN-ADM-001',
        mfaEnabled: profile ? Boolean(profile.mfa_enabled && profile.mfa_secret) : (ctx.user.mfaEnabled || false),
        lastLoginAt: ctx.user.lastLoginAt,
        status: (profile?.status || ctx.user.status || 'ACTIVE').toString().toUpperCase(),
        centerId: ctx.centerId,
        centerName: ctx.centerName,
      },
    });
  } catch (error) {
    console.error('Failed to load settings:', error);
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { action, firstName, lastName, phone, department, srn, avatarUrl, currentPassword, newPassword, preferences } = body;
    const { ip, userAgent } = requestMeta(request);

    if (action === 'UPDATE_PROFILE') {
      const { error: profErr } = await supabaseAdmin
        .from('profiles')
        .update({
          first_name: firstName?.trim() || ctx.user.firstName,
          last_name: lastName?.trim() || ctx.user.lastName,
          phone: phone !== undefined ? phone.trim() : ctx.user.phone,
          ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ctx.user.id);

      if (profErr) throw profErr;

      if (department || srn) {
        const { data: adminRow } = await supabaseAdmin
          .from('admins')
          .select('profile_id')
          .eq('profile_id', ctx.user.id)
          .maybeSingle();

        if (adminRow) {
          await supabaseAdmin
            .from('admins')
            .update({
              ...(department ? { position: department.trim() } : {}),
              ...(srn ? { employee_number: srn.trim() } : {}),
            })
            .eq('profile_id', ctx.user.id);
        } else {
          await supabaseAdmin
            .from('admins')
            .insert({
              profile_id: ctx.user.id,
              position: department?.trim() || 'Operations & Enrollment',
              employee_number: srn?.trim() || `ADM-${Date.now().toString().slice(-6)}`,
            });
        }
      }

      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'ADMIN_PROFILE_UPDATED',
        entityType: 'USER',
        entityId: ctx.user.id,
        details: { firstName, lastName, phone, department, srn },
        ip,
        userAgent,
      });

      return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    }

    if (action === 'UPDATE_AVATAR') {
      const { error: avErr } = await supabaseAdmin
        .from('profiles')
        .update({
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ctx.user.id);

      if (avErr) throw avErr;

      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'ADMIN_AVATAR_UPDATED',
        entityType: 'USER',
        entityId: ctx.user.id,
        ip,
        userAgent,
      });

      return NextResponse.json({ success: true, message: 'Profile photo updated successfully', avatarUrl });
    }

    if (action === 'UPDATE_NOTIFICATIONS') {
      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'NOTIFICATION_PREFERENCES_UPDATED',
        entityType: 'USER',
        entityId: ctx.user.id,
        details: { preferences },
        ip,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        message: 'Notification preferences saved successfully.',
      });
    }

    if (action === 'CHANGE_PASSWORD') {
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { success: false, error: 'Current and new passwords are required' },
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

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { error: verifyError } = await authClient.auth.signInWithPassword({
        email: ctx.user.email,
        password: currentPassword,
      });

      if (verifyError) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(ctx.user.id, {
        password: newPassword,
      });
      if (updateError) throw updateError;

      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'PASSWORD_CHANGED',
        entityType: 'USER',
        entityId: ctx.user.id,
        details: { method: 'USER_SETTINGS' },
        ip,
        userAgent,
      });

      dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.PASSWORD_CHANGED,
        targetUserId: ctx.user.id,
        targetRole: 'ADMIN',
        entityType: 'USER',
        entityId: ctx.user.id,
      }).catch(() => {});

      return NextResponse.json({ success: true, message: 'Password changed successfully' });
    }

    if (action === 'INIT_MFA_SETUP') {
      const setup = initializePortalTotpSetup({
        userId: ctx.user.id,
        email: ctx.user.email,
        issuer: 'NEWSIM',
      });
      return NextResponse.json({ success: true, ...setup });
    }

    if (action === 'COMPLETE_MFA_SETUP') {
      const result = await completePortalTotpSetup({
        userId: ctx.user.id,
        email: ctx.user.email,
        role: ctx.user.role,
        setupToken: String(body.setupToken || ''),
        code: String(body.code || ''),
        ip,
        userAgent,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'MFA_ENABLED',
        entityType: 'USER',
        entityId: ctx.user.id,
        details: { method: 'ADMIN_SETTINGS_TOTP' },
        ip,
        userAgent,
      });
      dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.MFA_UPDATED,
        targetUserId: ctx.user.id,
        targetRole: 'ADMIN',
        entityType: 'USER',
        entityId: ctx.user.id,
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
        userId: ctx.user.id,
        email: ctx.user.email,
        role: ctx.user.role,
        currentPassword,
        mfaCode: body.mfaCode,
        fallbackHash: ctx.user.passwordHash,
        ip,
        userAgent,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'MFA_RECOVERY_CODES_REGENERATED',
        entityType: 'USER',
        entityId: ctx.user.id,
        ip,
        userAgent,
      });
      dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.MFA_UPDATED,
        targetUserId: ctx.user.id,
        targetRole: 'ADMIN',
        entityType: 'USER',
        entityId: ctx.user.id,
        metadata: {
          detail: 'New emergency MFA recovery codes were generated for your Admin account.',
        },
      }).catch(() => {});
      return NextResponse.json({
        success: true,
        message: 'New recovery codes generated. Store them safely.',
        recoveryCodes: result.recoveryCodes,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 });
  }
}
