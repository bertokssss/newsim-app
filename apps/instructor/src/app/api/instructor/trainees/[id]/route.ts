import { NextRequest, NextResponse } from 'next/server';
import { getInstructorTraineeDetails } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireInstructor(req, 'TRAINEE_VIEW');
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    const instructorId = auth.instructorId;

    const data = await getInstructorTraineeDetails(id, instructorId);
    if (!data) {
      return NextResponse.json({ success: false, error: 'Trainee not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    const msg = error?.message || 'Failed to load trainee profile';
    if (msg.startsWith('FORBIDDEN:')) {
      return NextResponse.json({ success: false, error: msg.replace(/^FORBIDDEN:\s*/, '') }, { status: 403 });
    }
    console.error('Failed to load trainee profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to load trainee profile' }, { status: 500 });
  }
}
