import { NextRequest, NextResponse } from 'next/server';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  resolveInstructorProfileId,
} from '@newsim/database';
import { getSessionFromRequest } from '@newsim/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const userId = session?.activeUser?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const instructorId = await resolveInstructorProfileId(userId);

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    const notifications = await getUserNotifications(instructorId, 'INSTRUCTOR', {
      isRead: unreadOnly ? false : undefined,
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Failed to load instructor notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const userId = session?.activeUser?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const instructorId = await resolveInstructorProfileId(userId);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = { markAll: true };
    }

    const { id, notificationId, markAll, action } = body;

    if (markAll || action === 'MARK_ALL_READ' || (!id && !notificationId)) {
      await markAllAsRead(instructorId);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    const targetId = id || notificationId;
    if (targetId) {
      await markAsRead(targetId, instructorId);
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update instructor notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const userId = session?.activeUser?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const instructorId = await resolveInstructorProfileId(userId);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Notification ID required' }, { status: 400 });
    }

    await deleteNotification(id, instructorId);
    return NextResponse.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Failed to delete instructor notification:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete notification' }, { status: 500 });
  }
}
