import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  verifySuperAdminRequestAsync,
  createUnauthorizedResponse,
  createForbiddenResponse,
  logAuditEvent,
  sendInvitationEmail,
  escapePostgrestFilter,
  resolveSafeAppOrigin,
} from '@newsim/auth';
import { dispatchNotificationEvent, NOTIFICATION_EVENTS, supabaseAdmin } from '@newsim/database';
import { sanitizePermissionsForRole, validatePassword } from '@newsim/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'ADMIN_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.toLowerCase() || '';
  const status = searchParams.get('status') || 'ALL';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  let query = supabaseAdmin.from('profiles').select('*, admins(position, permissions)', { count: 'exact' }).in('role', ['admin', 'ADMIN']);

  if (status !== 'ALL') {
    query = query.in('status', [status.toLowerCase(), status.toUpperCase()]);
  }

  const safeSearch = escapePostgrestFilter(search);
  if (safeSearch) {
    query = query.or(`email.ilike.%${safeSearch}%,first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%`);
  }

  const startIndex = (page - 1) * limit;
  const { data: admins, count, error } = await query.range(startIndex, startIndex + limit - 1).order('created_at', { ascending: false });

  if (error) {
    console.error("Failed to fetch admins:", error);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }

  const paginated = (admins || []).map((u: any) => {
    const adm = Array.isArray(u.admins) ? u.admins[0] : u.admins;
    return {
      id: u.id,
      email: u.email,
      username: u.username || u.email?.split('@')[0],
      firstName: u.first_name,
      lastName: u.last_name,
      position: adm?.position || u.position || null,
      permissions: Array.isArray(adm?.permissions) ? adm.permissions : [],
      status: (u.status || 'pending').toUpperCase(),
      phone: u.phone,
      avatarUrl: u.avatar_url || null,
      createdAt: u.created_at,
    };
  });

  const total = count || 0;

  return NextResponse.json({
    success: true,
    data: paginated,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'ADMIN_CREATE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, username, position } = body;

    // Validation
    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: "Please enter the administrator's full name." },
        { status: 400 }
      );
    }

    if (!username || username.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Username is required (minimum 3 characters).' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (!position || position.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Position is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    // Check if email already exists
    const { data: existingEmail } = await supabaseAdmin.from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists.' },
        { status: 400 }
      );
    }

    const { password } = body;
    const passwordValidation = validatePassword(password, 12);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: `Password is not strong enough. Missing: ${passwordValidation.errors.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const baseUrl = resolveSafeAppOrigin(req, 'http://localhost:3000');
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true, // auto-confirm to avoid pending lockout
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: 'ADMIN',
      }
    });

    if (createError || !authData.user) {
      throw new Error(createError?.message || "Failed to create user in auth system");
    }

    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      email: cleanEmail,
      username: cleanUsername,
      role: 'ADMIN',
      status: 'PENDING',
      phone: phone || null,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    });

    if (insertError) {
      console.error("Profile insert error:", JSON.stringify(insertError));
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create profile: ${insertError.message}`);
    }

    const rawPermissions = Array.isArray(body.permissions)
      ? body.permissions.filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0)
      : [];
    const grantedPermissions =
      rawPermissions.length > 0 ? sanitizePermissionsForRole('ADMIN', rawPermissions) : [];

    // Persist position and initial least-privilege permissions on admins table
    const { error: adminInsertError } = await supabaseAdmin.from('admins').insert({
      profile_id: authData.user.id,
      position: position.trim(),
      permissions: grantedPermissions,
    });

    if (adminInsertError) {
      console.warn("Admin sub-table insert failed (non-fatal):", JSON.stringify(adminInsertError));
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // Generate a secure confirmation token with 48-hour expiry
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const { error: inviteError } = await supabaseAdmin.from('invitations').insert({
      email: cleanEmail,
      role: 'ADMIN',
      token_hash: token,
      status: 'PENDING',
      expires_at: expiresAt.toISOString(),
      invited_by: auth.user.id,
    });

    if (inviteError) {
      console.warn("Failed to create invitation record:", inviteError);
      // Non-fatal, but admin won't be able to confirm easily. Should probably handle this.
    }

    const confirmUrl = `${baseUrl}/api/auth/confirm?token=${token}`;
    await sendInvitationEmail(cleanEmail, `${firstName.trim()} ${lastName.trim()}`, cleanEmail, confirmUrl, 'administrator');

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: 'ADMIN_INVITATION_CREATED',
      targetType: 'ADMIN',
      targetId: authData.user.id,
      details: {
        adminEmail: cleanEmail,
        name: `${firstName.trim()} ${lastName.trim()}`,
        username: cleanUsername,
        position: position.trim(),
      },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    dispatchNotificationEvent({
      event: NOTIFICATION_EVENTS.ADMIN_ACCOUNT_CREATED,
      entityType: 'USER',
      entityId: authData.user.id,
      metadata: {
        adminEmail: cleanEmail,
        adminName: `${firstName.trim()} ${lastName.trim()}`,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Admin account created and activated successfully.',
      admin: {
        id: authData.user.id,
        email: cleanEmail,
        username: cleanUsername,
        name: `${firstName.trim()} ${lastName.trim()}`,
        position: position.trim(),
        status: 'ACTIVE',
      },
    });
  } catch (error: any) {
    console.error('Admin creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create administrator account.', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
