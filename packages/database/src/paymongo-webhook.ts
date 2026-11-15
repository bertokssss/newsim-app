import crypto from 'crypto';
import { supabaseAdmin } from './supabase';
import { createNotificationRecord, getFinancialAdminRecipientIds } from './queries/notifications';

export function verifyPaymongoSignature(
  signatureHeader: string | null,
  rawBody: string,
  secret: string,
  maxSkewSeconds = 300
): boolean {
  if (!signatureHeader || !secret) return false;

  try {
    const parts = signatureHeader.split(',').map((p) => p.trim());
    let timestamp = '';
    let testSig = '';
    let liveSig = '';

    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k === 't') timestamp = v;
      else if (k === 'te') testSig = v;
      else if (k === 'li') liveSig = v;
    }

    if (!timestamp) return false;
    const tsSeconds = Number(timestamp);
    if (!Number.isFinite(tsSeconds)) return false;
    if (maxSkewSeconds > 0 && Math.abs(Math.floor(Date.now() / 1000) - tsSeconds) > maxSkewSeconds) {
      return false;
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY || '';
    const isLiveKey = secretKey.startsWith('sk_live_');
    const signatureToMatch = isLiveKey ? liveSig || testSig : testSig || liveSig;
    if (!signatureToMatch || !/^[0-9a-f]+$/i.test(signatureToMatch)) return false;

    const computed = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(signatureToMatch, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;

    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    console.error('[PayMongo Webhook] Signature verification failed:', err);
    return false;
  }
}

