import { NextRequest, NextResponse } from 'next/server';
import { getTraineeSchedulesList } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { dispatchDailyEmailNotification } from '@/lib/daily-sync';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'SCHEDULE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const schedules = await getTraineeSchedulesList(traineeId, dispatchDailyEmailNotification);
    const dailyModules = (schedules as any)?.dailyModules || [];
    const practicalSessions = (schedules as any)?.practicalSessions || [];

    return NextResponse.json({
      success: true,
      data: schedules,
      dailyModules,
      practicalSessions,
    });
  } catch (error) {
    console.error('Failed to load schedules from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load schedules' }, { status: 500 });
  }
}
