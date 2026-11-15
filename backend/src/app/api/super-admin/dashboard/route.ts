import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  const auth = verifySuperAdminRequest(req);
  if (!auth.authorized) {
    return auth.statusCode === 401
      ? createUnauthorizedResponse(auth.error)
      : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);
  const timeRange = searchParams.get('timeRange') || '30d';

  const analytics = db.getGlobalAnalytics(timeRange);
  const recentAuditLogs = db.getAuditLogs().slice(0, 8);
  const securityEvents = db.getSecurityEvents().slice(0, 5);
  const unreadNotifications = db.getNotifications().filter((n) => !n.isRead).length;

  return NextResponse.json({
    success: true,
    data: {
      ...analytics,
      recentActivity: recentAuditLogs,
      recentSecurityEvents: securityEvents,
      unreadNotificationsCount: unreadNotifications,
      systemTimestamp: new Date().toISOString(),
    },
  });
}
