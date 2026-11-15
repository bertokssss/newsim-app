import { NextRequest, NextResponse } from 'next/server';
import { submitTraineeAssessment } from '@newsim/database';
import { verifyTraineeRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const { id } = await params;
    const body = await req.json();
    const { score, answers } = body;

    if (typeof score !== 'number') {
      return NextResponse.json({ success: false, error: 'Valid numerical score is required' }, { status: 400 });
    }

    const submission = await submitTraineeAssessment(id, score, answers, traineeId);
    return NextResponse.json({ success: true, data: submission });
  } catch (error) {
    console.error('Failed to submit assessment to Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit assessment' }, { status: 500 });
  }
}
