import { NextRequest, NextResponse } from 'next/server';
import { getTraineeProgressData } from '@newsim/database';
import { verifyTraineeRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const data = await getTraineeProgressData(traineeId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to load progress from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load progress' }, { status: 500 });
  }
}
