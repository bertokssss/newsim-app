import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  verifyAdminRequestAsync,
  verifySuperAdminRequestAsync,
  createUnauthorizedResponse,
  createForbiddenResponse,
  reactivateAccount,
  resolveSafeAppOrigin,
  resolveSiblingPortalOrigin,
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
  const auth = await verifyAdminRequestAsync(request, 'TRAINEE_VIEW');

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

    const [
      { data: enrollments },
      { data: attendance },
      { data: certificates },
      { data: grades },
      { data: attempts },
      { data: practicalEvals },
      { data: pendingInvite },
    ] = await Promise.all([
      supabaseAdmin
        .from('enrollments')
        .select('id, trainee_id, course_id, package_id, batch_id, training_center_id, status, review_notes, enrolled_at, completed_at, created_at, trainees(profile_id, profiles(first_name, last_name, email, avatar_url)), courses(code, name, category), batches(batch_code, start_date, end_date, instructor_id), training_centers(name)')
        .eq('trainee_id', id)
        .order('enrolled_at', { ascending: false }),
      supabaseAdmin
        .from('attendance')
        .select('*, trainees(profiles(first_name, last_name, avatar_url)), schedules(start_at, room, instructor_id, course_id, courses(name), instructors(profiles(first_name, last_name, avatar_url)))')
        .eq('trainee_id', id),
      supabaseAdmin
        .from('certificates')
        .select('*, trainees(profiles(first_name, last_name, email, avatar_url)), courses(code, name, category)')
        .eq('trainee_id', id)
        .order('issued_at', { ascending: false }),
      supabaseAdmin
        .from('grades')
        .select('*, courses(code, name, category)')
        .eq('trainee_id', id)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('assessment_attempts')
        .select('id, assessment_id, score, status, passed, submitted_at, assessments(id, title, passing_score, course_id, module_id, courses(code, name), assessment_questions(id))')
        .eq('trainee_id', id)
        .order('submitted_at', { ascending: false }),
      supabaseAdmin
        .from('practical_evaluations')
        .select('id, course_id, total_score, max_possible_score, percentage, competency_status, status, general_feedback, evaluation_date, courses(code, name)')
        .eq('trainee_id', id)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('invitations')
        .select('id')
        .eq('email', trainee.profiles?.email)
        .eq('status', 'PENDING')
        .maybeSingle(),
    ]);

    const formattedTrainee = formatTrainee(trainee);
    if (pendingInvite) {
      formattedTrainee.status = 'PENDING';
    }

    const nowMs = Date.now();
    const nearExpWindowMs = 90 * 24 * 60 * 60 * 1000;
    const formattedCertificates = (certificates || []).map((row: any) => {
      const base = formatCertificate(row);
      const expMs = row.expires_at ? new Date(row.expires_at).getTime() : null;
      let validityStatus: 'VALID' | 'NEAR_EXPIRATION' | 'EXPIRED' | 'PENDING_VERIFICATION' | 'NO_EXPIRATION' = 'VALID';
      if ((row.status || '').toUpperCase() === 'PENDING' || (row.status || '').toUpperCase() === 'PENDING_VERIFICATION') {
        validityStatus = 'PENDING_VERIFICATION';
      } else if (!expMs) {
        validityStatus = 'NO_EXPIRATION';
      } else if (expMs < nowMs) {
        validityStatus = 'EXPIRED';
      } else if (expMs - nowMs <= nearExpWindowMs) {
        validityStatus = 'NEAR_EXPIRATION';
      }
      return {
        ...base,
        validityStatus,
      };
    });

    const formattedAssessments = (attempts || [])
      .filter((att: any) => !(Number(att.score) === 0 && att.status === 'FAILED' && String(att.submitted_at || '').includes('59:59')))
      .map((att: any) => {
        const asm = att.assessments || {};
        const totalQuestions = Array.isArray(asm.assessment_questions) ? asm.assessment_questions.length || 10 : 10;
        const scorePct = Number(att.score) || 0;
        const correctCount = Math.round((scorePct * totalQuestions) / 100);
        const passingScore = Number(asm.passing_score) || 75;
        return {
          id: att.id,
          assessmentId: att.assessment_id,
          title: asm.title || 'Competency Assessment',
          courseCode: asm.courses?.code || 'STCW',
          courseTitle: asm.courses?.name || 'Maritime Course',
          type: asm.module_id ? 'MODULE_QUIZ' : 'POST_TEST',
          score: scorePct,
          correctCount,
          totalQuestions,
          scoreDisplay: `${correctCount}/${totalQuestions} (${scorePct}%)`,
          passingScore,
          passed: Boolean(att.passed ?? scorePct >= passingScore),
          status: att.status || (scorePct >= passingScore ? 'PASSED' : 'FAILED'),
          submittedAt: att.submitted_at,
        };
      });

    return NextResponse.json({
      success: true,
      data: {
        ...formattedTrainee,
        enrollments: (enrollments || []).map((row: any) => {
          const formatted = formatEnrollment(row);
          const { paymentAmount, paymentStatus, rawPaymentStatus, paymongoCheckoutId, paymongoPaymentId, paymentMethod, ...nonFinancial } = formatted as any;
          const cat = row.courses?.category || 'Safety and Other STCW Courses';
          const isInHouse = String(cat).toLowerCase().includes('in-house') || String(cat).toLowerCase().includes('modular');
          return {
            ...nonFinancial,
            courseCategory: isInHouse ? 'MODULAR / IN-HOUSE' : 'MODULAR + PRACTICAL',
            instructorPurpose: isInHouse ? 'ACADEMIC_RECORD_REVIEW' : 'PRACTICAL_TRAINING',
            reviewNotes: row.review_notes || null,
          };
        }),
        attendance: (attendance || []).map(formatAttendance),
        certificates: formattedCertificates,
        grades: (grades || []).map((g: any) => ({
          id: g.id,
          courseId: g.course_id,
          courseCode: g.courses?.code || 'STCW',
          courseTitle: g.courses?.name || 'Maritime Course',
          finalScore: Number(g.final_score) || 0,
          moduleScore: Number(g.module_score) || 0,
          practicalScore: Number(g.practical_score) || 0,
          attendanceScore: Number(g.attendance_score) || 0,
          status: g.status || 'IN_PROGRESS',
          remarks: g.remarks || '',
          gradedAt: g.graded_at || g.updated_at,
        })),
        assessmentAttempts: formattedAssessments,
        practicalEvaluations: (practicalEvals || []).map((pe: any) => ({
          id: pe.id,
          courseCode: pe.courses?.code || 'STCW',
          courseTitle: pe.courses?.name || 'STCW Course',
          percentage: Number(pe.percentage) || 0,
          competencyStatus: pe.competency_status || 'PENDING',
          feedback: pe.general_feedback || '',
          evaluatedAt: pe.evaluation_date,
        })),
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
  const auth = await verifyAdminRequestAsync(request, 'TRAINEE_UPDATE');

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

      const { data: pendingInvite } = await supabaseAdmin
        .from('invitations')
        .select('id')
        .eq('email', traineeProfile.email)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (traineeProfile.status?.toUpperCase() !== 'PENDING' && !pendingInvite) {
        return NextResponse.json({ success: false, error: 'Can only resend invitation for pending accounts.' }, { status: 400 });
      }

      const token = (await import('crypto')).randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const { error: inviteError } = await supabaseAdmin.from('invitations').insert({
        email: traineeProfile.email,
        role: 'TRAINEE',
        token_hash: token,
        status: 'PENDING',
        expires_at: expiresAt.toISOString(),
        invited_by: auth.user?.id,
      });

      if (inviteError) {
        return NextResponse.json(
          { success: false, error: `Failed to create confirmation invitation: ${inviteError.message}` },
          { status: 500 }
        );
      }

      const baseUrl = resolveSafeAppOrigin(request, 'http://localhost:3000');
      const confirmUrl = `${baseUrl}/api/auth/confirm?token=${token}`;

      const { sendInvitationEmail } = await import('@newsim/auth');
      const emailResult = await sendInvitationEmail(
        traineeProfile.email,
        `${traineeProfile.first_name} ${traineeProfile.last_name}`,
        traineeProfile.email,
        confirmUrl,
        'trainee'
      );

      if (!emailResult?.success) {
        return NextResponse.json(
          { success: false, error: emailResult?.error || 'Failed to send confirmation email. Please check SMTP configuration.' },
          { status: 502 }
        );
      }

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
  const auth = await verifyAdminRequestAsync(request, 'TRAINEE_DELETE');
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
