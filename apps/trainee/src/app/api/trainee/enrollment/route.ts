import { NextRequest, NextResponse } from 'next/server';
import {
  getAvailableCourses,
  getAvailablePackages,
  getTraineeEnrollmentsList,
  applyTraineeEnrollment,
} from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'ENROLLMENT_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const [enrollments, availableCourses, availablePackages] = await Promise.all([
      getTraineeEnrollmentsList(traineeId),
      getAvailableCourses(),
      getAvailablePackages(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        enrollments,
        availableCourses,
        availablePackages,
      },
    });
  } catch (error: any) {
    console.error('Failed to load enrollments from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load enrollments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'ENROLLMENT_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const body = await req.json();
    const { courseId, batchId, packageId, enrollmentType, previousCertificateNumber, checklistConfirmed } = body;

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 });
    }

    const application = await applyTraineeEnrollment(traineeId, courseId, batchId, packageId, {
      enrollmentType,
      previousCertificateNumber,
      checklistConfirmed,
    });
    return NextResponse.json({ success: true, data: application });
  } catch (error: any) {
    console.error('Failed to apply for enrollment in Supabase:', error);
    const code = error?.code || 'ENROLLMENT_FAILED';
    const status =
      code === 'MISSING_SRN'
        ? 403
        : code === 'PREREQUISITE_REQUIRED' ||
          code === 'CERTIFICATE_STILL_VALID' ||
          code === 'REFRESHER_ELIGIBILITY_REQUIRED'
        ? 400
        : code === 'BATCH_FULL' || code === 'ONGOING_COURSE_EXISTS'
        ? 409
        : 500;
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to apply for enrollment', code },
      { status }
    );
  }
}
