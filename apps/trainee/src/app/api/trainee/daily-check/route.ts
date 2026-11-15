import { NextRequest, NextResponse } from 'next/server';
import { syncTraineeDailyModules, getTraineeEnrollmentsList } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { dispatchDailyEmailNotification } from '@/lib/daily-sync';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'COURSE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const enrollments = await getTraineeEnrollmentsList(traineeId);
    const activeEnrollments = enrollments.filter((e: any) =>
      ['ENROLLED', 'ACTIVE', 'APPROVED', 'ONGOING'].includes((e.status || '').toUpperCase())
    );

    const results: Record<string, any[]> = {};
    for (const enr of activeEnrollments) {
      const courseId = enr.courseId;
      if (courseId) {
        results[courseId] = await syncTraineeDailyModules(traineeId, courseId, dispatchDailyEmailNotification);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Daily module pacing check completed.',
      data: results,
    });
  } catch (error: any) {
    console.error('Failed to run daily check:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Daily check failed' }, { status: 500 });
  }
}
