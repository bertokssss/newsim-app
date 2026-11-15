import { NextRequest, NextResponse } from 'next/server';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { getInstructorCourseIds, getPracticalRubricsList } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'ASSESSMENT_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }

    const instructorId = auth.user.id;
    const assignedCourseIds = await getInstructorCourseIds(instructorId);
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId') || undefined;

    if (courseId && !assignedCourseIds.includes(courseId)) {
      return createForbiddenResponse('Access denied: You are not assigned to instruct this course.');
    }

    const rubrics = await getPracticalRubricsList(courseId);
    const scopedRubrics = rubrics.filter((r) => assignedCourseIds.includes(r.courseId));

    return NextResponse.json({
      success: true,
      data: scopedRubrics,
    });
  } catch (error: any) {
    console.error('Failed to load practical rubrics:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load practical rubrics' },
      { status: 500 }
    );
  }
}
