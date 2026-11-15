import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, remarks } = body;

    const existing = db.getPaymentById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    const updated = db.updatePayment(id, {
      status,
      verifiedBy: 'admin@newsim.com',
      verifiedAt: new Date().toISOString(),
    });

    // If payment verified, update enrollment payment status
    if (status === 'VERIFIED' && existing.enrollmentId) {
      db.updateEnrollment(existing.enrollmentId, {
        paymentStatus: 'VERIFIED',
        status: 'ENROLLED',
      });
    }

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: status === 'VERIFIED' ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
      targetType: 'PAYMENT',
      targetId: id,
      details: { paymentNo: existing.paymentNo, amount: existing.amount, status, remarks },
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update payment' }, { status: 500 });
  }
}
