import { NextRequest, NextResponse } from 'next/server';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '@newsim/database';
import { verifySuperAdminRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req);
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const userId = auth.user.id;
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    // Retrieve strictly Super-Admin-scoped database notifications (Security, Governance, Health)
    const dbNotifs = await getUserNotifications(userId, 'SUPER_ADMIN', {
      isRead: unreadOnly ? false : undefined,
      permissions: auth.user.permissions,
    });

    dbNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const unreadCount = dbNotifs.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      data: dbNotifs,
      unreadCount,
    });
  } catch (error) {
    console.error('Failed to load super admin notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req);
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { action, id, notificationId, markAll } = body;

    const targetId = id || notificationId;

    if (action === 'MARK_ALL_READ' || markAll) {
      await markAllAsRead(auth.user.id);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (action === 'MARK_READ' || targetId) {
      if (!targetId) {
        return NextResponse.json({ success: false, error: 'Notification ID is required' }, { status: 400 });
      }
      await markAsRead(targetId, auth.user.id);
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    if (action === 'DELETE') {
      if (!targetId) {
        return NextResponse.json({ success: false, error: 'Notification ID is required' }, { status: 400 });
      }
      await deleteNotification(targetId, auth.user.id);
      return NextResponse.json({ success: true, message: 'Notification deleted' });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update super admin notification:', error);
    return NextResponse.json({ success: false, error: 'Failed to update notification' }, { status: 500 });
  }
}
