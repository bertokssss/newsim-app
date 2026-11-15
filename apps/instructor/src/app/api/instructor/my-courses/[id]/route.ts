import { NextRequest, NextResponse } from 'next/server';
import { getInstructorCourseDetails } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireInstructor(req, 'COURSE_VIEW');
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    const instructorId = auth.instructorId;

    const data = await getInstructorCourseDetails(id, instructorId);
    if (!data) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    const msg = error?.message || 'Failed to load course details';
    if (msg.startsWith('FORBIDDEN:')) {
      return NextResponse.json({ success: false, error: msg.replace(/^FORBIDDEN:\s*/, '') }, { status: 403 });
    }
    console.error('Failed to load course details:', error);
    return NextResponse.json({ success: false, error: 'Failed to load course details' }, { status: 500 });
  }
}
