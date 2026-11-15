import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, dispatchNotificationEvent, NOTIFICATION_EVENTS } from '@newsim/database';
import {
  CERTIFICATE_SELECT,
  formatCertificate,
  isAdminContext,
  matchesSearch,
  requestMeta,
  requireAdmin,
  toDbCertificateStatus,
  unwrap,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'CERTIFICATE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    const { data, error } = await supabaseAdmin
      .from('certificates')
      .select(CERTIFICATE_SELECT)
      .order('issued_at', { ascending: false });
    if (error) throw error;

    let certificates = (data || [])
      .filter((row: any) => {
        if (!ctx.centerId) return true;
        const course = unwrap(row.courses);
        return !course?.training_center_id || course.training_center_id === ctx.centerId;
      })
      .map(formatCertificate);

    if (search) {
      certificates = certificates.filter((c: any) =>
        matchesSearch([c.certificateNo, c.traineeName, c.courseTitle, c.qrVerificationCode], search)
      );
    }
    if (status !== 'ALL') {
      certificates = certificates.filter((c: any) => c.status === status.toUpperCase());
    }

    return NextResponse.json({ success: true, data: certificates });
  } catch (error) {
    console.error('Failed to load certificates:', error);
    return NextResponse.json({ success: false, error: 'Failed to load certificates' }, { status: 500 });
  }
}

import { evaluateCertificateEligibility } from './eligibility/route';

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'CERTIFICATE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { traineeId, courseId } = body;
    const { ip, userAgent } = requestMeta(request);

    if (!traineeId || !courseId) {
      return NextResponse.json(
        { success: false, error: 'Trainee and Course are required' },
        { status: 400 }
      );
    }

    const { data: course, error: courseErr } = await supabaseAdmin
      .from('courses')
      .select('id, training_center_id')
      .eq('id', courseId)
      .maybeSingle();
    if (courseErr) throw courseErr;
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }
    if (ctx.centerId && course.training_center_id !== ctx.centerId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Course belongs to another training center' },
        { status: 403 }
      );
    }

    // Prevent duplicate certificates for same trainee and course (Part 2.2)
    const { data: existingCert } = await supabaseAdmin
      .from('certificates')
      .select('id, certificate_number, status')
      .eq('trainee_id', traineeId)
      .eq('course_id', courseId)
      .in('status', ['ACTIVE', 'ISSUED', 'APPROVED', 'SCHEDULED_FOR_CLAIM', 'READY_FOR_CLAIM', 'CLAIMED'])
      .maybeSingle();

    if (existingCert) {
      return NextResponse.json(
        {
          success: false,
          error: `Certificate already exists for this trainee and course (${existingCert.certificate_number}). Duplicate issuance prevented.`,
          existingCertificateNumber: existingCert.certificate_number,
        },
        { status: 409 }
      );
    }

    // Evaluate eligibility criteria (STCW strict enforcement)
    const eligibility = await evaluateCertificateEligibility(traineeId, courseId);
    if (!eligibility.isEligible) {
      const failed = eligibility.checks.filter((c) => !c.passed);
      try {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.CERTIFICATION_REQUIREMENT_MISSING,
          traineeId,
          courseId,
          entityType: 'CERTIFICATE',
          metadata: {
            reason: failed.map((f) => f.name).join(', '),
          },
        });
      } catch {}

      return NextResponse.json(
        {
          success: false,
          error: `Trainee is not eligible for certificate issuance. Failed criteria: ${failed.map((f) => f.name).join(', ')}.`,
          checks: eligibility.checks,
        },
        { status: 400 }
      );
    }

    const issuedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 5);
    const certNo = `NEWSIM-CERT-${issuedAt.getFullYear()}-${crypto.randomInt(100000, 1000000)}`;

    const { data, error } = await supabaseAdmin
      .from('certificates')
      .insert({
        trainee_id: traineeId,
        course_id: courseId,
        enrollment_id: eligibility.enrollmentId || null,
        certificate_number: certNo,
        issued_at: issuedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: toDbCertificateStatus('ISSUED'),
        issued_by: ctx.user.id,
      })
      .select(CERTIFICATE_SELECT)
      .single();

    if (error) throw error;

    // Dispatch CERTIFICATION_APPROVED (Section 11 Recipient Matrix)
    try {
      await dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.CERTIFICATION_APPROVED,
        traineeId,
        courseId,
        entityType: 'CERTIFICATE',
        entityId: data.id,
        metadata: {
          certNumber: certNo,
        },
      });
    } catch (notifErr) {
      console.warn('Certificate issuance notification dispatch notice:', notifErr);
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'CERTIFICATE_ISSUED',
      entityType: 'CERTIFICATE',
      entityId: data.id,
      details: { certificateNo: certNo, traineeId, courseId, checks: eligibility.checks },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, certificate: formatCertificate(data) });
  } catch (error) {
    console.error('Failed to issue certificate:', error);
    return NextResponse.json({ success: false, error: 'Failed to issue certificate' }, { status: 500 });
  }
}
