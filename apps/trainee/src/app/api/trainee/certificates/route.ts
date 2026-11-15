import { NextRequest, NextResponse } from 'next/server';
import { getTraineeCertificatesList } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'CERTIFICATE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const certificates = await getTraineeCertificatesList(traineeId);
    return NextResponse.json({ success: true, data: certificates });
  } catch (error) {
    console.error('Failed to load certificates from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load certificates' }, { status: 500 });
  }
}
