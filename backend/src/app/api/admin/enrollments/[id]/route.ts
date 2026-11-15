import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const enrollment = db.getEnrollmentById(id);
    if (!enrollment) {
      return NextResponse.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: enrollment });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, paymentStatus } = body;

    const updated = db.updateEnrollment(id, {
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
    }

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'ENROLLMENT_STATUS_CHANGED',
      targetType: 'ENROLLMENT',
      targetId: id,
      details: { newStatus: status, newPaymentStatus: paymentStatus },
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update enrollment' }, { status: 500 });
  }
}
