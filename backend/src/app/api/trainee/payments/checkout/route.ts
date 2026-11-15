import { NextRequest, NextResponse } from 'next/server';
import { createTraineePaymentCheckout } from '@newsim/database';
import { verifyTraineeRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const body = await req.json();
    const { enrollmentId, method, amount } = body;

    if (!enrollmentId || !amount) {
      return NextResponse.json({ success: false, error: 'Enrollment ID and amount are required' }, { status: 400 });
    }

    const payment = await createTraineePaymentCheckout(traineeId, enrollmentId, method || 'QR_PH', amount);
    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    console.error('Failed to create payment checkout in Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to create payment checkout' }, { status: 500 });
  }
}
