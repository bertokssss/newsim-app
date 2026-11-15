import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db, UserRecord } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

export async function GET(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'ADMIN_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.toLowerCase() || '';
  const status = searchParams.get('status') || 'ALL';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  let admins = db.getUsers().filter((u) => u.role === 'ADMIN');

  if (status !== 'ALL') {
    admins = admins.filter((u) => u.status === status);
  }

  if (search) {
    admins = admins.filter(
      (u) =>
        u.email.toLowerCase().includes(search) ||
        u.username?.toLowerCase().includes(search) ||
        u.firstName.toLowerCase().includes(search) ||
        u.lastName.toLowerCase().includes(search) ||
        u.department?.toLowerCase().includes(search) ||
        u.employeeId?.toLowerCase().includes(search)
    );
  }

  const total = admins.length;
  const startIndex = (page - 1) * limit;
  const paginated = admins.slice(startIndex, startIndex + limit).map((u) => {
    const center = u.assignedCenterId ? db.getTrainingCenterById(u.assignedCenterId) : undefined;
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      department: u.department,
      employeeId: u.employeeId,
      assignedCenterId: u.assignedCenterId,
      assignedCenterName: center ? center.name : 'Unassigned',
      status: u.status,
      phone: u.phone,
      mfaEnabled: u.mfaEnabled,
      lastLoginAt: u.lastLoginAt,
      permissions: u.permissions || [],
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
  const auth = verifySuperAdminRequest(req, 'ADMIN_CREATE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { firstName, lastName, email, username, phone, department, employeeId, assignedCenterId, permissions } = body;

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

    // Generate secure temporary setup token / hash
    const invitationToken = `inv-adm-${crypto.randomBytes(16).toString('hex')}`;
    const initialTempPassword = `NEWSIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}!`;
    const passwordHash = await bcrypt.hash(initialTempPassword, 10);

    const newAdmin: UserRecord = {
      id: `usr-adm-${Date.now()}`,
      email: cleanEmail,
      username: username ? username.trim().toLowerCase() : cleanEmail.split('@')[0],
      passwordHash,
      role: 'ADMIN',
      status: 'PENDING',
      phone,
      mfaEnabled: false,
      failedLoginAttempts: 0,
      mustChangePassword: true,
      invitationToken,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      department: department?.trim() || 'Operations',
      employeeId: employeeId?.trim() || `ADM-${Date.now().toString().slice(-4)}`,
      assignedCenterId: assignedCenterId || undefined,
      permissions: Array.isArray(permissions) ? permissions : ['TRAINEE_MANAGE', 'COURSE_MANAGE', 'ENROLLMENT_MANAGE'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createUser(newAdmin);

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: 'ADMIN_CREATED',
      targetType: 'ADMIN',
      targetId: newAdmin.id,
      details: {
        adminEmail: newAdmin.email,
        name: `${newAdmin.firstName} ${newAdmin.lastName}`,
        department: newAdmin.department,
        permissions: newAdmin.permissions,
      },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    db.addNotification({
      title: 'Administrator Provisioned',
      message: `Admin account for ${newAdmin.firstName} ${newAdmin.lastName} (${newAdmin.email}) has been provisioned.`,
      severity: 'INFO',
      type: 'ADMIN',
      isRead: false,
      link: '/super-admin/admins',
    });

    return NextResponse.json({
      success: true,
      message: 'Admin account provisioned successfully. Secure setup invitation dispatched.',
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: `${newAdmin.firstName} ${newAdmin.lastName}`,
        status: newAdmin.status,
        invitationToken: newAdmin.invitationToken,
        invitationLink: `/login/admin_super-admin?invitation=${newAdmin.invitationToken}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to create administrator account.' },
      { status: 500 }
    );
  }
}
