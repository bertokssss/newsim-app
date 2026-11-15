import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  const auth = verifySuperAdminRequest(req);
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim().toLowerCase() || '';

  if (!q) {
    return NextResponse.json({
      success: true,
      data: { admins: [], instructors: [], auditLogs: [] },
    });
  }

  const admins = db
    .getUsers()
    .filter((u) => u.role === 'ADMIN')
    .filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q) ||
        u.employeeId?.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map((u) => ({
      id: u.id,
      title: `${u.firstName} ${u.lastName}`,
      subtitle: `${u.department || 'Admin'} • ${u.email}`,
      link: '/super-admin/admins',
      category: 'Admins',
      status: u.status,
    }));

  const instructors = db
    .getUsers()
    .filter((u) => u.role === 'INSTRUCTOR')
    .filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.specialization?.toLowerCase().includes(q) ||
        u.employeeId?.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map((u) => ({
      id: u.id,
      title: `${u.firstName} ${u.lastName}`,
      subtitle: `${u.specialization || 'Instructor'} • ${u.email}`,
      link: '/super-admin/instructor-accounts',
      category: 'Instructors',
      status: u.status,
    }));

  const auditLogs = db
    .getAuditLogs()
    .filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.actorEmail.toLowerCase().includes(q) ||
        (l.targetId && l.targetId.toLowerCase().includes(q))
    )
    .slice(0, 5)
    .map((l) => ({
      id: l.id,
      title: l.action,
      subtitle: `${l.actorEmail} • ${new Date(l.timestamp).toLocaleDateString()}`,
      link: '/super-admin/audit-logs',
      category: 'Audit Logs',
      status: l.status,
    }));

  return NextResponse.json({
    success: true,
    data: {
      admins,
      instructors,
      auditLogs,
    },
  });
}
