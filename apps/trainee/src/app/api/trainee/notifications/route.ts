import { NextRequest, NextResponse } from 'next/server';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  resolveTraineeProfileId,
} from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = await resolveTraineeProfileId(auth.user.id);

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    const notifications = await getUserNotifications(traineeId, 'TRAINEE', {
      isRead: unreadOnly ? false : undefined,
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Failed to load trainee notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = await resolveTraineeProfileId(auth.user.id);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = { markAll: true };
    }

    const { id, notificationId, markAll, action } = body;

    if (markAll || action === 'MARK_ALL_READ' || (!id && !notificationId)) {
      await markAllAsRead(traineeId);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    const targetId = id || notificationId;
    if (targetId) {
      await markAsRead(targetId, traineeId);
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update trainee notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = await resolveTraineeProfileId(auth.user.id);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Notification ID required' }, { status: 400 });
    }

    await deleteNotification(id, traineeId);
    return NextResponse.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Failed to delete trainee notification:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete notification' }, { status: 500 });
  }
}
