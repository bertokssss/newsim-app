import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifySuperAdminRequest(req, 'INSTRUCTOR_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { id } = await params;
  const instructor = db.getUserById(id);

  if (!instructor || instructor.role !== 'INSTRUCTOR') {
    return NextResponse.json(
      { success: false, error: 'Instructor account not found.' },
      { status: 404 }
    );
  }

  const center = instructor.assignedCenterId ? db.getTrainingCenterById(instructor.assignedCenterId) : undefined;
  const auditLogs = db.getAuditLogs().filter((l) => l.actorId === instructor.id || l.targetId === instructor.id).slice(0, 10);

  return NextResponse.json({
    success: true,
    data: {
      id: instructor.id,
      email: instructor.email,
      username: instructor.username,
      firstName: instructor.firstName,
      lastName: instructor.lastName,
      specialization: instructor.specialization,
      employeeId: instructor.employeeId,
      assignedCenterId: instructor.assignedCenterId,
      assignedCenterName: center ? center.name : 'Unassigned',
      status: instructor.status,
      phone: instructor.phone,
      mfaEnabled: instructor.mfaEnabled,
      lastLoginAt: instructor.lastLoginAt,
      createdAt: instructor.createdAt,
      updatedAt: instructor.updatedAt,
      recentActivity: auditLogs,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifySuperAdminRequest(req, 'INSTRUCTOR_UPDATE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const { id } = await params;
    const instructor = db.getUserById(id);

    if (!instructor || instructor.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { success: false, error: 'Instructor account not found.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { action, specialization, assignedCenterId, phone } = body;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    if (action === 'ACTIVATE') {
      instructor.status = 'ACTIVE';
      instructor.failedLoginAttempts = 0;
      instructor.lockoutUntil = undefined;
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'INSTRUCTOR_ACTIVATED',
        targetType: 'INSTRUCTOR',
        targetId: instructor.id,
        details: { email: instructor.email },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });
    } else if (action === 'SUSPEND') {
      instructor.status = 'SUSPENDED';
      db.revokeOtherSessionsForUser(instructor.id, '');
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'INSTRUCTOR_SUSPENDED',
        targetType: 'INSTRUCTOR',
        targetId: instructor.id,
        details: { email: instructor.email },
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });
    } else if (action === 'DEACTIVATE') {
      instructor.status = 'INACTIVE';
      db.revokeOtherSessionsForUser(instructor.id, '');
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'INSTRUCTOR_DEACTIVATED',
        targetType: 'INSTRUCTOR',
        targetId: instructor.id,
        details: { email: instructor.email },
        ipAddress: ip,
        userAgent,
        severity: 'WARNING',
      });
    } else if (action === 'RESET_MFA') {
      instructor.mfaEnabled = false;
      instructor.mfaSecret = undefined;
      instructor.recoveryCodes = undefined;
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'INSTRUCTOR_MFA_RESET',
        targetType: 'INSTRUCTOR',
        targetId: instructor.id,
        details: { email: instructor.email },
        ipAddress: ip,
        userAgent,
        severity: 'CRITICAL',
      });
    } else if (action === 'REQUIRE_PASSWORD_RESET') {
      instructor.mustChangePassword = true;
      logAuditEvent({
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        action: 'INSTRUCTOR_PASSWORD_RESET_REQUIRED',
        targetType: 'INSTRUCTOR',
        targetId: instructor.id,
        details: { email: instructor.email },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });
    }

    if (specialization) instructor.specialization = specialization.trim();
    if (assignedCenterId !== undefined) instructor.assignedCenterId = assignedCenterId || undefined;
    if (phone !== undefined) instructor.phone = phone;

    instructor.updatedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      message: 'Instructor account updated successfully.',
      data: {
        id: instructor.id,
        status: instructor.status,
        specialization: instructor.specialization,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to update instructor account.' },
      { status: 500 }
    );
  }
}
