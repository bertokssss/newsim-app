import { NextRequest, NextResponse } from 'next/server';
import { getTraineePaymentsList } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'PAYMENT_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const payments = await getTraineePaymentsList(traineeId);
    return NextResponse.json({ success: true, data: payments });
  } catch (error) {
    console.error('Failed to load payments from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load payments' }, { status: 500 });
  }
}
