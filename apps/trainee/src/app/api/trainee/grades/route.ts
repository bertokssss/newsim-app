import { NextRequest, NextResponse } from 'next/server';
import { getTraineeGradesList } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'GRADE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const grades = await getTraineeGradesList(traineeId);
    return NextResponse.json({
      success: true,
      data: grades,
      modularGrades: (grades as any).modularGrades || [],
      practicalGrades: (grades as any).practicalGrades || [],
      courseBreakdowns: (grades as any).courseBreakdowns || [],
      practicalFeedbacks: (grades as any).practicalFeedbacks || [],
      summary: (grades as any).summary || {},
    });
  } catch (error) {
    console.error('Failed to load grades from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load grades' }, { status: 500 });
  }
}
