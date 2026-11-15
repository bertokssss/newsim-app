import { NextRequest, NextResponse } from 'next/server';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { getInstructorCourseIds, getPracticalRubricDetails } from '@newsim/database';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'ASSESSMENT_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }

    const { id } = await context.params;
    const rubric = await getPracticalRubricDetails(id);

    if (!rubric) {
      return NextResponse.json({ success: false, error: 'Rubric not found' }, { status: 404 });
    }

    const assignedCourseIds = await getInstructorCourseIds(auth.user.id);
    if (!assignedCourseIds.includes(rubric.courseId)) {
      return createForbiddenResponse('Access denied: You are not assigned to this rubric course.');
    }

    return NextResponse.json({
      success: true,
      data: rubric,
    });
  } catch (error: any) {
    console.error('Failed to load practical rubric details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load practical rubric details' },
      { status: 500 }
    );
  }
}
