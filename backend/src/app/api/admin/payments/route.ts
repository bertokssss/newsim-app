import { NextResponse } from 'next/server';
import { db, PaymentRecord } from '@newsim/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';
    const method = searchParams.get('method') || 'ALL';

    let payments = db.getPayments();

    if (search) {
      payments = payments.filter(
        (p) =>
          p.paymentNo.toLowerCase().includes(search) ||
          p.traineeName.toLowerCase().includes(search) ||
          p.referenceNumber.toLowerCase().includes(search) ||
          p.courseTitle.toLowerCase().includes(search)
      );
    }

    if (status !== 'ALL') {
      payments = payments.filter((p) => p.status === status);
    }

    if (method !== 'ALL') {
      payments = payments.filter((p) => p.method === method);
    }

    return NextResponse.json({ success: true, data: payments });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load payments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { enrollmentId, traineeId, courseTitle, amount, method, referenceNumber } = body;

    const trainee = db.getTraineeById(traineeId);

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      paymentNo: `PAY-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      enrollmentId: enrollmentId || `enr-${Date.now()}`,
      traineeId: trainee?.id || 'trn-001',
      traineeName: trainee ? `${trainee.firstName} ${trainee.lastName}` : 'Trainee',
      traineeEmail: trainee?.email || 'trainee@maritime.ph',
      courseTitle: courseTitle || 'STCW Course',
      amount: parseFloat(amount) || 10000,
      method: method || 'QR_PH',
      referenceNumber: referenceNumber || `QRPH-${Math.floor(10000000 + Math.random() * 90000000)}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    db.createPayment(newPayment);

    return NextResponse.json({ success: true, payment: newPayment });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create payment' }, { status: 500 });
  }
}
