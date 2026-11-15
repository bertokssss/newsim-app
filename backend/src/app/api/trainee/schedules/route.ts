import { NextRequest, NextResponse } from 'next/server';
import { getTraineeSchedulesList } from '@newsim/database';
import { verifyTraineeRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const schedules = await getTraineeSchedulesList(traineeId);
    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Failed to load schedules from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load schedules' }, { status: 500 });
  }
}
