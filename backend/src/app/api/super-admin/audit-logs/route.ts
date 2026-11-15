import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

export async function GET(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'AUDIT_LOG_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.toLowerCase() || '';
  const role = searchParams.get('role') || 'ALL';
  const action = searchParams.get('action') || 'ALL';
  const severity = searchParams.get('severity') || 'ALL';
  const status = searchParams.get('status') || 'ALL';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '15', 10);

  let logs = db.getAuditLogs();

  if (role !== 'ALL') {
    logs = logs.filter((l) => l.actorRole === role);
  }

  if (action !== 'ALL') {
    logs = logs.filter((l) => l.action.toLowerCase().includes(action.toLowerCase()));
  }

  if (severity !== 'ALL') {
    logs = logs.filter((l) => l.severity === severity);
  }

  if (status !== 'ALL') {
    logs = logs.filter((l) => l.status === status);
  }

  if (search) {
    logs = logs.filter(
      (l) =>
        l.actorEmail.toLowerCase().includes(search) ||
        l.action.toLowerCase().includes(search) ||
        (l.targetId && l.targetId.toLowerCase().includes(search)) ||
        (l.targetType && l.targetType.toLowerCase().includes(search)) ||
        l.ipAddress.includes(search)
    );
  }

  const total = logs.length;
  const startIndex = (page - 1) * limit;
  const paginated = logs.slice(startIndex, startIndex + limit);

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
  const auth = verifySuperAdminRequest(req, 'REPORT_EXPORT');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { format } = body;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: 'SUPER_ADMIN_EXPORTED_REPORT',
      targetType: 'AUDIT_LOGS',
      targetId: 'ALL_LOGS',
      details: { format: format || 'CSV' },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    return NextResponse.json({
      success: true,
      message: 'Audit log exported. Export action recorded.',
      data: db.getAuditLogs(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to export audit logs.' },
      { status: 500 }
    );
  }
}
