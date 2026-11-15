import { NextRequest, NextResponse } from 'next/server';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { finalizeInstructorBatchAttendance } from '@newsim/database';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'ATTENDANCE_RECORD');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }

    const instructorId = auth.user.id;
    const body = await req.json();
    const { sessionId, courseId, batchId, sessionDate, acknowledgeUnmarked } = body;

    if (!sessionId && (!courseId || !sessionDate)) {
      return NextResponse.json(
        { success: false, error: 'sessionId or (courseId and sessionDate) are required to finalize session' },
        { status: 400 }
      );
    }

    // Maritime LMS Rule: Future session dates cannot be finalized in advance.
    const todayManila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    if (sessionDate && sessionDate > todayManila) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot finalize attendance in advance. Future training date (${sessionDate}) has not arrived yet.`,
          code: 'FUTURE_DATE_LOCKED',
        },
        { status: 400 }
      );
    }

    const result = await finalizeInstructorBatchAttendance({
      sessionId,
      courseId,
      batchId: batchId || null,
      sessionDate,
      instructorProfileId: instructorId,
      acknowledgeUnmarked: Boolean(acknowledgeUnmarked),
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error?.requiresAcknowledgment) {
      return NextResponse.json(
        {
          success: false,
          requiresAcknowledgment: true,
          notMarkedCount: error.notMarkedCount,
          error: error.message,
        },
        { status: 200 }
      );
    }
    const msg = error?.message || 'Failed to finalize attendance session';
    if (msg.startsWith('FORBIDDEN:')) {
      return createForbiddenResponse(msg.replace(/^FORBIDDEN:\s*/, ''));
    }
    console.error('Failed to finalize attendance session:', error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg.toLowerCase().includes('already finalized') ? 409 : 400 }
    );
  }
}
