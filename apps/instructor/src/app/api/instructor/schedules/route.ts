import { NextRequest, NextResponse } from 'next/server';
import { getInstructorSchedulesList } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireInstructor(req, 'SCHEDULE_VIEW');
    if (!auth.authorized) return auth.response;
    const instructorId = auth.instructorId;
    const schedules = await getInstructorSchedulesList(instructorId);
    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Failed to load schedules:', error);
    return NextResponse.json({ success: false, error: 'Failed to load schedules' }, { status: 500 });
  }
}
