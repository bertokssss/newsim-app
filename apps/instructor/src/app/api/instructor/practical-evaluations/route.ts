import { NextRequest, NextResponse } from 'next/server';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { getTraineesForPracticalGrading, savePracticalEvaluation } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'ASSESSMENT_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }

    const instructorId = auth.user.id;
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    const batchId = searchParams.get('batchId') || undefined;
    const rubricId = searchParams.get('rubricId');

    if (!courseId || !rubricId) {
      return NextResponse.json(
        { success: false, error: 'courseId and rubricId are required parameters' },
        { status: 400 }
      );
    }

    const trainees = await getTraineesForPracticalGrading({
      courseId,
      batchId,
      rubricId,
      instructorProfileId: instructorId,
    });

    return NextResponse.json({
      success: true,
      data: trainees,
    });
  } catch (error: any) {
    const msg = error?.message || 'Failed to load trainees for practical grading';
    if (msg.startsWith('FORBIDDEN:')) {
      return createForbiddenResponse(msg.replace(/^FORBIDDEN:\s*/, ''));
    }
    console.error('Failed to load trainees for practical grading:', error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'ASSESSMENT_GRADE');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }

    const instructorId = auth.user.id;
    const instructorName = `${auth.user.firstName || ''} ${auth.user.lastName || ''}`.trim() || 'Instructor';
    const body = await req.json();

    const {
      rubricId,
      traineeId,
      courseId,
      batchId,
      scores,
      generalFeedback,
      strengths,
      improvementsRequired,
      remediationPlan,
      status = 'DRAFT',
      amendmentReason,
    } = body;

    if (!rubricId || !traineeId || !courseId || !Array.isArray(scores)) {
      return NextResponse.json(
        { success: false, error: 'Missing required evaluation fields: rubricId, traineeId, courseId, scores' },
        { status: 400 }
      );
    }

    const result = await savePracticalEvaluation({
      rubricId,
      traineeId,
      instructorProfileId: instructorId,
      instructorName,
      courseId,
      batchId,
      scores,
      generalFeedback,
      strengths,
      improvementsRequired,
      remediationPlan,
      status,
      amendmentReason,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const msg = error?.message || 'Failed to record practical evaluation';
    if (msg.startsWith('FORBIDDEN:')) {
      return createForbiddenResponse(msg.replace(/^FORBIDDEN:\s*/, ''));
    }
    console.error('Failed to record practical evaluation:', error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg.toLowerCase().includes('amendment') || msg.toLowerCase().includes('finalized') ? 409 : 500 }
    );
  }
}
