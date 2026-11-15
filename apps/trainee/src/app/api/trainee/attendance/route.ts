import { NextRequest, NextResponse } from 'next/server';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { getTraineeAttendanceData } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'ATTENDANCE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401
        ? createUnauthorizedResponse(auth.error)
        : createForbiddenResponse(auth.error);
    }

    const traineeId = auth.user.id;
    const data = await getTraineeAttendanceData(traineeId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Failed to load trainee attendance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve personal attendance history' },
      { status: 500 }
    );
  }
}
