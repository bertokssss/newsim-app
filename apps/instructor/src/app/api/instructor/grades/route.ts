import { NextRequest, NextResponse } from 'next/server';
import { getInstructorGradebookData, updateInstructorGrade, getInstructorCourseIds, supabaseAdmin } from '@newsim/database';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'GRADE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const instructorId = auth.user.id;
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({
        success: true,
        data: {
          gradebook: [],
          assessments: [],
        },
      });
    }

    // Verify instructor course scope
    const assignedCourseIds = await getInstructorCourseIds(instructorId);
    if (!assignedCourseIds.includes(courseId)) {
      return createForbiddenResponse('Access denied: You are not assigned to instruct or grade this course.');
    }

    const data = await getInstructorGradebookData(courseId, instructorId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Failed to load gradebook:', error);
    return NextResponse.json({ success: false, error: 'Failed to load gradebook' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'GRADE_FINALIZE');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const instructorName = `${auth.user.firstName || ''} ${auth.user.lastName || ''}`.trim() || 'Instructor';
    const instructorId = auth.user.id;

    const body = await req.json();
    const { submissionId, score, feedback, reason, traineeId, assessmentId } = body;

    // Validate score bounds (0-100 numeric finite)
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json(
        { success: false, error: 'Score must be a valid numeric value between 0 and 100.' },
        { status: 400 }
      );
    }

    if (!submissionId && (!traineeId || !assessmentId)) {
      return NextResponse.json(
        { success: false, error: 'Submission ID or Trainee and Assessment IDs are required.' },
        { status: 400 }
      );
    }

    // Resolve target assessment & course
    let targetAssessmentId = assessmentId;
    let targetTraineeId = traineeId;

    if (submissionId) {
      const { data: attempt } = await supabaseAdmin
        .from('assessment_attempts')
        .select('assessment_id, trainee_id')
        .eq('id', submissionId)
        .maybeSingle();

      if (attempt) {
        targetAssessmentId = attempt.assessment_id;
        targetTraineeId = attempt.trainee_id;
      }
    }

    if (!targetAssessmentId) {
      return NextResponse.json({ success: false, error: 'Valid assessment could not be resolved.' }, { status: 404 });
    }

    const { data: assessment } = await supabaseAdmin
      .from('assessments')
      .select('id, course_id, title')
      .eq('id', targetAssessmentId)
      .maybeSingle();

    if (!assessment) {
      return NextResponse.json({ success: false, error: 'Assessment not found.' }, { status: 404 });
    }

    const courseId = assessment.course_id;

    // Strict Instructor Scope Enforcement: Instructor must be assigned to this course
    const assignedCourseIds = await getInstructorCourseIds(instructorId);
    if (!assignedCourseIds.includes(courseId)) {
      return createForbiddenResponse('Access denied: You are not assigned to instruct or grade this course.');
    }

    // Legitimate Trainee Enrollment Verification: Trainee must have an active/completed enrollment in this course
    if (targetTraineeId) {
      const { data: enr } = await supabaseAdmin
        .from('enrollments')
        .select('id, status')
        .eq('trainee_id', targetTraineeId)
        .eq('course_id', courseId)
        .in('status', ['ENROLLED', 'ONGOING', 'COMPLETED', 'ACTIVE', 'APPROVED'])
        .limit(1)
        .maybeSingle();

      if (!enr) {
        return createForbiddenResponse('Access denied: Trainee does not have an active enrollment in this course.');
      }
    }

    const updated = await updateInstructorGrade(
      submissionId,
      score,
      feedback || '',
      reason,
      instructorName,
      instructorId,
      targetTraineeId,
      targetAssessmentId
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Failed to record grade:', error);
    return NextResponse.json({ success: false, error: 'Failed to record grade' }, { status: 500 });
  }
}
