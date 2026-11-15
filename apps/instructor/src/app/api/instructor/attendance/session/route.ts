import { NextRequest, NextResponse } from 'next/server';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { getCourseBatchAttendanceRoster, saveInstructorBatchAttendance } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'ATTENDANCE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }

    const instructorId = auth.user.id;
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    const batchId = searchParams.get('batchId') || undefined;
    const sessionDate = searchParams.get('sessionDate') || searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'courseId query parameter is required' },
        { status: 400 }
      );
    }

    const result = await getCourseBatchAttendanceRoster({
      courseId,
      batchId,
      sessionDate,
      instructorProfileId: instructorId,
    });

    if (!result.isAuthorized) {
      return createForbiddenResponse('Access denied: You are not assigned to this course.');
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const msg = error?.message || 'Failed to load session attendance roster';
    if (msg.startsWith('FORBIDDEN:')) {
      return createForbiddenResponse(msg.replace(/^FORBIDDEN:\s*/, ''));
    }
    console.error('Failed to load session attendance roster:', error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'ATTENDANCE_RECORD');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }

    const instructorId = auth.user.id;
    const body = await req.json();
    const { courseId, batchId, scheduleId, sessionDate } = body;
    const records = body.records || body.attendanceRecords;

    if (!courseId || !sessionDate || !Array.isArray(records)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: courseId, sessionDate, and records array' },
        { status: 400 }
      );
    }

    // Maritime LMS Rule: Future session dates cannot be marked in advance.
    const todayManila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    if (sessionDate > todayManila) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot record attendance in advance. Future training date (${sessionDate}) has not arrived yet. Attendance may only be recorded on or after the scheduled training date.`,
          code: 'FUTURE_DATE_LOCKED',
        },
        { status: 400 }
      );
    }

    const saved = await saveInstructorBatchAttendance({
      courseId,
      batchId: batchId || null,
      scheduleId,
      sessionDate,
      instructorProfileId: instructorId,
      records,
    });

    return NextResponse.json({
      success: true,
      data: saved,
    });
  } catch (error: any) {
    const msg = error?.message || 'Failed to save attendance records';
    if (msg.startsWith('FORBIDDEN:')) {
      return createForbiddenResponse(msg.replace(/^FORBIDDEN:\s*/, ''));
    }
    if (msg.toLowerCase().includes('finalized')) {
      return NextResponse.json({ success: false, error: msg }, { status: 409 });
    }
    console.error('Failed to save batch attendance:', error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
