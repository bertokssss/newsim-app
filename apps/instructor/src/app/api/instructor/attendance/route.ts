import { NextRequest, NextResponse } from 'next/server';
import {
  getInstructorAttendanceRecords,
  getInstructorAttendanceForSession,
  recordInstructorAttendance,
  getCourseBatchAttendanceRoster,
} from '@newsim/database';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'ATTENDANCE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const instructorId = auth.user.id;
    const { searchParams } = new URL(req.url);

    // If querying course and batch roster
    const courseId = searchParams.get('courseId');
    const batchId = searchParams.get('batchId') || undefined;
    const date = searchParams.get('date');

    if (courseId && (batchId || date)) {
      const rosterData = await getCourseBatchAttendanceRoster({
        courseId,
        batchId,
        sessionDate: date || new Date().toISOString().split('T')[0],
        instructorProfileId: instructorId,
      });
      if (!rosterData.isAuthorized) {
        return createForbiddenResponse('Access denied: You are not assigned to this course.');
      }
      return NextResponse.json({ success: true, data: rosterData });
    }

    const scheduleId = searchParams.get('scheduleId') || '';
    if (scheduleId) {
      const records = await getInstructorAttendanceForSession(scheduleId, instructorId);
      return NextResponse.json({ success: true, data: records });
    }

    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    const records = await getInstructorAttendanceRecords(instructorId, { search, status });

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    const msg = error?.message || 'Failed to load attendance records';
    if (msg.startsWith('FORBIDDEN:')) {
      return createForbiddenResponse(msg.replace(/^FORBIDDEN:\s*/, ''));
    }
    console.error('Failed to load attendance records:', error);
    return NextResponse.json({ success: false, error: 'Failed to load attendance records' }, { status: 500 });
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
    const { date, sessionCode, courseId, records } = body;

    if (!date || !sessionCode || !courseId || !Array.isArray(records)) {
      return NextResponse.json({ success: false, error: 'Missing required attendance roll-call fields' }, { status: 400 });
    }

    // Maritime LMS Rule: Future session dates cannot be marked in advance.
    const todayManila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    if (date > todayManila) {
      return NextResponse.json({
        success: false,
        error: `Cannot record attendance in advance. Future training date (${date}) has not arrived yet.`,
        code: 'FUTURE_DATE_LOCKED',
      }, { status: 400 });
    }

    const created = await recordInstructorAttendance(date, sessionCode, courseId, records, instructorId);
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    const msg = error?.message || 'Failed to submit attendance roll-call';
    if (msg.startsWith('FORBIDDEN:')) {
      return createForbiddenResponse(msg.replace(/^FORBIDDEN:\s*/, ''));
    }
    if (msg.toLowerCase().includes('finalized')) {
      return NextResponse.json({ success: false, error: msg }, { status: 409 });
    }
    console.error('Failed to submit attendance roll-call:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit attendance roll-call' }, { status: 500 });
  }
}
