import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const schedules = db.getInstructorSchedules('usr-ins-01');
    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load schedules' }, { status: 500 });
  }
}
