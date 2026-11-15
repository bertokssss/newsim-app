import { NextRequest, NextResponse } from 'next/server';
import { getInstructorCoursesList } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireInstructor(req, 'COURSE_VIEW');
    if (!auth.authorized) return auth.response;
    const instructorId = auth.instructorId;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    const courses = await getInstructorCoursesList(instructorId, { search, status });

    return NextResponse.json({ success: true, data: courses });
  } catch (error) {
    console.error('Failed to load courses:', error);
    return NextResponse.json({ success: false, error: 'Failed to load courses' }, { status: 500 });
  }
}
