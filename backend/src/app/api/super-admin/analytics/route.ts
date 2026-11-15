import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'REPORT_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);
  const timeRange = searchParams.get('timeRange') || '30d';

  const analytics = db.getGlobalAnalytics(timeRange);

  return NextResponse.json({
    success: true,
    data: analytics,
  });
}
