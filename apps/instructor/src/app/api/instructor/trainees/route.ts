import { NextRequest, NextResponse } from 'next/server';
import { getInstructorTraineesList } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireInstructor(req, 'TRAINEE_VIEW');
    if (!auth.authorized) return auth.response;
    const instructorId = auth.instructorId;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    const trainees = await getInstructorTraineesList(instructorId, { search, status });

    return NextResponse.json({ success: true, data: trainees });
  } catch (error) {
    console.error('Failed to load trainees:', error);
    return NextResponse.json({ success: false, error: 'Failed to load trainees' }, { status: 500 });
  }
}
