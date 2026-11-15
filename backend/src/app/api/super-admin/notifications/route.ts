import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  const auth = verifySuperAdminRequest(req);
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const notifications = db.getNotifications();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json({
    success: true,
    data: notifications,
    unreadCount,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = verifySuperAdminRequest(req);
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { action, notificationId } = body;

    if (action === 'MARK_READ') {
      if (!notificationId) {
        return NextResponse.json({ success: false, error: 'Notification ID is required.' }, { status: 400 });
      }
      db.markNotificationAsRead(notificationId);
      return NextResponse.json({ success: true, message: 'Notification marked as read.' });
    }

    if (action === 'MARK_ALL_READ') {
      db.markAllNotificationsAsRead();
      return NextResponse.json({ success: true, message: 'All notifications marked as read.' });
    }

    if (action === 'DELETE') {
      if (!notificationId) {
        return NextResponse.json({ success: false, error: 'Notification ID is required.' }, { status: 400 });
      }
      db.deleteNotification(notificationId);
      return NextResponse.json({ success: true, message: 'Notification deleted.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid notification action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to update notification.' },
      { status: 500 }
    );
  }
}
