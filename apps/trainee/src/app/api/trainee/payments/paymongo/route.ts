import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
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
    const { enrollmentId, method = 'gcash' } = body;

    if (!enrollmentId) {
      return NextResponse.json({ success: false, error: 'Enrollment ID is required' }, { status: 400 });
    }

    // Load enrollment with course, batch, and package
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

    // Eligibility check: Prevent duplicate checkout on already settled enrollments
    const enrStatus = (enrollment.status || '').toUpperCase();
    if (['ENROLLED', 'ACTIVE', 'APPROVED', 'COMPLETED'].includes(enrStatus)) {
      return NextResponse.json({ success: false, error: 'This enrollment has already been confirmed and paid.' }, { status: 400 });
    }

    // Prevent duplicate payments
    const { data: priorPayment } = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle();

    if (priorPayment && (priorPayment.status === 'PAID' || priorPayment.status === 'VERIFIED')) {
      return NextResponse.json({ success: false, error: 'A verified payment already exists for this enrollment.' }, { status: 400 });
    }

    // Derive authoritative tuition strictly from verified package or course DB row (never use hardcoded fallbacks)
    const course = enrollment.courses;
    const pkg = enrollment.course_packages;
    const itemTitle = pkg?.name || course?.name || 'Maritime Training Tuition';
    const rawPrice = Number(pkg?.package_price ?? course?.price);
    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
      return NextResponse.json(
        { success: false, error: 'Course tuition pricing configuration is missing or invalid. Please contact the registrar.' },
        { status: 422 }
      );
    }
    const amountInCentavos = Math.round(rawPrice * 100);

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey || !secretKey.startsWith('sk_test_')) {
      return NextResponse.json(
        { success: false, error: 'Payment gateway is not configured for TEST MODE.' },
        { status: 503 }
      );
    }
    const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');

    const baseUrl = resolveSafeAppOrigin(req, 'http://localhost:3002');

    const selectedMethods = method === 'paymaya' || method === 'maya' ? ['paymaya'] : ['gcash'];

    // PayMongo Checkout Session Payload (TEST MODE)
    const paymongoPayload = {
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
              amount: amountInCentavos,
              currency: 'PHP',
              quantity: 1,
            },
          ],
          payment_method_types: selectedMethods,
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          description: `NEWSIM Maritime Training Course Tuition (TEST MODE) - ${enrollment.batches?.batch_code || 'Cohort'}`,
          success_url: `${baseUrl}/payments/success?enrollment_id=${enrollmentId}`,
          cancel_url: `${baseUrl}/payments/failed?enrollment_id=${enrollmentId}`,
          metadata: {
            enrollment_id: enrollmentId,
            trainee_id: traineeId,
            environment: 'TEST',
          },
        },
      },
    };

    const pmRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(paymongoPayload),
    });

    const pmData = await pmRes.json();

    if (!pmRes.ok || pmData.errors) {
      console.error('PayMongo Checkout Session error:', pmData.errors);
      const errMsg = pmData.errors?.[0]?.detail || 'Failed to initialize PayMongo checkout session';
      return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }

    const checkoutUrl = pmData.data?.attributes?.checkout_url;
    const checkoutSessionId = pmData.data?.id;

    // Check if a payment record already exists for this enrollment
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle();

    const paymentMethodUpper = (method === 'paymaya' || method === 'maya') ? 'MAYA' : 'GCASH';
    const referenceNumber = `PAY-${checkoutSessionId.slice(-8).toUpperCase()}`;

    if (existingPayment) {
      // Update existing pending record (never overwrite an already-settled payment)
      const { data: updated } = await supabaseAdmin
        .from('payments')
        .update({
          amount: rawPrice,
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
        .select('id')
        .maybeSingle();
      if (!updated) {
        return NextResponse.json({ success: false, error: 'A verified payment already exists for this enrollment.' }, { status: 400 });
      }
    } else {
      // Create new payment record
      await supabaseAdmin
        .from('payments')
        .insert({
          trainee_id: traineeId,
          enrollment_id: enrollmentId,
          amount: rawPrice,
          payment_method: paymentMethodUpper,
          reference_number: referenceNumber,
          paymongo_checkout_id: checkoutSessionId,
          paymongo_checkout_url: checkoutUrl,
          payment_environment: 'TEST',
          status: 'PENDING',
        });
    }

    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl,
        sessionId: checkoutSessionId,
        amount: rawPrice,
        currency: 'PHP',
        method: paymentMethodUpper,
      },
    });
  } catch (error: any) {
    console.error('Failed to create PayMongo checkout:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create PayMongo checkout session' },
      { status: 500 }
    );
  }
}
