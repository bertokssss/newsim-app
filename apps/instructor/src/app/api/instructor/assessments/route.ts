import { NextRequest, NextResponse } from 'next/server';
import { getInstructorAssessmentsList } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireInstructor(req, 'ASSESSMENT_VIEW');
    if (!auth.authorized) return auth.response;
    const instructorId = auth.instructorId;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const type = searchParams.get('type') || 'ALL';
    const courseId = searchParams.get('courseId') || 'ALL';

    const assessments = await getInstructorAssessmentsList(instructorId, { search, type, courseId });

    return NextResponse.json({ success: true, data: assessments });
  } catch (error) {
    console.error('Failed to load assessments:', error);
    return NextResponse.json({ success: false, error: 'Failed to load assessments' }, { status: 500 });
  }
}
