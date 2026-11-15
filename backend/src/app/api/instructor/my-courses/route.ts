import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    let courses = db.getInstructorCourses('usr-ins-01');

    if (search) {
      courses = courses.filter(
        (c) =>
          c.code.toLowerCase().includes(search) ||
          c.title.toLowerCase().includes(search) ||
          c.category.toLowerCase().includes(search)
      );
    }

    if (status !== 'ALL') {
      courses = courses.filter((c) => c.status === status);
    }

    return NextResponse.json({ success: true, data: courses });
  } catch (error) {
    console.error('Failed to load courses:', error);
    return NextResponse.json({ success: false, error: 'Failed to load courses' }, { status: 500 });
  }
}
