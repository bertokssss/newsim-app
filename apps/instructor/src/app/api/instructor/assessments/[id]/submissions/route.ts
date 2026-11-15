import { NextRequest, NextResponse } from 'next/server';
import { getInstructorAssessmentSubmissions } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireInstructor(req, 'ASSESSMENT_VIEW');
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    const instructorId = auth.instructorId;

    const submissions = await getInstructorAssessmentSubmissions(id, instructorId);
    return NextResponse.json({ success: true, data: submissions });
  } catch (error: any) {
    const msg = error?.message || 'Failed to load submissions';
    if (msg.startsWith('FORBIDDEN:')) {
      return NextResponse.json({ success: false, error: msg.replace(/^FORBIDDEN:\s*/, '') }, { status: 403 });
    }
    console.error('Failed to load submissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to load submissions' }, { status: 500 });
  }
}
