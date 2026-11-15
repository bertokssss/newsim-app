import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const notifications = db.getInstructorNotifications('usr-ins-01');
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

export async function PATCH(req: NextRequest) {
  try {
    return NextResponse.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}
