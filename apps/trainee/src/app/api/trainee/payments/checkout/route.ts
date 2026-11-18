import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, dispatchNotificationEvent, NOTIFICATION_EVENTS } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse, resolveSafeAppOrigin } from '@newsim/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'PAYMENT_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const body = await req.json();
    const { enrollmentId, method = 'GCASH' } = body;

    if (!enrollmentId) {
      return NextResponse.json({ success: false, error: 'Enrollment ID is required' }, { status: 400 });
    }

    // Load enrollment
    const { data: enrollment, error: enrError } = await supabaseAdmin
      .from('enrollments')
      .select(`
        *,
        courses (id, code, name, price),
        course_packages (id, package_code, name, package_price),
        batches (id, batch_code, start_date)
      `)
      .eq('id', enrollmentId)
      .eq('trainee_id', traineeId)
      .single();

    if (enrError || !enrollment) {
      return NextResponse.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
    }

    // Eligibility check: Prevent duplicate checkout on confirmed enrollments
    const enrStatus = (enrollment.status || '').toUpperCase();
    if (['ENROLLED', 'ACTIVE', 'APPROVED', 'COMPLETED'].includes(enrStatus)) {
      return NextResponse.json({ success: false, error: 'This enrollment has already been confirmed and paid.' }, { status: 400 });
    }

    // Payment method whitelist validation
    const rawMethod = String(method || '').toUpperCase();
    if (!['GCASH', 'MAYA', 'PAYMAYA'].includes(rawMethod)) {
      return NextResponse.json({ success: false, error: 'Unsupported payment method. Please select GCash or Maya.' }, { status: 400 });
    }

    const course = enrollment.courses;
    const pkg = enrollment.course_packages;
    // Price Tampering Prevention: Never accept amount from client request body.
    // Derive price strictly from verified database package or course records.
    // Do NOT use hardcoded fallbacks; reject if authoritative pricing is missing.
    const rawPrice = pkg?.package_price ?? course?.price;
    const finalAmount = Number(rawPrice);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      console.error(`[Checkout Security] Authoritative price missing or invalid for enrollment ${enrollmentId}: course=${course?.id}, pkg=${pkg?.id}`);
      return NextResponse.json(
        { success: false, error: 'Course tuition pricing configuration is missing or invalid. Please contact the registrar.' },
        { status: 422 }
      );
    }
    const itemTitle = pkg?.name || course?.name || 'Maritime Training Program';

    // Prevent duplicate payments: verify existing payment state
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id, status, paymongo_checkout_url, paymongo_checkout_id, reference_number')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle();

    if (existingPayment && (existingPayment.status === 'PAID' || existingPayment.status === 'VERIFIED')) {
      return NextResponse.json({ success: false, error: 'A verified payment already exists for this enrollment.' }, { status: 400 });
    }

    // Call PayMongo API (strict TEST MODE configuration from env — never hardcode secrets)
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey || !secretKey.startsWith('sk_test_')) {
      return NextResponse.json(
        { success: false, error: 'Payment gateway is not configured for TEST MODE.' },
        { status: 503 }
      );
    }
    const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
    const baseUrl = resolveSafeAppOrigin(req, 'http://localhost:3002');

    const normalizedMethod = String(method).toLowerCase().includes('maya') ? 'paymaya' : 'gcash';

    const pmRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              name: `${auth.user.firstName || 'Trainee'} ${auth.user.lastName || 'Seafarer'}`.trim(),
              email: auth.user.email || 'trainee@newsim.ph',
              phone: '09171234567',
            },
            line_items: [
              {
                name: `${itemTitle} (${enrollment.batches?.batch_code || 'Cohort'})`,
                amount: Math.round(finalAmount * 100),
                currency: 'PHP',
                quantity: 1,
              },
            ],
            payment_method_types: [normalizedMethod],
            description: `NEWSIM Maritime Training Tuition (TEST MODE) - ${enrollment.batches?.batch_code || 'Cohort'}`,
            success_url: `${baseUrl}/payments/success?enrollment_id=${enrollmentId}`,
            cancel_url: `${baseUrl}/payments/failed?enrollment_id=${enrollmentId}`,
            metadata: {
              enrollment_id: enrollmentId,
              trainee_id: traineeId,
              environment: 'TEST',
            },
          },
        },
      }),
    });

    const pmJson = await pmRes.json();
    if (!pmRes.ok || pmJson.errors) {
      console.error('PayMongo checkout error:', pmJson);
      return NextResponse.json({ success: false, error: pmJson.errors?.[0]?.detail || 'Payment gateway initialization failed' }, { status: 500 });
    }

    const checkoutUrl = pmJson.data?.attributes?.checkout_url;
    const checkoutSessionId = pmJson.data?.id;
    const refNumber = `PAY-${checkoutSessionId.slice(-8).toUpperCase()}`;

    // Upsert payment record
    const paymentMethodUpper = normalizedMethod === 'paymaya' ? 'MAYA' : 'GCASH';

    let paymentRecord: any = null;
    if (existingPayment) {
      const { data: updated } = await supabaseAdmin
        .from('payments')
        .update({
          amount: finalAmount,
          payment_method: paymentMethodUpper,
          paymongo_checkout_id: checkoutSessionId,
          paymongo_checkout_url: checkoutUrl,
          payment_environment: 'TEST',
          status: 'PENDING',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPayment.id)
        .neq('status', 'PAID')
        .neq('status', 'VERIFIED')
        .select()
        .maybeSingle();
      if (!updated) {
        return NextResponse.json({ success: false, error: 'A verified payment already exists for this enrollment.' }, { status: 400 });
      }
      paymentRecord = updated;
    } else {
      const { data: inserted } = await supabaseAdmin
        .from('payments')
        .insert({
          trainee_id: traineeId,
          enrollment_id: enrollmentId,
          amount: finalAmount,
          payment_method: paymentMethodUpper,
          reference_number: refNumber,
          paymongo_checkout_id: checkoutSessionId,
          paymongo_checkout_url: checkoutUrl,
          payment_environment: 'TEST',
          status: 'PENDING',
        })
        .select()
        .single();
      paymentRecord = inserted;
    }

    try {
      await dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.PAYMENT_SUBMITTED,
        traineeId,
        courseId: enrollment.course_id,
        batchId: enrollment.batch_id,
        entityType: 'PAYMENT',
        entityId: paymentRecord?.id,
        metadata: {
          amount: finalAmount,
          method: paymentMethodUpper,
          courseName: itemTitle,
          batchName: enrollment.batches?.batch_code,
        },
      });
    } catch (notifErr) {
      console.warn('Payment submitted notification notice:', notifErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: paymentRecord?.id,
        referenceNumber: refNumber,
        checkoutUrl,
        sessionId: checkoutSessionId,
        amount: finalAmount,
        method: paymentMethodUpper,
        status: 'PENDING',
        environment: 'TEST',
      },
    });
  } catch (error: any) {
    console.error('Failed to create payment checkout in Supabase:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create payment checkout' }, { status: 500 });
  }
}
