import { NextRequest, NextResponse } from 'next/server';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '@newsim/database';
import {
  isAdminContext,
  requireAdmin,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    const notifications = await getUserNotifications(ctx.user.id, 'ADMIN', {
      isRead: unreadOnly ? false : undefined,
      canViewPayments: ctx.hasFinancialAccess,
      permissions: ctx.user.permissions,
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
      canViewPayments: ctx.hasFinancialAccess,
    });
  } catch (error) {
    console.error('Failed to load admin notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { id, notificationId, markAll, action } = body;

    if (markAll || action === 'MARK_ALL_READ' || (!id && !notificationId)) {
      await markAllAsRead(ctx.user.id);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    const targetId = id || notificationId;
    if (targetId) {
      await markAsRead(targetId, ctx.user.id);
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update admin notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Notification ID required' }, { status: 400 });
    }

    await deleteNotification(id, ctx.user.id);
    return NextResponse.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Failed to delete admin notification:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete notification' }, { status: 500 });
  }
}
