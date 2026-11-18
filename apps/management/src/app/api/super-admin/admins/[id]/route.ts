import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  verifySuperAdminRequestAsync,
  createUnauthorizedResponse,
  createForbiddenResponse,
  logAuditEvent,
  reactivateAccount,
  resolveSafeAppOrigin,
} from '@newsim/auth';
import { supabaseAdmin } from '@newsim/database';
import { sanitizePermissionsForRole } from '@newsim/utils';
import { invalidateAdminContextCache } from '@/lib/admin-api';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifySuperAdminRequestAsync(req, 'ADMIN_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { id } = await params;
  const [{ data: admin, error }, { data: pendingInvite }] = await Promise.all([
    supabaseAdmin.from('profiles').select('*, admins(position, permissions)').eq('id', id).single(),
    supabaseAdmin.from('invitations').select('id').eq('status', 'PENDING').limit(1).maybeSingle(),
  ]);

  if (error || !admin || (admin.role !== 'admin' && admin.role !== 'ADMIN')) {
    return NextResponse.json(
      { success: false, error: 'Administrator account not found.' },
      { status: 404 }
    );
  }

  const { data: specificInvite } = await supabaseAdmin
    .from('invitations')
    .select('id')
    .eq('email', admin.email)
    .eq('status', 'PENDING')
    .maybeSingle();

  const isPending = admin.status?.toUpperCase() === 'PENDING' || !!specificInvite;

  const adm = Array.isArray((admin as any).admins) ? (admin as any).admins[0] : (admin as any).admins;

  return NextResponse.json({
    success: true,
    data: {
      id: admin.id,
      email: admin.email,
      username: admin.username || admin.email?.split('@')[0],
      firstName: admin.first_name,
      lastName: admin.last_name,
      position: adm?.position || admin.position || null,
      permissions: Array.isArray(adm?.permissions) ? adm.permissions : [],
      status: isPending ? 'PENDING' : admin.status.toUpperCase(),
      phone: admin.phone,
      avatarUrl: admin.avatar_url || null,
      mfaEnabled: !!admin.mfa_enabled,
      createdAt: admin.created_at,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifySuperAdminRequestAsync(req, 'ADMIN_UPDATE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const { id } = await params;
    const { data: admin, error: fetchError } = await supabaseAdmin.from('profiles').select('*').eq('id', id).single();

    if (fetchError || !admin || (admin.role !== 'admin' && admin.role !== 'ADMIN')) {
      return NextResponse.json(
        { success: false, error: 'Administrator account not found.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { action } = body;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    let newStatus = admin.status;

    if (action === 'ACTIVATE' || action === 'UNLOCK') {
      newStatus = 'ACTIVE';
      await reactivateAccount(id, { id: auth.user.id, email: auth.user.email, role: auth.user.role, ip, userAgent });
    } else if (action === 'SUSPEND') {
      newStatus = 'SUSPENDED';
    } else if (action === 'DEACTIVATE') {
      newStatus = 'INACTIVE';
    } else if (action === 'DELETE') {
      // Clean up records in proper sequence to avoid FK conflicts
      await supabaseAdmin.from('admins').delete().eq('profile_id', id);
      const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', id);
      if (profileDeleteError) throw profileDeleteError;

      try {
        await supabaseAdmin.auth.admin.deleteUser(id);
      } catch (authErr) {
        console.warn('Could not delete auth user:', authErr);
      }

      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'ADMIN_DELETED',
        targetType: 'ADMIN',
        targetId: id,
        details: { adminEmail: admin.email },
        ipAddress: ip,
        userAgent,
        severity: 'CRITICAL',
      });

      return NextResponse.json({ success: true, message: 'Administrator account permanently deleted.' });
    } else if (action === 'RESEND_INVITATION') {
      const { data: pendingInvite } = await supabaseAdmin
        .from('invitations')
        .select('id')
        .eq('email', admin.email)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (admin.status?.toUpperCase() !== 'PENDING' && !pendingInvite) {
        return NextResponse.json(
          { success: false, error: 'Can only resend invitation for pending accounts.' },
          { status: 400 }
        );
      }

      // Create a new invitation token with 48-hour expiry
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);
      
      const { error: inviteError } = await supabaseAdmin.from('invitations').insert({
        email: admin.email,
        role: 'ADMIN',
        token_hash: token,
        status: 'PENDING',
        expires_at: expiresAt.toISOString(),
        invited_by: auth.user.id,
      });

      if (inviteError) {
        throw new Error(`Failed to generate new invitation: ${inviteError.message}`);
      }

      const baseUrl = resolveSafeAppOrigin(req, 'http://localhost:3000');
      const confirmUrl = `${baseUrl}/api/auth/confirm?token=${token}`;
      
      const { sendInvitationEmail } = await import('@newsim/auth');
      const emailResult = await sendInvitationEmail(
        admin.email,
        `${admin.first_name} ${admin.last_name}`,
        admin.email,
        confirmUrl,
        'administrator'
      );

      if (!emailResult?.success) {
        return NextResponse.json(
          { success: false, error: emailResult?.error || 'Failed to send confirmation email. Please check SMTP configuration.' },
          { status: 502 }
        );
      }

      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'ADMIN_INVITATION_RESENT',
        targetType: 'ADMIN',
        targetId: admin.id,
        details: { adminEmail: admin.email },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      return NextResponse.json({ success: true, message: 'Invitation resent successfully.' });
    } else if (action === 'UPDATE_PERMISSIONS') {
      if (!Array.isArray(body.permissions)) {
        return NextResponse.json(
          { success: false, error: 'Permissions array is required.' },
          { status: 400 }
        );
      }

      const rawPerms = body.permissions.filter(
        (p: unknown): p is string => typeof p === 'string' && p.trim().length > 0
      );
      const sanitizedPermissions =
        rawPerms.length > 0 ? sanitizePermissionsForRole('ADMIN', rawPerms) : [];

      const updateFields: Record<string, unknown> = {
        permissions: sanitizedPermissions,
      };
      if (typeof body.position === 'string' && body.position.trim().length > 0) {
        updateFields.position = body.position.trim();
      }

      const { data: existingAdminRow } = await supabaseAdmin
        .from('admins')
        .select('profile_id, position')
        .eq('profile_id', id)
        .maybeSingle();

      if (existingAdminRow) {
        const { error: permErr } = await supabaseAdmin
          .from('admins')
          .update(updateFields)
          .eq('profile_id', id);
        if (permErr) throw permErr;
      } else {
        const { error: permInsErr } = await supabaseAdmin.from('admins').insert({
          profile_id: id,
          position: (updateFields.position as string) || admin.position || 'Administrator',
          permissions: sanitizedPermissions,
        });
        if (permInsErr) throw permInsErr;
      }

      invalidateAdminContextCache(id);

      try {
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: auth.user.id,
          action: 'ADMIN_PERMISSIONS_UPDATED',
          entity_type: 'ADMIN',
          entity_id: id,
          new_values: {
            permissions: sanitizedPermissions,
            ...(updateFields.position ? { position: updateFields.position } : {}),
          },
          created_at: new Date().toISOString(),
        });
      } catch (auditErr) {
        console.warn('Could not write audit log:', auditErr);
      }

      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'ADMIN_PERMISSIONS_UPDATED',
        targetType: 'ADMIN',
        targetId: admin.id,
        details: {
          adminEmail: admin.email,
          permissionsCount: sanitizedPermissions.length,
        },
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });

      return NextResponse.json({
        success: true,
        message: 'Administrator module permissions updated.',
        data: {
          id: admin.id,
          permissions: sanitizedPermissions,
          ...(updateFields.position ? { position: updateFields.position } : {}),
        },
      });
    }

    // Update status in profiles
    if (newStatus !== admin.status) {
      const { error: updateError } = await supabaseAdmin.from('profiles').update({ status: newStatus }).eq('id', id);
      invalidateAdminContextCache(id);
      if (updateError) throw updateError;

      if (newStatus === 'SUSPENDED') {
        try {
          await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: '876600h' });
        } catch (e) {
          console.warn('Could not set ban duration in auth.users:', e);
        }
      } else if (newStatus === 'ACTIVE') {
        try {
          await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: 'none' });
        } catch (e) {
          console.warn('Could not reset ban duration in auth.users:', e);
        }
      }
    }

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: `ADMIN_${action}`,
      targetType: 'ADMIN',
      targetId: admin.id,
      details: { adminEmail: admin.email },
      ipAddress: ip,
      userAgent,
      severity: 'WARNING',
    });

    return NextResponse.json({
      success: true,
      message: 'Administrator account successfully updated.',
      data: {
        id: admin.id,
        status: newStatus.toUpperCase(),
      },
    });
  } catch (error: any) {
    console.error('Admin action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update administrator account.', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifySuperAdminRequestAsync(req, 'ADMIN_DELETE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const { id } = await params;
    const { data: admin, error: fetchError } = await supabaseAdmin.from('profiles').select('*').eq('id', id).single();

    if (fetchError || !admin || (admin.role !== 'admin' && admin.role !== 'ADMIN')) {
      return NextResponse.json(
        { success: false, error: 'Administrator account not found.' },
        { status: 404 }
      );
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    await supabaseAdmin.from('admins').delete().eq('profile_id', id);
    const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', id);
    if (profileDeleteError) throw profileDeleteError;
    invalidateAdminContextCache(id);

    try {
      await supabaseAdmin.auth.admin.deleteUser(id);
    } catch (authErr) {
      console.warn('Could not delete auth user:', authErr);
    }

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: 'ADMIN_DELETED',
      targetType: 'ADMIN',
      targetId: id,
      details: { adminEmail: admin.email },
      ipAddress: ip,
      userAgent,
      severity: 'CRITICAL',
    });

    return NextResponse.json({ success: true, message: 'Administrator account permanently deleted.' });
  } catch (error: any) {
    console.error('Admin DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete administrator account.', details: error.message },
      { status: 500 }
    );
  }
}

