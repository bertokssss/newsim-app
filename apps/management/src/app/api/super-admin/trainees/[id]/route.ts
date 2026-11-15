import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  verifySuperAdminRequestAsync,
  createUnauthorizedResponse,
  createForbiddenResponse,
  reactivateAccount,
} from '@newsim/auth';
import {
  formatAttendance,
  formatCertificate,
  formatEnrollment,
  formatPayment,
  formatTrainee,
  requestMeta,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdminRequestAsync(request, 'TRAINEE_VIEW');

  if (!auth.authorized) {
    return auth.statusCode === 401
      ? createUnauthorizedResponse(auth.error)
      : createForbiddenResponse(auth.error);
  }

  try {
    const { id } = await params;
    const { data: trainee, error } = await supabaseAdmin
      .from('trainees')
      .select('*, profiles!inner(*), training_centers(name)')
      .eq('profile_id', id)
      .maybeSingle();

    if (error) throw error;
    if (!trainee) {
      return NextResponse.json({ success: false, error: 'Trainee not found' }, { status: 404 });
    }

    const [{ data: enrollments }, { data: attendance }, { data: certificates }] =
      await Promise.all([
        supabaseAdmin
          .from('enrollments')
          .select('id, trainee_id, course_id, package_id, batch_id, training_center_id, status, enrolled_at, completed_at, created_at, trainees(profile_id, profiles(first_name, last_name, email, avatar_url)), courses(code, name), training_centers(name)')
          .eq('trainee_id', id),
        supabaseAdmin
          .from('attendance')
          .select('*, trainees(profiles(first_name, last_name, avatar_url)), schedules(start_at, room, instructor_id, course_id, courses(name), instructors(profiles(first_name, last_name, avatar_url)))')
          .eq('trainee_id', id),
        supabaseAdmin
          .from('certificates')
          .select('*, trainees(profiles(first_name, last_name, email, avatar_url)), courses(code, name)')
          .eq('trainee_id', id),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        ...formatTrainee(trainee),
        enrollments: (enrollments || []).map((row: any) => {
          const formatted = formatEnrollment(row);
          const { paymentAmount, paymentStatus, rawPaymentStatus, paymongoCheckoutId, paymongoPaymentId, paymentMethod, ...nonFinancial } = formatted as any;
          return nonFinancial;
        }),
        attendance: (attendance || []).map(formatAttendance),
        certificates: (certificates || []).map(formatCertificate),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdminRequestAsync(request, 'TRAINEE_UPDATE');

  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401
      ? createUnauthorizedResponse(auth.error)
      : createForbiddenResponse(auth.error);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { ip, userAgent } = requestMeta(request);

    if (body.action === 'RESEND_INVITATION') {
      const { data: traineeProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (!traineeProfile) {
        return NextResponse.json({ success: false, error: 'Trainee profile not found.' }, { status: 404 });
      }

      if (traineeProfile.status?.toUpperCase() !== 'PENDING') {
        return NextResponse.json({ success: false, error: 'Can only resend invitation for pending accounts.' }, { status: 400 });
      }

      const token = (await import('crypto')).randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      await supabaseAdmin.from('invitations').insert({
        email: traineeProfile.email,
        role: 'TRAINEE',
        token_hash: token,
        status: 'PENDING',
        expires_at: expiresAt.toISOString(),
        invited_by: auth.user?.id,
      });

      const { resolveSafeAppOrigin } = await import('@newsim/auth');
      const baseUrl = resolveSafeAppOrigin(request, 'http://localhost:3000');
      const confirmUrl = `${baseUrl}/api/auth/confirm?token=${token}`;

      const { sendInvitationEmail } = await import('@newsim/auth');
      await sendInvitationEmail(
        traineeProfile.email,
        `${traineeProfile.first_name} ${traineeProfile.last_name}`,
        traineeProfile.email,
        confirmUrl,
        'trainee'
      );

      return NextResponse.json({ success: true, message: 'Confirmation email resent successfully.' });
    }

    const profileUpdates: Record<string, unknown> = {};
    const traineeUpdates: Record<string, unknown> = {};

    if (body.action === 'SUSPEND') {
      profileUpdates.status = 'SUSPENDED';
    } else if (body.action === 'ACTIVATE') {
      profileUpdates.status = 'ACTIVE';
      await reactivateAccount(id, { id: auth.user.id, email: auth.user.email, role: auth.user.role, ip, userAgent });
    }

    if (body.firstName !== undefined) profileUpdates.first_name = body.firstName;
    if (body.lastName !== undefined) profileUpdates.last_name = body.lastName;
    if (body.phone !== undefined) profileUpdates.phone = body.phone;
    if (body.status !== undefined) profileUpdates.status = body.status;
    if (body.address !== undefined) traineeUpdates.address = body.address;
    if (body.srn !== undefined) {
      const cleanSrn = String(body.srn).trim();
      profileUpdates.srn = cleanSrn;
      traineeUpdates.srn = cleanSrn;
      traineeUpdates.trainee_number = cleanSrn;
    }

    if (Object.keys(profileUpdates).length) {
      const { error } = await supabaseAdmin.from('profiles').update(profileUpdates).eq('id', id);
      if (error) throw error;

      if (profileUpdates.status === 'SUSPENDED') {
        try {
          await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: '876600h' });
        } catch (e) {
          console.warn('Could not set ban duration in auth.users:', e);
        }
      } else if (profileUpdates.status === 'ACTIVE') {
        try {
          await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: 'none' });
        } catch (e) {
          console.warn('Could not reset ban duration in auth.users:', e);
        }
      }
    }

    if (Object.keys(traineeUpdates).length) {
      const { error } = await supabaseAdmin.from('trainees').update(traineeUpdates).eq('profile_id', id);
      if (error) throw error;
    }

    try {
      await writeAdminAudit({
        actorId: auth.user?.id || 'unknown',
        action: 'TRAINEE_UPDATED',
        entityType: 'TRAINEE',
        entityId: id,
        details: { changes: Object.keys({ ...profileUpdates, ...traineeUpdates }) },
        ip,
        userAgent,
      });
    } catch {}

    const { data: updated, error } = await supabaseAdmin
      .from('trainees')
      .select('*, profiles!inner(*), training_centers(name)')
      .eq('profile_id', id)
      .single();

    if (error || !updated) {
      return NextResponse.json({ success: false, error: 'Trainee not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: formatTrainee(updated) });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update trainee' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdminRequestAsync(request, 'TRAINEE_DELETE');
  if (!auth.authorized) {
    return auth.statusCode === 401
      ? createUnauthorizedResponse(auth.error)
      : createForbiddenResponse(auth.error);
  }

  try {
    const { id } = await params;
    const { ip, userAgent } = requestMeta(request);

    // Clean up dependent trainee records to avoid FK constraint blocks
    await supabaseAdmin.from('attendance').delete().eq('trainee_id', id);
    await supabaseAdmin.from('certificates').delete().eq('trainee_id', id);
    await supabaseAdmin.from('payments').delete().eq('trainee_id', id);
    await supabaseAdmin.from('enrollments').delete().eq('trainee_id', id);
    await supabaseAdmin.from('trainees').delete().eq('profile_id', id);
    const { error } = await supabaseAdmin.from('profiles').delete().eq('id', id);

    if (error) throw error;

    try {
      await supabaseAdmin.auth.admin.deleteUser(id);
    } catch (e) {
      console.warn('Failed or already deleted auth user:', e);
    }

    try {
      await writeAdminAudit({
        actorId: auth.user?.id || 'unknown',
        action: 'TRAINEE_DELETED',
        entityType: 'TRAINEE',
        entityId: id,
        details: { note: 'Trainee account permanently deleted' },
        ip,
        userAgent,
      });
    } catch {}

    return NextResponse.json({ success: true, message: 'Trainee account permanently deleted.' });
  } catch (error: any) {
    console.error('DELETE Trainee Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete trainee account', details: error?.message }, { status: 500 });
  }
}
