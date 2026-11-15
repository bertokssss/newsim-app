import { NextRequest, NextResponse } from 'next/server';
import { submitAttendanceCorrection } from '@newsim/database';
import { verifyTraineeRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const body = await req.json();
    const { attendanceId, requestedStatus, reason } = body;

    if (!attendanceId || !requestedStatus || !reason) {
      return NextResponse.json(
        { success: false, error: 'Attendance ID, requested status, and justification reason are required' },
        { status: 400 }
      );
    }

    const correction = await submitAttendanceCorrection(traineeId, attendanceId, requestedStatus, reason);
    return NextResponse.json({ success: true, data: correction });
  } catch (error) {
    console.error('Failed to submit correction request to Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit correction request' }, { status: 500 });
  }
}
