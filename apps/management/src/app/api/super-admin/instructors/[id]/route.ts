import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequestAsync, createUnauthorizedResponse, createForbiddenResponse, reactivateAccount, resolveSafeAppOrigin } from '@newsim/auth';
import { supabaseAdmin } from '@newsim/database';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifySuperAdminRequestAsync(req, 'INSTRUCTOR_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { id } = await params;
  const { data: profile, error } = await supabaseAdmin.from('profiles').select('*, instructors!inner(*)').eq('id', id).single();

  if (error || !profile || (profile.role !== 'instructor' && profile.role !== 'INSTRUCTOR')) {
    return NextResponse.json(
      { success: false, error: 'Instructor account not found.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: profile.id,
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phone: profile.phone,
      avatarUrl: profile.avatar_url || null,
      status: profile.status.toUpperCase(),
      mfaEnabled: !!profile.mfa_enabled,
      createdAt: profile.created_at,
      
      // Instructor fields
      username: profile.username,
      position: profile.instructors[0].position,
      department: profile.instructors[0].department,
      employmentType: profile.instructors[0].employment_type,
      dateHired: profile.instructors[0].date_hired,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifySuperAdminRequestAsync(req, 'INSTRUCTOR_UPDATE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const { id } = await params;
    const { data: profile, error: fetchError } = await supabaseAdmin.from('profiles').select('*').eq('id', id).single();

    if (fetchError || !profile || (profile.role !== 'instructor' && profile.role !== 'INSTRUCTOR')) {
      return NextResponse.json(
        { success: false, error: 'Instructor account not found.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { action } = body;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    let newStatus = profile.status;

    if (action === 'ACTIVATE' || action === 'UNLOCK') {
      newStatus = 'ACTIVE';
      await reactivateAccount(id, { id: auth.user.id, email: auth.user.email, role: auth.user.role, ip, userAgent });
    } else if (action === 'SUSPEND') {
      newStatus = 'SUSPENDED';
    } else if (action === 'DEACTIVATE') {
      newStatus = 'INACTIVE';
    } else if (action === 'DELETE') {
      await supabaseAdmin.from('instructors').delete().eq('profile_id', id);
      const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', id);
      if (profileDeleteError) {
        return NextResponse.json({ success: false, error: profileDeleteError.message }, { status: 400 });
      }

      try {
        await supabaseAdmin.auth.admin.deleteUser(id);
      } catch (authErr) {
        console.warn('Could not delete auth user:', authErr);
      }

      return NextResponse.json({ success: true, message: 'Instructor account permanently deleted.' });
    } else if (action === 'RESEND_INVITATION') {
      if (profile.status !== 'pending' && profile.status !== 'PENDING') {
        return NextResponse.json(
          { success: false, error: 'Can only resend invitation for pending accounts.' },
          { status: 400 }
        );
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);
      
      const { error: inviteError } = await supabaseAdmin.from('invitations').insert({
        email: profile.email,
        role: 'INSTRUCTOR',
        token_hash: token,
        status: 'PENDING',
        expires_at: expiresAt.toISOString(),
        invited_by: auth.user.id,
      });

      if (inviteError) {
        return NextResponse.json(
          { success: false, error: `Failed to generate invitation token: ${inviteError.message}` },
          { status: 500 }
        );
      }

      const baseUrl = resolveSafeAppOrigin(req, 'http://localhost:3000');
      const confirmUrl = `${baseUrl}/api/auth/confirm?token=${token}`;
      
      const { sendInvitationEmail } = await import('@newsim/auth');
      const emailResult = await sendInvitationEmail(
        profile.email,
        `${profile.first_name} ${profile.last_name}`,
        profile.email,
        confirmUrl,
        'instructor'
      );

      if (!emailResult?.success) {
        return NextResponse.json(
          { success: false, error: emailResult?.error || 'Failed to resend confirmation email. Please check SMTP configuration.' },
          { status: 502 }
        );
      }

      return NextResponse.json({ success: true, message: 'Confirmation email resent successfully.' });
    }

    if (newStatus !== profile.status) {
      const { error: updateError } = await supabaseAdmin.from('profiles').update({ status: newStatus }).eq('id', id);
      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 400 });
      }

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

    return NextResponse.json({
      success: true,
      message: `Instructor account ${newStatus} successfully.`,
      data: {
        id: profile.id,
        status: newStatus.toUpperCase(),
      },
      status: newStatus.toUpperCase(),
    });

  } catch (error: any) {
    console.error('Error updating instructor:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update instructor account.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifySuperAdminRequestAsync(req, 'INSTRUCTOR_DELETE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const { id } = await params;
    const { data: profile, error: fetchError } = await supabaseAdmin.from('profiles').select('*').eq('id', id).single();

    if (fetchError || !profile || (profile.role !== 'instructor' && profile.role !== 'INSTRUCTOR')) {
      return NextResponse.json(
        { success: false, error: 'Instructor account not found.' },
        { status: 404 }
      );
    }

    await supabaseAdmin.from('instructors').delete().eq('profile_id', id);
    const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', id);
    if (profileDeleteError) {
      return NextResponse.json({ success: false, error: profileDeleteError.message }, { status: 400 });
    }

    try {
      await supabaseAdmin.auth.admin.deleteUser(id);
    } catch (authErr) {
      console.warn('Could not delete auth user:', authErr);
    }

    return NextResponse.json({ success: true, message: 'Instructor account permanently deleted.' });
  } catch (error: any) {
    console.error('Error deleting instructor:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete instructor account.' },
      { status: 500 }
    );
  }
}

