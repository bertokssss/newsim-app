import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@newsim/database';

export async function GET(request: NextRequest) {
  try {
    const admin = db.getUsers().find((u) => u.role === 'ADMIN') || db.getUserById('usr-adm-01');

    return NextResponse.json({
      success: true,
      data: {
        id: admin?.id,
        firstName: admin?.firstName,
        lastName: admin?.lastName,
        email: admin?.email,
        username: admin?.username,
        phone: admin?.phone,
        department: admin?.department,
        employeeId: admin?.employeeId,
        mfaEnabled: admin?.mfaEnabled,
        lastLoginAt: admin?.lastLoginAt,
        status: admin?.status,
        permissions: admin?.permissions || [],
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, firstName, lastName, phone, currentPassword, newPassword } = body;

    const admin = db.getUserById('usr-adm-01');
    if (!admin) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (action === 'UPDATE_PROFILE') {
      db.updateUser(admin.id, {
        firstName: firstName || admin.firstName,
        lastName: lastName || admin.lastName,
        phone: phone || admin.phone,
      });

      db.addAuditLog({
        actorEmail: admin.email,
        actorRole: 'ADMIN',
        action: 'ADMIN_PROFILE_UPDATED',
        targetType: 'USER',
        targetId: admin.id,
        details: { firstName, lastName, phone },
        ipAddress: '127.0.0.1',
        userAgent: 'NEWSIM Admin Portal',
        status: 'SUCCESS',
        severity: 'INFO',
      });

      return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    }

    if (action === 'CHANGE_PASSWORD') {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ success: false, error: 'Current and new passwords are required' }, { status: 400 });
      }

      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, error: 'New password must be at least 8 characters long' }, { status: 400 });
      }

      const match = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!match) {
        return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      db.updateUser(admin.id, { passwordHash: newHash });

      db.addAuditLog({
        actorEmail: admin.email,
        actorRole: 'ADMIN',
        action: 'PASSWORD_CHANGED',
        targetType: 'USER',
        targetId: admin.id,
        details: { method: 'USER_SETTINGS' },
        ipAddress: '127.0.0.1',
        userAgent: 'NEWSIM Admin Portal',
        status: 'SUCCESS',
        severity: 'INFO',
      });

      return NextResponse.json({ success: true, message: 'Password changed successfully' });
    }

    if (action === 'TOGGLE_MFA') {
      const updated = db.updateUser(admin.id, { mfaEnabled: !admin.mfaEnabled });

      db.addAuditLog({
        actorEmail: admin.email,
        actorRole: 'ADMIN',
        action: 'MFA_SETTINGS_CHANGED',
        targetType: 'USER',
        targetId: admin.id,
        details: { mfaEnabled: updated?.mfaEnabled },
        ipAddress: '127.0.0.1',
        userAgent: 'NEWSIM Admin Portal',
        status: 'SUCCESS',
        severity: 'INFO',
      });

      return NextResponse.json({ success: true, mfaEnabled: updated?.mfaEnabled });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 });
  }
}
