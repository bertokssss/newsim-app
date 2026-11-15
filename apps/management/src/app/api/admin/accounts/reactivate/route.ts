import { NextRequest, NextResponse } from 'next/server';
import { reactivateAccount, getProfileByIdentifier } from '@newsim/auth';
import { dispatchNotificationEvent, NOTIFICATION_EVENTS } from '@newsim/database';
import { isAdminContext, requireAdmin } from '@/lib/admin-api';

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, { permission: 'ENROLLMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await req.json();
    const { identifier, profileId } = body;

    const targetId = profileId || identifier;
    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'User profile ID or email is required.' },
        { status: 400 }
      );
    }

    const profile = await getProfileByIdentifier(targetId);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Target user account not found.' },
        { status: 404 }
      );
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    const result = await reactivateAccount(profile.id, {
      id: ctx.user.id,
      email: ctx.user.email,
      role: ctx.user.role,
      ip,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to reactivate account.' },
        { status: 500 }
      );
    }

    dispatchNotificationEvent({
      event: NOTIFICATION_EVENTS.ACCOUNT_REACTIVATED,
      targetUserId: result.profile.id,
      entityType: 'USER',
      entityId: result.profile.id,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Account for ${profile.email} successfully reactivated. Failed attempt counters and progressive offense tiers have been reset.`,
      profile: {
        id: result.profile.id,
        email: result.profile.email,
        status: result.profile.status,
        offenseLevel: result.profile.offense_level,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while reactivating account.' },
      { status: 500 }
    );
  }
}
