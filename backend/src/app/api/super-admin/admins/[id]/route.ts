import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifySuperAdminRequest(req, 'ADMIN_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { id } = await params;
  const admin = db.getUserById(id);

  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Administrator account not found.' },
      { status: 404 }
    );
  }

  const center = admin.assignedCenterId ? db.getTrainingCenterById(admin.assignedCenterId) : undefined;
  const adminAuditLogs = db.getAuditLogs().filter((l) => l.actorId === admin.id || l.targetId === admin.id).slice(0, 10);
  const activeSessions = db.getSessions(admin.id);

  return NextResponse.json({
    success: true,
    data: {
      id: admin.id,
      email: admin.email,
      username: admin.username,
      firstName: admin.firstName,
      lastName: admin.lastName,
      department: admin.department,
      employeeId: admin.employeeId,
      assignedCenterId: admin.assignedCenterId,
      assignedCenterName: center ? center.name : 'Unassigned',
      status: admin.status,
      phone: admin.phone,
      mfaEnabled: admin.mfaEnabled,
      lastLoginAt: admin.lastLoginAt,
      permissions: admin.permissions || [],
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      recentActivity: adminAuditLogs,
      activeSessionsCount: activeSessions.length,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifySuperAdminRequest(req, 'ADMIN_UPDATE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const { id } = await params;
    const admin = db.getUserById(id);

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Administrator account not found.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { action, permissions, department, assignedCenterId, phone } = body;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    if (action === 'ACTIVATE') {
      admin.status = 'ACTIVE';
      admin.failedLoginAttempts = 0;
      admin.lockoutUntil = undefined;
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'ADMIN_ACTIVATED',
        targetType: 'ADMIN',
        targetId: admin.id,
        details: { adminEmail: admin.email },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });
    } else if (action === 'SUSPEND') {
      admin.status = 'SUSPENDED';
      db.revokeOtherSessionsForUser(admin.id, '');
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'ADMIN_SUSPENDED',
        targetType: 'ADMIN',
        targetId: admin.id,
        details: { adminEmail: admin.email },
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });
    } else if (action === 'DEACTIVATE') {
      admin.status = 'INACTIVE';
      db.revokeOtherSessionsForUser(admin.id, '');
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'ADMIN_DEACTIVATED',
        targetType: 'ADMIN',
        targetId: admin.id,
        details: { adminEmail: admin.email },
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });
    } else if (action === 'UNLOCK') {
      admin.status = 'ACTIVE';
      admin.failedLoginAttempts = 0;
      admin.lockoutUntil = undefined;
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'ADMIN_UNLOCKED',
        targetType: 'ADMIN',
        targetId: admin.id,
        details: { adminEmail: admin.email },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });
    } else if (action === 'RESET_MFA') {
      admin.mfaEnabled = false;
      admin.mfaSecret = undefined;
      admin.recoveryCodes = undefined;
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'ADMIN_MFA_RESET',
        targetType: 'ADMIN',
        targetId: admin.id,
        details: { adminEmail: admin.email },
        ipAddress: ip,
        userAgent,
        severity: 'CRITICAL',
      });
    } else if (action === 'REQUIRE_PASSWORD_RESET') {
      admin.mustChangePassword = true;
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'ADMIN_PASSWORD_RESET_REQUIRED',
        targetType: 'ADMIN',
        targetId: admin.id,
        details: { adminEmail: admin.email },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });
    }

    if (Array.isArray(permissions)) {
      const oldPermissions = admin.permissions;
      admin.permissions = permissions;
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'ADMIN_PERMISSIONS_UPDATED',
        targetType: 'ADMIN',
        targetId: admin.id,
        details: { oldPermissions, newPermissions: permissions },
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });
    }

    if (department) admin.department = department.trim();
    if (assignedCenterId !== undefined) admin.assignedCenterId = assignedCenterId || undefined;
    if (phone !== undefined) admin.phone = phone;

    admin.updatedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      message: 'Administrator account successfully updated.',
      data: {
        id: admin.id,
        status: admin.status,
        permissions: admin.permissions,
        mfaEnabled: admin.mfaEnabled,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to update administrator account.' },
      { status: 500 }
    );
  }
}