export async function handlePaymongoWebhookRequest(
  rawBody: string,
  signatureHeader: string | null
): Promise<{ status: number; body: Record<string, unknown> }> {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (webhookSecret) {
    const isValid = verifyPaymongoSignature(signatureHeader, rawBody, webhookSecret);
    if (!isValid) {
      console.warn('[PayMongo Webhook] Invalid signature rejected');
      return { status: 401, body: { error: 'Invalid webhook signature' } };
    }
  } else if (process.env.NODE_ENV === 'development' && process.env.ALLOW_UNSIGNED_TEST_WEBHOOKS === 'true') {
    console.warn('[PayMongo Webhook] ALLOW_UNSIGNED_TEST_WEBHOOKS active in local dev.');
  } else {
    console.error('[PayMongo Webhook] PAYMONGO_WEBHOOK_SECRET is not configured.');
    return { status: 503, body: { error: 'Webhook signature verification is not configured' } };
  }

  let event: any = null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'Invalid JSON payload' } };
  }

  const eventType = String(event?.data?.attributes?.type || '');
  const eventLivemode = event?.data?.attributes?.livemode === true;
  const isLiveKey = String(process.env.PAYMONGO_SECRET_KEY || '').startsWith('sk_live_');
  if (eventLivemode && !isLiveKey) {
    return { status: 400, body: { error: 'Live webhook event rejected in PayMongo TEST mode' } };
  }

  const resource = event?.data?.attributes?.data;
  const resourceId = resource?.id;
  const attributes = resource?.attributes || {};
  const now = new Date().toISOString();

  // Locate matching local payment record
  const metadata = attributes.metadata || {};
  const paymentsList = Array.isArray(attributes.payments) ? attributes.payments : [];
  const primaryPayment = paymentsList[0] || {};
  const paymentAttrs = resource?.type === 'payment' ? attributes : primaryPayment.attributes || {};
  const checkoutId =
    resource?.type === 'checkout_session'
      ? resourceId
      : attributes.checkout_session_id || metadata.checkout_session_id || null;
  const enrollmentId = metadata.enrollment_id || null;
  const paymentRecordIdMeta = metadata.payment_id || null;

  let paymentRecord: any = null;
  if (paymentRecordIdMeta) {
    const { data } = await supabaseAdmin.from('payments').select('*').eq('id', paymentRecordIdMeta).maybeSingle();
    if (data) paymentRecord = data;
  }
  if (!paymentRecord && checkoutId) {
    const { data } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('paymongo_checkout_id', checkoutId)
      .maybeSingle();
    if (data) paymentRecord = data;
  }
  if (!paymentRecord && enrollmentId) {
    const { data } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) paymentRecord = data;
  }

  if (!paymentRecord) {
    return { status: 200, body: { received: true, ignored: 'No matching payment record' } };
  }

  // Handle failed or expired checkout/payment events
  if (
    eventType === 'payment.failed' ||
    eventType === 'checkout_session.payment.failed' ||
    eventType === 'checkout_session.expired'
  ) {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'FAILED', updated_at: now })
      .eq('id', paymentRecord.id)
      .in('status', ['PENDING', 'PROCESSING']);

    return { status: 200, body: { received: true, status: 'FAILED' } };
  }

  // Handle paid events
  if (eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid') {
    const currentStatus = String(paymentRecord.status || '').toUpperCase();
    if (currentStatus === 'PAID' || currentStatus === 'VERIFIED') {
      return { status: 200, body: { received: true, idempotent: true } };
    }

    const paidAmountCents = Number(paymentAttrs?.amount);
    const expectedAmountCents = Math.round(Number(paymentRecord.amount || 0) * 100);
    const currency = String(paymentAttrs?.currency || 'PHP').toUpperCase();

    if (
      currency !== 'PHP' ||
      !Number.isFinite(paidAmountCents) ||
      paidAmountCents <= 0 ||
      expectedAmountCents <= 0 ||
      paidAmountCents !== expectedAmountCents
    ) {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'FAILED', updated_at: now })
        .eq('id', paymentRecord.id)
        .in('status', ['PENDING', 'PROCESSING']);
      return { status: 400, body: { error: 'Payment amount or currency mismatch' } };
    }

    const rawMethod =
      paymentAttrs?.source?.type ||
      (Array.isArray(attributes.payment_method_types) ? attributes.payment_method_types[0] : '') ||
      'PAYMONGO';
    let method = String(rawMethod).toUpperCase();
    if (method === 'PAYMAYA') method = 'MAYA';
    if (method === 'QRPH') method = 'QR_PH';
    if (!['GCASH', 'MAYA', 'PAYMONGO', 'QR_PH', 'BANK_TRANSFER', 'CARD', 'OTHER'].includes(method)) {
      method = 'PAYMONGO';
    }

    const paymentId = primaryPayment?.id || (resource?.type === 'payment' ? resourceId : null);

    // Conditional update prevents race conditions with concurrent webhook / verify calls
    const { data: updatedPayment } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'PAID',
        paid_at: now,
        payment_method: method,
        paymongo_payment_id: paymentId,
        payment_environment: isLiveKey ? 'LIVE' : 'TEST',
        updated_at: now,
      })
      .eq('id', paymentRecord.id)
      .in('status', ['PENDING', 'PROCESSING'])
      .select('id')
      .maybeSingle();

    if (!updatedPayment) {
      return { status: 200, body: { received: true, idempotent: true } };
    }

    const targetEnrollmentId = enrollmentId || paymentRecord.enrollment_id;
    if (targetEnrollmentId) {
      await supabaseAdmin
        .from('enrollments')
        .update({ status: 'PENDING_REVIEW', updated_at: now })
        .eq('id', targetEnrollmentId)
        .in('status', ['PAYMENT_PENDING', 'PENDING']);
    }

    // Notify only financial-authorized ADMINs (never SUPER_ADMIN, IT_SUPPORT, or non-billing Ops Admins)
    try {
      const financialAdminIds = await getFinancialAdminRecipientIds();
      if (financialAdminIds.length > 0) {
        await Promise.allSettled(
          financialAdminIds.map((adminId) =>
            createNotificationRecord({
              recipient_id: adminId,
              title: 'New Paid Enrollment Awaiting Review',
              message: `Payment of ₱${Number(paymentRecord.amount).toLocaleString()} via ${method} confirmed. Enrollment is ready for verification and approval.`,
              type: 'PAYMENT_CONFIRMED',
              category: 'PAYMENT',
              priority: 'MEDIUM',
              entity_type: 'PAYMENT',
              entity_id: paymentRecord.id,
              action_url: '/admin/payments',
            })
          )
        );
      }
    } catch (adminNotifErr) {
      console.warn('Webhook: Admin notification failed:', adminNotifErr);
    }

    // Notify Trainee
    const recipientTraineeId = metadata.trainee_id || paymentRecord.trainee_id;
    if (recipientTraineeId) {
      try {
        await createNotificationRecord({
          recipient_id: recipientTraineeId,
          title: 'Tuition Payment Confirmed',
          message: `Your payment of ₱${Number(paymentRecord.amount).toLocaleString()} via ${method} has been received. Your enrollment is now pending registrar review.`,
          type: 'PAYMENT_CONFIRMED',
          category: 'PAYMENT',
          priority: 'MEDIUM',
          entity_type: 'PAYMENT',
          entity_id: paymentRecord.id,
          action_url: '/payments',
        });
      } catch (tNotifErr) {
        console.warn('Webhook: Trainee notification failed:', tNotifErr);
      }
    }

    // Audit Log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: recipientTraineeId || null,
        action: 'PAYMENT_SETTLED_WEBHOOK',
        entity_type: 'PAYMENT',
        entity_id: paymentRecord.id,
        new_values: {
          checkoutId,
          paymentId,
          method,
          amount: Number(paymentRecord.amount),
          environment: isLiveKey ? 'LIVE' : 'TEST',
        },
      });
    } catch (auditErr) {
      console.warn('Webhook: Audit log failed:', auditErr);
    }
  }

  return { status: 200, body: { received: true } };
}
