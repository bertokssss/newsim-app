import { NextRequest, NextResponse } from 'next/server';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { getInstructorCourseIds, getPracticalRubricDetails, getTraineeEvaluationDetails } from '@newsim/database';

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
    const { searchParams } = new URL(req.url);
    const traineeId = searchParams.get('traineeId');

    if (!traineeId) {
      return NextResponse.json({ success: false, error: 'traineeId query parameter is required' }, { status: 400 });
    }

    const rubric = await getPracticalRubricDetails(id);
    if (!rubric) {
      return NextResponse.json({ success: false, error: 'Rubric not found' }, { status: 404 });
    }

    const assignedCourseIds = await getInstructorCourseIds(auth.user.id);
    if (!assignedCourseIds.includes(rubric.courseId)) {
      return createForbiddenResponse('Access denied: You are not assigned to this evaluation course.');
    }

    const details = await getTraineeEvaluationDetails(id, traineeId, auth.user.id);

    return NextResponse.json({
      success: true,
      data: details,
    });
  } catch (error: any) {
    console.error('Failed to load practical evaluation details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load practical evaluation details' },
      { status: 500 }
    );
  }
}
