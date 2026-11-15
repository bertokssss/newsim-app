import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'TRAINEES';
    const format = searchParams.get('format') || 'json';

    let reportTitle = '';
    let rows: any[] = [];

    if (type === 'TRAINEES') {
      reportTitle = 'Operational Trainee Roster Report';
      rows = db.getTrainees().map((t) => ({
        ID: t.id,
        Name: `${t.firstName} ${t.lastName}`,
        SRN: t.srn,
        Rank: t.rank,
        VesselType: t.vesselType,
        Campus: t.centerName,
        Status: t.status,
        AttendanceRate: t.attendanceRate,
        Certificates: t.certificatesCount,
      }));
    } else if (type === 'ENROLLMENTS') {
      reportTitle = 'Active & Historical Enrollment Report';
      rows = db.getEnrollments().map((e) => ({
        EnrollmentNo: e.enrollmentNo,
        Trainee: e.traineeName,
        Email: e.traineeEmail,
        Course: e.courseTitle,
        Status: e.status,
        PaymentStatus: e.paymentStatus,
        Amount: `₱${e.paymentAmount.toLocaleString()}`,
        AppliedAt: e.appliedAt,
      }));
    } else if (type === 'PAYMENTS') {
      reportTitle = 'Financial Transactions & Verification Report';
      rows = db.getPayments().map((p) => ({
        PaymentNo: p.paymentNo,
        Trainee: p.traineeName,
        Course: p.courseTitle,
        Amount: `₱${p.amount.toLocaleString()}`,
        Method: p.method,
        ReferenceNo: p.referenceNumber,
        Status: p.status,
        Date: p.createdAt,
      }));
    } else if (type === 'ATTENDANCE') {
      reportTitle = 'Training Attendance & Punctuality Report';
      rows = db.getAttendance().map((a) => ({
        Date: a.date,
        SessionCode: a.sessionCode,
        Course: a.courseTitle,
        Trainee: a.traineeName,
        Instructor: a.instructorName,
        Room: a.room,
        Status: a.status,
        Remarks: a.remarks || 'None',
      }));
    } else if (type === 'CERTIFICATES') {
      reportTitle = 'Issued & Pending Certificates Report';
      rows = db.getCertificates().map((c) => ({
        CertificateNo: c.certificateNo,
        Trainee: c.traineeName,
        Course: c.courseTitle,
        Status: c.status,
        IssueDate: c.issueDate,
        ExpiryDate: c.expiryDate,
        VerificationCode: c.qrVerificationCode,
      }));
    } else if (type === 'SCHEDULES') {
      reportTitle = 'Training Session Schedules Report';
      rows = db.getSchedules().map((s) => ({
        SessionCode: s.sessionCode,
        Course: s.courseTitle,
        Instructor: s.instructorName,
        Campus: s.centerName,
        Room: s.room,
        Date: s.date,
        Time: `${s.startTime} - ${s.endTime}`,
        Enrolled: `${s.enrolledCount} / ${s.capacity}`,
        Status: s.status,
      }));
    }

    if (format === 'csv') {
      if (rows.length === 0) {
        return new Response('No data available', {
          headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${type.toLowerCase()}_report.csv"` },
        });
      }
      const headers = Object.keys(rows[0]).join(',');
      const csvLines = rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
      const csvContent = [headers, ...csvLines].join('\n');

      db.addAuditLog({
        actorEmail: 'admin@newsim.com',
        actorRole: 'ADMIN',
        action: 'REPORT_EXPORTED',
        targetType: 'REPORT',
        targetId: type,
        details: { reportType: type, format: 'CSV', rowCount: rows.length },
        ipAddress: '127.0.0.1',
        userAgent: 'NEWSIM Admin Portal',
        status: 'SUCCESS',
        severity: 'INFO',
      });

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${type.toLowerCase()}_report_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      reportTitle,
      type,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      data: rows,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
