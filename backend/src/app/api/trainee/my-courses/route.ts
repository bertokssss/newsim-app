import { NextRequest, NextResponse } from 'next/server';
import { getTraineeCoursesList } from '@newsim/database';
import { verifyTraineeRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    const courses = await getTraineeCoursesList(traineeId, search, status);
    return NextResponse.json({ success: true, data: courses });
  } catch (error) {
    console.error('Failed to load courses from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load courses' }, { status: 500 });
  }
}
