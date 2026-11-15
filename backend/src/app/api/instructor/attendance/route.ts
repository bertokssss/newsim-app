import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    let records = db.getInstructorAttendance('usr-ins-01');

    if (search) {
      records = records.filter(
        (r) =>
          r.traineeName.toLowerCase().includes(search) ||
          r.courseTitle.toLowerCase().includes(search) ||
          r.sessionCode.toLowerCase().includes(search)
      );
    }

    if (status !== 'ALL') {
      records = records.filter((r) => r.status === status);
    }

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('Failed to load attendance records:', error);
    return NextResponse.json({ success: false, error: 'Failed to load attendance records' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, sessionCode, courseId, records } = body;

    if (!date || !sessionCode || !courseId || !Array.isArray(records)) {
      return NextResponse.json({ success: false, error: 'Missing required attendance roll-call fields' }, { status: 400 });
    }

    const created = db.recordInstructorAttendance(date, sessionCode, courseId, records, 'usr-ins-01');
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to submit attendance roll-call' }, { status: 500 });
  }
}
