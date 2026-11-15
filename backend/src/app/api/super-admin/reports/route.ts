import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { db } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

export async function GET(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'REPORT_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'USER_REPORT';
  const timeRange = searchParams.get('timeRange') || '30d';

  let reportData: any = {};

  if (type === 'USER_REPORT') {
    reportData = {
      title: 'Global User Distribution & Account Audit Report',
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: 8840,
        activeTrainees: 8742,
        activeInstructors: 86,
        activeAdmins: 12,
        superAdmins: 1,
      },
      records: db.getUsers().map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role,
        status: u.status,
        mfaEnabled: u.mfaEnabled ? 'Yes' : 'No',
        lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never',
        registered: new Date(u.createdAt).toLocaleDateString(),
      })),
    };
  } else if (type === 'TRAINING_REPORT') {
    reportData = {
      title: 'System-Wide Maritime Training Performance Report',
      generatedAt: new Date().toISOString(),
      summary: {
        totalCourses: 48,
        activeSessions: 18,
        completedYTD: 5420,
        overallCompletionRate: '96.4%',
      },
      records: [
        { courseCode: 'BST-01', title: 'STCW Basic Safety Training', level: 'Mandatory', traineesEnrolled: 3240, completed: 3180, rate: '98.2%', center: 'All Centers' },
        { courseCode: 'SIM-ECDIS', title: 'Electronic Chart Display (ECDIS)', level: 'Advanced', traineesEnrolled: 1890, completed: 1805, rate: '95.6%', center: 'Manila / Cebu' },
        { courseCode: 'DP-ADV', title: 'Dynamic Positioning Advanced Simulator', level: 'Specialist', traineesEnrolled: 860, completed: 815, rate: '94.8%', center: 'Manila Flagship' },
        { courseCode: 'GMDSS-02', title: 'GMDSS General Operator Certificate', level: 'Intermediate', traineesEnrolled: 1140, completed: 1105, rate: '97.0%', center: 'Cebu Institute' },
        { courseCode: 'ER-SIM', title: 'Engine Room Full Mission Simulator', level: 'Advanced', traineesEnrolled: 920, completed: 875, rate: '95.1%', center: 'Manila / Davao' },
        { courseCode: 'AFF-04', title: 'Advanced Fire Fighting & Evacuation', level: 'Mandatory', traineesEnrolled: 2100, completed: 2060, rate: '98.1%', center: 'All Centers' },
      ],
    };
  } else if (type === 'ENROLLMENT_REPORT') {
    reportData = {
      title: 'Global Enrollment Pipeline & Conversion Report',
      generatedAt: new Date().toISOString(),
      summary: {
        applications: 1420,
        approved: 1280,
        paid: 1190,
        enrolled: 1150,
        completed: 840,
        conversionRate: '83.8%',
      },
      records: [
        { period: '2026 Q2', center: 'Manila Maritime Flagship', applications: 780, approved: 720, enrolled: 650, completionRate: '97.2%' },
        { period: '2026 Q2', center: 'Cebu Maritime Training', applications: 410, approved: 360, enrolled: 320, completionRate: '95.8%' },
        { period: '2026 Q2', center: 'Davao Nautical Center', applications: 230, approved: 200, enrolled: 180, completionRate: '94.5%' },
      ],
    };
  } else if (type === 'PAYMENT_SUMMARY') {
    reportData = {
      title: 'Executive Financial Summary & Training Revenue Report',
      generatedAt: new Date().toISOString(),
      summary: {
        monthlyRevenue: '₱ 8,450,200',
        approvedPayments: 1190,
        pendingVerification: 14,
        rejectedPayments: 18,
      },
      records: [
        { batchId: 'PAY-2026-06-A', center: 'Manila Flagship', transactions: 620, totalAmount: '₱ 4,680,000', status: 'Settled', method: 'DragonPay / Online Transfer' },
        { batchId: 'PAY-2026-06-B', center: 'Cebu Institute', transactions: 360, totalAmount: '₱ 2,340,000', status: 'Settled', method: 'BayanPay / Credit Card' },
        { batchId: 'PAY-2026-06-C', center: 'Davao Center', transactions: 210, totalAmount: '₱ 1,430,200', status: 'Settled', method: 'Direct Bank Deposit' },
      ],
    };
  } else if (type === 'SECURITY_REPORT') {
    reportData = {
      title: 'NEWSIM Enterprise Security & Audit Log Report',
      generatedAt: new Date().toISOString(),
      summary: {
        mfaCoverage: '98.5%',
        failedAttempts24h: 7,
        lockedAccounts: 2,
        activeSessions: 24,
      },
      records: db.getSecurityEvents().map((e) => ({
        id: e.id,
        timestamp: new Date(e.timestamp).toLocaleString(),
        type: e.eventType,
        severity: e.severity,
        target: e.targetUser || 'N/A',
        ipAddress: e.ipAddress,
        status: e.resolved ? 'Resolved' : 'Active / Unresolved',
        details: e.description,
      })),
    };
  } else {
    reportData = {
      title: 'Global System Activity & Governance Report',
      generatedAt: new Date().toISOString(),
      summary: {
        totalAuditEvents: db.getAuditLogs().length,
        systemStatus: 'OPERATIONAL',
        centersCount: db.getTrainingCenters().length,
      },
      records: db.getAuditLogs().slice(0, 50).map((l) => ({
        id: l.id,
        timestamp: new Date(l.timestamp).toLocaleString(),
        actor: l.actorEmail,
        role: l.actorRole,
        action: l.action,
        target: l.targetId || l.targetType || 'N/A',
        status: l.status,
        ipAddress: l.ipAddress,
      })),
    };
  }

  return NextResponse.json({
    success: true,
    data: reportData,
  });
}

export async function POST(req: NextRequest) {
  const auth = verifySuperAdminRequest(req, 'REPORT_EXPORT');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { reportType, format, filter } = body;

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // Log the mandatory audit event: SUPER_ADMIN_EXPORTED_REPORT
    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: 'SUPER_ADMIN_EXPORTED_REPORT',
      targetType: 'REPORT',
      targetId: reportType,
      details: {
        reportType,
        format: format || 'CSV',
        filter: filter || 'ALL',
        timestamp: new Date().toISOString(),
      },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    return NextResponse.json({
      success: true,
      message: `Report ${reportType} exported successfully. Audit event recorded.`,
      exportMeta: {
        reportType,
        format: format || 'CSV',
        exportedBy: auth.user.email,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to process report export.' },
      { status: 500 }
    );
  }
}
