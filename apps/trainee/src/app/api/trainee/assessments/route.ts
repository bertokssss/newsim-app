import { NextRequest, NextResponse } from 'next/server';
import { getTraineeAssessmentsList } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'ASSESSMENT_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';

    const assessments = await getTraineeAssessmentsList(traineeId, search);
    return NextResponse.json({ success: true, data: assessments });
  } catch (error) {
    console.error('Failed to load assessments from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load assessments' }, { status: 500 });
  }
}
