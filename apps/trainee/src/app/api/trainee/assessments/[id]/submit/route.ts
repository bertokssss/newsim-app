import { NextRequest, NextResponse } from 'next/server';
import { submitTraineeAssessment } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'ASSESSMENT_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const { id } = await params;
    const body = await req.json();
    const { score = 0, answers = {} } = body || {};

    const submission = await submitTraineeAssessment(id, Number(score) || 0, answers, traineeId);
    return NextResponse.json({ success: true, data: submission });
  } catch (error: any) {
    if (error?.code === 'ASSESSMENT_LOCKED') {
      return NextResponse.json(
        { success: false, error: String(error.message).replace('ASSESSMENT_LOCKED: ', '') },
        { status: 403 }
      );
    }
    console.error('Failed to submit assessment to Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit assessment' }, { status: 500 });
  }
}
