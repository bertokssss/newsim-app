import { NextRequest, NextResponse } from 'next/server';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { getInstructorAttendanceOptions } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'ATTENDANCE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }

    const instructorId = auth.user.id;
    const options = await getInstructorAttendanceOptions(instructorId);

    return NextResponse.json({
      success: true,
      data: options,
    });
  } catch (error) {
    console.error('Failed to load instructor attendance options:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load assigned attendance courses and sessions' },
      { status: 500 }
    );
  }
}
