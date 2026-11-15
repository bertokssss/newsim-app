import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

export async function GET(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'SYSTEM_SETTINGS_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const settings = db.getSettings();

  return NextResponse.json({
    success: true,
    data: settings,
  });
}

export async function PUT(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'SYSTEM_SETTINGS_UPDATE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { settings } = body; // Array of { key, value }

    if (!Array.isArray(settings)) {
      return NextResponse.json(
        { success: false, error: 'Settings array is required.' },
        { status: 400 }
      );
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    const updatedKeys: string[] = [];
    for (const item of settings) {
      if (item.key && item.value !== undefined) {
        db.updateSetting(item.key, item.value, auth.user.email);
        updatedKeys.push(item.key);
      }
    }

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: 'SYSTEM_SETTINGS_CHANGED',
      targetType: 'SYSTEM_SETTINGS',
      targetId: 'GLOBAL_CONFIG',
      details: { updatedKeysCount: updatedKeys.length, updatedKeys },
      ipAddress: ip,
      userAgent,
      severity: 'WARNING',
    });

    return NextResponse.json({
      success: true,
      message: 'System settings updated successfully.',
      data: db.getSettings(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to update system settings.' },
      { status: 500 }
    );
  }
}
