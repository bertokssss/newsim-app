import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db, UserRecord } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

export async function GET(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'INSTRUCTOR_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.toLowerCase() || '';
  const status = searchParams.get('status') || 'ALL';
  const centerId = searchParams.get('centerId') || 'ALL';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  let instructors = db.getUsers().filter((u) => u.role === 'INSTRUCTOR');

  if (status !== 'ALL') {
    instructors = instructors.filter((u) => u.status === status);
  }

  if (centerId !== 'ALL') {
    instructors = instructors.filter((u) => u.assignedCenterId === centerId);
  }

  if (search) {
    instructors = instructors.filter(
      (u) =>
        u.email.toLowerCase().includes(search) ||
        u.username?.toLowerCase().includes(search) ||
        u.firstName.toLowerCase().includes(search) ||
        u.lastName.toLowerCase().includes(search) ||
        u.specialization?.toLowerCase().includes(search) ||
        u.employeeId?.toLowerCase().includes(search)
    );
  }

  const total = instructors.length;
  const startIndex = (page - 1) * limit;
  const paginated = instructors.slice(startIndex, startIndex + limit).map((u) => {
    const center = u.assignedCenterId ? db.getTrainingCenterById(u.assignedCenterId) : undefined;
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      specialization: u.specialization,
      employeeId: u.employeeId,
      assignedCenterId: u.assignedCenterId,
      assignedCenterName: center ? center.name : 'Unassigned',
      status: u.status,
      phone: u.phone,
      mfaEnabled: u.mfaEnabled,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({
    success: true,
    data: paginated,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'INSTRUCTOR_CREATE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { firstName, lastName, email, username, phone, specialization, employeeId, assignedCenterId } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { success: false, error: 'First name, last name, and email are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.getUserByEmailOrUsername(cleanEmail);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email address already exists.' },
        { status: 400 }
      );
    }

    const invitationToken = `inv-ins-${crypto.randomBytes(16).toString('hex')}`;
    const initialTempPassword = `MARITIME-${crypto.randomBytes(4).toString('hex').toUpperCase()}!`;
    const passwordHash = await bcrypt.hash(initialTempPassword, 10);

    const newInstructor: UserRecord = {
      id: `usr-ins-${Date.now()}`,
      email: cleanEmail,
      username: username ? username.trim().toLowerCase() : cleanEmail.split('@')[0],
      passwordHash,
      role: 'INSTRUCTOR',
      status: 'PENDING',
      phone,
      mfaEnabled: false,
      failedLoginAttempts: 0,
      mustChangePassword: true,
      invitationToken,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      specialization: specialization?.trim() || 'STCW Maritime Instructor',
      employeeId: employeeId?.trim() || `INS-${Date.now().toString().slice(-4)}`,
      assignedCenterId: assignedCenterId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createUser(newInstructor);

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: 'INSTRUCTOR_CREATED',
      targetType: 'INSTRUCTOR',
      targetId: newInstructor.id,
      details: {
        instructorEmail: newInstructor.email,
        name: `${newInstructor.firstName} ${newInstructor.lastName}`,
        specialization: newInstructor.specialization,
      },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    db.addNotification({
      title: 'Instructor Account Provisioned',
      message: `Instructor account for ${newInstructor.firstName} ${newInstructor.lastName} has been provisioned.`,
      severity: 'INFO',
      type: 'ADMIN',
      isRead: false,
      link: '/super-admin/instructor-accounts',
    });

    return NextResponse.json({
      success: true,
      message: 'Instructor account provisioned successfully. Setup invitation ready.',
      instructor: {
        id: newInstructor.id,
        email: newInstructor.email,
        name: `${newInstructor.firstName} ${newInstructor.lastName}`,
        status: newInstructor.status,
        invitationToken: newInstructor.invitationToken,
        invitationLink: `/login/instructor?invitation=${newInstructor.invitationToken}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to provision instructor account.' },
      { status: 500 }
    );
  }
}
