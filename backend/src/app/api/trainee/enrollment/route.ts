import { NextRequest, NextResponse } from 'next/server';
import { getAvailableCourses, getTraineeEnrollmentsList, applyTraineeEnrollment } from '@newsim/database';
import { verifyTraineeRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const [enrollments, availableCourses] = await Promise.all([
      getTraineeEnrollmentsList(traineeId),
      getAvailableCourses(),
    ]);

    return NextResponse.json({ success: true, data: { enrollments, availableCourses } });
  } catch (error: any) {
    console.error('Failed to load enrollments from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load enrollments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const body = await req.json();
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 });
    }

    const application = await applyTraineeEnrollment(traineeId, courseId);
    return NextResponse.json({ success: true, data: application });
  } catch (error: any) {
    console.error('Failed to apply for enrollment in Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to apply for enrollment' }, { status: 500 });
  }
}
