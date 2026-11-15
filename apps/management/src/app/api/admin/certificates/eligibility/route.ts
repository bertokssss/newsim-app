import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, calculateTraineeCourseGrade } from '@newsim/database';
import { isAdminContext, requireAdmin } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export interface EligibilityCheckResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
}

export async function evaluateCertificateEligibility(
  traineeId: string,
  courseId: string,
  enrollmentId?: string | null
) {
  const checks: EligibilityCheckResult[] = [];

  // 1. Enrollment status check
  let enrQuery = supabaseAdmin
    .from('enrollments')
    .select('id, status, enrolled_at, completed_at')
    .eq('trainee_id', traineeId)
    .eq('course_id', courseId);

  if (enrollmentId) {
    enrQuery = enrQuery.eq('id', enrollmentId);
  }

  const { data: enrollments } = await enrQuery.order('created_at', { ascending: false }).limit(1);
  const enrollment = enrollments?.[0];

  const enrStatus = (enrollment?.status || '').toUpperCase();
  const enrollmentExists = !!enrollment;
  const isEnrolledOrApproved = ['APPROVED', 'ENROLLED', 'COMPLETED', 'ACTIVE'].includes(enrStatus);
  const isCompleted = enrStatus === 'COMPLETED';

  checks.push({
    id: 'ENROLLMENT_VALID',
    name: 'Official Enrollment Status',
    passed: enrollmentExists && isEnrolledOrApproved,
    message: enrollmentExists
      ? `Enrollment record verified (${enrStatus || 'PENDING'}).`
      : 'No active enrollment found for this trainee in this course.',
  });

  checks.push({
    id: 'TRAINING_COMPLETED',
    name: 'Training & Syllabus Completion',
    passed: isCompleted,
    message: isCompleted
      ? 'Course syllabus marked as completed.'
      : `Course status is currently ${enrStatus || 'INCOMPLETE'}. Requires completion mark.`,
  });

  // 2. Payment Settlement Check (strictly scoped to this enrollment!)
  let paymentSettled = false;
  let coursePayments: any[] = [];
  if (enrollment?.id) {
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('id, enrollment_id, amount, status, payment_method, reference_number')
      .eq('trainee_id', traineeId)
      .eq('enrollment_id', enrollment.id);

    coursePayments = (payments || []).filter((p: any) =>
      ['VERIFIED', 'PAID'].includes((p.status || '').toUpperCase())
    );
    paymentSettled = coursePayments.length > 0;
  }

  checks.push({
    id: 'PAYMENT_SETTLED',
    name: 'Tuition Payment Settlement',
    passed: paymentSettled,
    message: paymentSettled
      ? `Payment verified via ${coursePayments[0].payment_method || 'Official Receipt'} (Ref: ${coursePayments[0].reference_number || 'OK'}).`
      : 'Payment status is PENDING or unpaid. Settlement required before issuance.',
  });

  // 3. Attendance Threshold & Course Competency Grading Check (Connected to Grading Engine)
  let gradeBreakdown: any = null;
  try {
    gradeBreakdown = await calculateTraineeCourseGrade({ traineeId, courseId });
  } catch (gradeErr) {
    console.warn('Certificate eligibility grade calculation notice:', gradeErr);
  }

  const attDetails = gradeBreakdown?.attendanceComponent?.details;
  const totalSessions = attDetails?.totalSessions ?? 0;
  const presentSessions = (attDetails?.presentSessions ?? 0) + (attDetails?.lateSessions ?? 0) + (attDetails?.excusedSessions ?? 0);
  const attendanceRate = attDetails?.attendancePercentage ?? (gradeBreakdown?.attendanceComponent?.score ?? 100);
  const minRequiredPct = attDetails?.requiredMinimumPct ?? 80;
  const attendancePassed = totalSessions === 0 ? true : attendanceRate >= minRequiredPct;

  checks.push({
    id: 'ATTENDANCE_THRESHOLD',
    name: `Classroom & Simulator Quorum (Min ${minRequiredPct}%)`,
    passed: attendancePassed,
    message:
      totalSessions > 0
        ? `Attendance rate is ${attendanceRate}% (${presentSessions}/${totalSessions} sessions credited; STCW min ${minRequiredPct}%).`
        : 'Session quorum satisfied (No attendance infractions reported).',
  });

  // 4. Practical Competency Requirement (Part 1.2 & Part 2.1 - 100% Required for STCW courses; Not Required for In-House Full Modular courses)
  const isFullModular = gradeBreakdown?.requiresPractical === false || Boolean(gradeBreakdown?.practicalComponent?.details?.isFullModular);
  const practicalMet = isFullModular || Boolean(
    gradeBreakdown?.practicalComponent?.details?.allCompetenciesCompleted ||
    gradeBreakdown?.practicalComponent?.status === 'COMPLETED'
  );

  checks.push({
    id: 'PRACTICAL_COMPETENCY',
    name: isFullModular
      ? 'Practical Maritime Competencies (Not Required — Full Modular Course)'
      : 'Practical Maritime Competencies (100% Required)',
    passed: practicalMet,
    message: isFullModular
      ? 'In-House Full Modular Course: 100% modular written curriculum (no practical assessment required).'
      : (practicalMet
          ? 'All required practical maritime competencies successfully demonstrated and certified.'
          : 'Practical exercises incomplete or pending retake. Candidate must demonstrate all required practical competencies.'),
  });

  // 5. Written Assessment Requirement (Part 1.3 & Part 2.1 - Min 70% Required)
  const writtenMet = Boolean(
    gradeBreakdown?.moduleComponent?.details?.allWrittenPassed &&
    (gradeBreakdown?.moduleComponent?.score ?? 0) >= 70
  );

  checks.push({
    id: 'WRITTEN_ASSESSMENT',
    name: 'Written Examination (Min 70% Required)',
    passed: writtenMet,
    message: writtenMet
      ? `Written examination passed (${gradeBreakdown?.moduleComponent?.score}% meets minimum 70% threshold).`
      : `Written examination score (${gradeBreakdown?.moduleComponent?.score ?? 0}%) is below mandatory 70% threshold.`,
  });

  // 6. Overall Weighted Grade Threshold (Part 1.1 & Part 2.1 - Min 70% Required)
  const finalGradeMet = Boolean(
    gradeBreakdown?.passed &&
    (gradeBreakdown?.overallScore ?? 0) >= (gradeBreakdown?.passingGrade ?? 70)
  );

  checks.push({
    id: 'FINAL_GRADE',
    name: `Final Course Grade (Min ${gradeBreakdown?.passingGrade ?? 70}%)`,
    passed: finalGradeMet,
    message: finalGradeMet
      ? `Overall final grade of ${gradeBreakdown?.overallScore}% satisfies certification standards.`
      : `Overall score (${gradeBreakdown?.overallScore ?? 'In Progress'}%) does not meet passing requirements.`,
  });

    const isEligible = checks.every((c) => c.passed);

  return {
    isEligible,
    enrollmentId: enrollment?.id || null,
    checks,
  };
}

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'CERTIFICATE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const traineeId = searchParams.get('traineeId');
    const courseId = searchParams.get('courseId');
    const enrollmentId = searchParams.get('enrollmentId');

    if (!traineeId || !courseId) {
      return NextResponse.json(
        { success: false, error: 'Both traineeId and courseId are required' },
        { status: 400 }
      );
    }

    if (ctx.centerId) {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('id, training_center_id')
        .eq('id', courseId)
        .maybeSingle();
      if (!course) {
        return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
      }
      if (course.training_center_id !== ctx.centerId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Course belongs to another training center' },
          { status: 403 }
        );
      }
    }

    const result = await evaluateCertificateEligibility(traineeId, courseId, enrollmentId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to evaluate certificate eligibility:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate certificate eligibility' },
      { status: 500 }
    );
  }
}
