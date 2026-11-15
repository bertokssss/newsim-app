import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(request: Request) {
  try {
    const notifications = db.getAdminNotifications();
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, markAll } = body;

    if (markAll) {
      db.markAllAdminNotificationsAsRead();
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (id) {
      db.markAdminNotificationAsRead(id);
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}
