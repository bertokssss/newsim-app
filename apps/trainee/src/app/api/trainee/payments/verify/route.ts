import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, dispatchNotificationEvent, NOTIFICATION_EVENTS, resolveRealSrn } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'PAYMENT_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId') || searchParams.get('session_id');
    const enrollmentId = searchParams.get('enrollmentId') || searchParams.get('enrollment_id');

    if (!sessionId && !enrollmentId) {
      return NextResponse.json({ success: false, error: 'Session ID or Enrollment ID is required' }, { status: 400 });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey || !secretKey.startsWith('sk_test_')) {
      return NextResponse.json(
        { success: false, error: 'Payment verification gateway is not configured for TEST MODE.' },
        { status: 503 }
      );
    }
    const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');

    // Find the payment record with full enrollment, batch, course, and package details
    let paymentQuery = supabaseAdmin.from('payments').select(`
      *,
      enrollments (
        id,
        course_id,
        batch_id,
        status,
        batches (id, batch_code, start_date, end_date),
        courses (id, code, name),
        course_packages (id, package_code, name)
      )
    `);
    // Enforce ownership: Trainees can only inspect their own payment and receipt records
    paymentQuery = paymentQuery.eq('trainee_id', traineeId);

    if (sessionId) {
      paymentQuery = paymentQuery.eq('paymongo_checkout_id', sessionId);
    } else if (enrollmentId) {
      paymentQuery = paymentQuery.eq('enrollment_id', enrollmentId);
    }

    const { data: payment, error: pErr } = await paymentQuery.maybeSingle();

    if (pErr || !payment) {
      return NextResponse.json({ success: false, error: 'Payment record not found' }, { status: 404 });
    }

    // Helper to build receipt object with trainee personal details and SRN
    const getReceiptData = async (payRecord: any) => {
      const [profileRes, traineeRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('first_name, last_name, email, phone').eq('id', traineeId).maybeSingle(),
        supabaseAdmin.from('trainees').select('trainee_number, srn, address, city, province, nationality').eq('profile_id', traineeId).maybeSingle(),
      ]);

      const course = payRecord.enrollments?.courses || {};
      const pkg = payRecord.enrollments?.course_packages || {};
      const batch = payRecord.enrollments?.batches || {};

      const traineeDetails = {
        fullName: `${profileRes.data?.first_name || ''} ${profileRes.data?.last_name || ''}`.trim() || 'Maritime Trainee',
        email: profileRes.data?.email || '',
        phone: profileRes.data?.phone || 'N/A',
        srn: resolveRealSrn(traineeRes.data) || 'SRN-PENDING',
        traineeNumber: traineeRes.data?.trainee_number || 'TRN-PENDING',
        address: [traineeRes.data?.address, traineeRes.data?.city, traineeRes.data?.province].filter(Boolean).join(', ') || 'N/A',
        nationality: traineeRes.data?.nationality || 'Filipino',
      };

      return {
        receiptNo: `REC-${payRecord.id.slice(0, 8).toUpperCase()}`,
        referenceNumber: payRecord.reference_number || `REF-${payRecord.id.slice(0, 8).toUpperCase()}`,
        paymongoCheckoutId: payRecord.paymongo_checkout_id,
        paymongoPaymentId: payRecord.paymongo_payment_id,
        amount: Number(payRecord.amount) || 0,
        paymentMethod: payRecord.payment_method || 'GCASH',
        environment: payRecord.payment_environment || 'TEST',
        status: payRecord.status,
        paidAt: payRecord.paid_at || payRecord.created_at,
        trainee: traineeDetails,
        course: {
          title: course.name || pkg.name || 'Maritime Training Program',
          code: course.code || 'STCW',
          batchCode: batch.batch_code || 'Cohort',
          startDate: batch.start_date || '',
          endDate: batch.end_date || '',
          centerName: 'NEWSIM Maritime Training Center',
        },
        notice: 'Your payment is on-going. Please wait for admin verification to proceed.',
      };
    };

    // If already verified/paid, return current status and receipt
    if (payment.status === 'PAID' || payment.status === 'VERIFIED') {
      const enrStatus = payment.enrollments?.status || 'PENDING_REVIEW';
      const receipt = await getReceiptData(payment);
      return NextResponse.json({
        success: true,
        isPaid: true,
        paymentStatus: 'PAID',
        enrollmentStatus: enrStatus,
        payment,
        receipt,
        notice: 'Your payment is on-going. Please wait for admin verification to proceed.',
      });
    }

    // Query PayMongo API for the checkout session status
    const targetSessionId = sessionId || payment.paymongo_checkout_id;
    if (!targetSessionId) {
      return NextResponse.json({ success: false, error: 'No PayMongo session ID found on payment record' }, { status: 400 });
    }

    const pmRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${targetSessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    const pmData = await pmRes.json();
    if (!pmRes.ok || !pmData.data) {
      console.warn('Could not retrieve PayMongo session:', pmData);
      return NextResponse.json({
        success: true,
        isPaid: false,
        paymentStatus: payment.status,
        enrollmentStatus: payment.enrollments?.status || 'PAYMENT_PENDING',
      });
    }

    const sessionAttrs = pmData.data.attributes || {};
    const paymentsList = Array.isArray(sessionAttrs.payments) ? sessionAttrs.payments : [];
    const expectedCentavos = Math.round(Number(payment.amount) * 100);
    const metaEnrollmentId = sessionAttrs.metadata?.enrollment_id;

    // Strict verification: TEST MODE only, matching enrollment metadata if present, exact centavo & PHP match
    const paidEntry = paymentsList.find((p: any) => {
      const attrs = p?.attributes || {};
      const statusOk = attrs.status === 'paid';
      const currencyOk = (attrs.currency || 'PHP').toUpperCase() === 'PHP';
      const amountOk = Number(attrs.amount) === expectedCentavos;
      return statusOk && currencyOk && amountOk;
    });

    const livemodeMismatch = sessionAttrs.livemode === true;
    const enrollmentMismatch = metaEnrollmentId && payment.enrollment_id && metaEnrollmentId !== payment.enrollment_id;

    if (!livemodeMismatch && !enrollmentMismatch && paidEntry && (sessionAttrs.status === 'paid' || paymentsList.length > 0)) {
      const primaryPayment = paidEntry;
      const paymongoPaymentId = primaryPayment.id || null;
      const methodUsed = (primaryPayment.attributes?.source?.type || sessionAttrs.payment_method_used || payment.payment_method || 'GCASH').toUpperCase();

      const now = new Date().toISOString();

      // 1. Atomic conditional update to PAID (prevents duplicate verify side effects)
      const { data: transitionedPayment } = await supabaseAdmin
        .from('payments')
        .update({
          status: 'PAID',
          paid_at: now,
          paymongo_payment_id: paymongoPaymentId,
          payment_method: methodUsed.includes('MAYA') ? 'MAYA' : 'GCASH',
          updated_at: now,
        })
        .eq('id', payment.id)
        .neq('status', 'PAID')
        .neq('status', 'VERIFIED')
        .select('id')
        .maybeSingle();

      if (!transitionedPayment) {
        const fresh = { ...payment, status: 'PAID' };
        const receipt = await getReceiptData(fresh);
        return NextResponse.json({
          success: true,
          isPaid: true,
          paymentStatus: 'PAID',
          enrollmentStatus: payment.enrollments?.status || 'PENDING_REVIEW',
          payment: fresh,
          receipt,
          notice: 'Your payment is on-going. Please wait for admin verification to proceed.',
        });
      }

      // 2. Advance enrollment only from initial pending-payment states to PENDING_REVIEW
      if (payment.enrollment_id) {
        await supabaseAdmin
          .from('enrollments')
          .update({
            status: 'PENDING_REVIEW',
            updated_at: now,
          })
          .eq('id', payment.enrollment_id)
          .in('status', ['PAYMENT_PENDING', 'PENDING']);
      }

      // 3. Dispatch PAYMENT_CONFIRMED Notification (Section 11 Recipient Matrix)
      try {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.PAYMENT_CONFIRMED,
          traineeId,
          courseId: payment.enrollments?.course_id,
          batchId: payment.enrollments?.batch_id,
          entityType: 'PAYMENT',
          entityId: payment.id,
          metadata: {
            amount: payment.amount,
            method: methodUsed,
            courseName: payment.enrollments?.courses?.name,
            batchName: payment.enrollments?.batches?.batch_code,
          },
        });
      } catch (notifErr) {
        console.warn('Payment confirmed notification dispatch notice:', notifErr);
      }

      // 5. Audit Log
      try {
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: traineeId,
          action: 'PAYMENT_VERIFIED',
          entity_type: 'PAYMENT',
          entity_id: payment.id,
          new_values: {
            amount: payment.amount,
            method: methodUsed,
            paymongoSessionId: targetSessionId,
            environment: 'TEST',
          },
        });
      } catch (auditErr) {
        console.warn('Could not write audit log:', auditErr);
      }

      const freshPaymentRecord = {
        ...payment,
        status: 'PAID',
        paid_at: now,
        paymongo_payment_id: paymongoPaymentId,
        payment_method: methodUsed.includes('MAYA') ? 'MAYA' : 'GCASH',
      };
      const receipt = await getReceiptData(freshPaymentRecord);

      return NextResponse.json({
        success: true,
        isPaid: true,
        paymentStatus: 'PAID',
        enrollmentStatus: 'PENDING_REVIEW',
        message: 'Payment verified! Enrollment is now pending admin review.',
        payment: freshPaymentRecord,
        receipt,
        notice: 'Your payment is on-going. Please wait for admin verification to proceed.',
      });
    }

    return NextResponse.json({
      success: true,
      isPaid: false,
      paymentStatus: payment.status,
      enrollmentStatus: payment.enrollments?.status || 'PAYMENT_PENDING',
      message: 'Payment is still processing or has not been completed on PayMongo.',
    });
  } catch (error: any) {
    console.error('Failed to verify PayMongo payment:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to verify payment' }, { status: 500 });
  }
}
