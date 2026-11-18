import { NextRequest, NextResponse } from 'next/server';
import { getInstructorProgressData } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireInstructor(req, 'TRAINEE_VIEW');
    if (!auth.authorized) return auth.response;
    const instructorId = auth.instructorId;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';
    const courseId = searchParams.get('courseId') || 'ALL';

    const progress = await getInstructorProgressData(instructorId, { search, status, courseId });

    return NextResponse.json({ success: true, data: progress });
  } catch (error) {
    console.error('Failed to load trainee progress:', error);
    return NextResponse.json({ success: false, error: 'Failed to load trainee progress' }, { status: 500 });
  }
}
