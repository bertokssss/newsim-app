import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, dispatchNotificationEvent, NOTIFICATION_EVENTS, resolveTraineeProfileId } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'CERTIFICATE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;
    const resolvedId = await resolveTraineeProfileId(traineeId);

    const body = await req.json();
    const { certificateId } = body;

    if (!certificateId) {
      return NextResponse.json({ success: false, error: 'Certificate ID is required' }, { status: 400 });
    }

    // 1. Fetch certificate and verify ownership (Part 2.3)
    const traineeIds = Array.from(new Set([resolvedId, traineeId].filter(Boolean)));
    const { data: cert, error: certErr } = await supabaseAdmin
      .from('certificates')
      .select('*, courses (id, code, name)')
      .eq('id', certificateId)
      .in('trainee_id', traineeIds)
      .maybeSingle();

    if (certErr || !cert) {
      return NextResponse.json({ success: false, error: 'Certificate record not found or access denied.' }, { status: 404 });
    }

    // 2. Verify validity and status
    const statusUpper = (cert.status || '').toUpperCase();
    if (statusUpper === 'REVOKED') {
      return NextResponse.json({ success: false, error: 'This certificate has been revoked and cannot be claimed.' }, { status: 403 });
    }
    if (cert.claimed_at || statusUpper === 'CLAIMED') {
      return NextResponse.json({
        success: false,
        error: `This certificate has already been claimed on ${new Date(cert.claimed_at || cert.updated_at).toLocaleDateString()}. Duplicate claims are prohibited.`,
        alreadyClaimed: true,
        claimedAt: cert.claimed_at,
      }, { status: 400 });
    }
    if (!['ACTIVE', 'ISSUED'].includes(statusUpper)) {
      return NextResponse.json({
        success: false,
        error: `Certificate is currently ${statusUpper || 'PENDING'} and has not yet been approved/issued for release.`,
      }, { status: 403 });
    }

    // Verify Course Grading & Practical Assessment Policy Passing Requirements
    const { calculateTraineeCourseGrade } = await import('@newsim/database');
    const grade = await calculateTraineeCourseGrade({ traineeId: resolvedId, courseId: cert.course_id });

    if (!grade.passed || grade.finalStatus !== 'PASSED') {
      return NextResponse.json({
        success: false,
        error: `Certificate release withheld. Candidate has not met STCW passing requirements (${grade.mandatoryRemarks.join('; ') || 'Practical assessment or attendance quorum not satisfied'}).`,
        finalStatus: grade.finalStatus,
        mandatoryRemarks: grade.mandatoryRemarks,
      }, { status: 403 });
    }

    // 3. Enforce Scheduled Claim Date (Part 2.3)
    if (cert.scheduled_claim_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduledDate = new Date(cert.scheduled_claim_date);
      scheduledDate.setHours(0, 0, 0, 0);

      if (today < scheduledDate) {
        return NextResponse.json({
          success: false,
          error: `Certificate is scheduled for release on ${cert.scheduled_claim_date}. It is not yet available for claiming.`,
          scheduledClaimDate: cert.scheduled_claim_date,
        }, { status: 400 });
      }
    }

    // 4. Record Claim atomically to prevent double-claim races
    const now = new Date().toISOString();
    const { data: updatedCert, error: updErr } = await supabaseAdmin
      .from('certificates')
      .update({
        status: 'CLAIMED',
        claimed_at: now,
        updated_at: now,
      })
      .eq('id', cert.id)
      .in('trainee_id', traineeIds)
      .in('status', ['ACTIVE', 'ISSUED'])
      .is('claimed_at', null)
      .select()
      .maybeSingle();

    if (updErr) throw updErr;
    if (!updatedCert) {
      return NextResponse.json({
        success: false,
        error: 'Certificate has already been claimed or is no longer eligible.',
        alreadyClaimed: true,
      }, { status: 409 });
    }

    // 5. Audit Log (Part 2.3)
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: traineeId,
        action: 'CERTIFICATE_CLAIMED',
        entity_type: 'CERTIFICATE',
        entity_id: cert.id,
        new_values: {
          claimed_at: now,
          certificate_number: cert.certificate_number,
          course: cert.courses?.name,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Certificate successfully claimed and recorded.',
      data: {
        id: updatedCert.id,
        certificateNo: updatedCert.certificate_number,
        claimedAt: now,
        status: 'CLAIMED',
      },
    });
  } catch (error: any) {
    console.error('Failed to claim certificate:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to claim certificate' }, { status: 500 });
  }
}
