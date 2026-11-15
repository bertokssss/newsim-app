import { NextRequest, NextResponse } from 'next/server';
import { getTraineeCourseDetails } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'COURSE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const { id } = await params;
    const details = await getTraineeCourseDetails(id, traineeId);
    return NextResponse.json({ success: true, data: details });
  } catch (error) {
    console.error('Failed to load course details from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load course details' }, { status: 500 });
  }
}
