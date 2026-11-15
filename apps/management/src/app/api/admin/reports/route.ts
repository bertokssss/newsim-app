import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { hasModulePermission } from '@newsim/utils';
import {
  applyCenterFilter,
  ATTENDANCE_SELECT,
  CERTIFICATE_SELECT,
  ENROLLMENT_SELECT,
  formatAttendance,
  formatCertificate,
  formatEnrollment,
  formatPayment,
  formatSchedule,
  formatTrainee,
  isAdminContext,
  PAYMENT_SELECT,
  requestMeta,
  requireAdmin,
  SCHEDULE_SELECT,
  unwrap,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return 'No data available';
  const headers = Object.keys(rows[0]).join(',');
  const csvLines = rows.map((r) =>
    Object.values(r)
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return [headers, ...csvLines].join('\n');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get('type') || 'TRAINEES').toUpperCase();
  const isPaymentsReport = type === 'PAYMENTS';

  const ctx = await requireAdmin(
    request,
    isPaymentsReport ? { requireFinancial: true } : { permission: 'REPORT_VIEW' }
  );
  if (!isAdminContext(ctx)) return ctx;

  try {
    const format = searchParams.get('format') || 'json';
    const { ip, userAgent } = requestMeta(request);

    const REPORT_TYPE_PERMS: Record<string, string> = {
      TRAINEES: 'ENROLLMENT_VIEW',
      ENROLLMENTS: 'ENROLLMENT_VIEW',
      PAYMENTS: 'PAYMENT_VIEW',
      ATTENDANCE: 'ATTENDANCE_VIEW',
      CERTIFICATES: 'CERTIFICATE_VIEW',
      SCHEDULES: 'SCHEDULE_VIEW',
    };
    const requiredTypePerm = REPORT_TYPE_PERMS[type];
    if (requiredTypePerm && !hasModulePermission(ctx.permissions, requiredTypePerm, ctx.user.role)) {
      return NextResponse.json(
        { success: false, error: `Insufficient permissions: '${requiredTypePerm}' access is required for ${type} reports.` },
        { status: 403 }
      );
    }

    let reportTitle = '';
    let rows: Record<string, unknown>[] = [];

    if (type === 'TRAINEES') {
      reportTitle = 'Operational Trainee Roster Report';
      let query = supabaseAdmin.from('trainees').select('*, profiles!inner(*), training_centers(name)');
      query = applyCenterFilter(query, ctx.centerId);
      const { data, error } = await query;
      if (error) throw error;
      rows = (data || []).map((t: any) => {
        const trainee = formatTrainee(t);
        return {
          ID: trainee.id,
          Name: `${trainee.firstName} ${trainee.lastName}`,
          SRN: trainee.srn,
          Rank: trainee.rank,
          VesselType: trainee.vesselType,
          Campus: trainee.centerName,
          Status: trainee.status,
          AttendanceRate: trainee.attendanceRate,
          Certificates: trainee.certificatesCount,
        };
      });
    } else if (type === 'ENROLLMENTS') {
      reportTitle = 'Active & Historical Enrollment Report';
      let query = supabaseAdmin.from('enrollments').select(ENROLLMENT_SELECT);
      query = applyCenterFilter(query, ctx.centerId);
      const { data, error } = await query;
      if (error) throw error;
      rows = (data || []).map((e: any) => {
        const enrollment = formatEnrollment(e);
        return {
          EnrollmentNo: enrollment.enrollmentNo,
          Trainee: enrollment.traineeName,
          Email: enrollment.traineeEmail,
          Course: enrollment.courseTitle,
          Status: enrollment.status,
          PaymentStatus: ctx.hasFinancialAccess ? enrollment.paymentStatus : 'RESTRICTED',
          Amount: ctx.hasFinancialAccess ? `₱${Number(enrollment.paymentAmount || 0).toLocaleString()}` : 'RESTRICTED',
          AppliedAt: enrollment.appliedAt,
        };
      });
    } else if (type === 'PAYMENTS') {
      if (!ctx.hasFinancialAccess) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions: financial reports require authorized financial admin access.' },
          { status: 403 }
        );
      }
      reportTitle = 'Financial Transactions & Verification Report';
      const { data, error } = await supabaseAdmin.from('payments').select(PAYMENT_SELECT);
      if (error) throw error;
      rows = (data || [])
        .filter((row: any) => {
          if (!ctx.centerId) return true;
          const enrollment = unwrap(row.enrollments);
          return !enrollment?.training_center_id || enrollment.training_center_id === ctx.centerId;
        })
        .map((p: any) => {
          const payment = formatPayment(p);
          return {
            PaymentNo: payment.paymentNo,
            Trainee: payment.traineeName,
            Course: payment.courseTitle,
            Amount: `₱${Number(payment.amount || 0).toLocaleString()}`,
            Method: payment.method,
            ReferenceNo: payment.referenceNumber,
            Status: payment.status,
            Date: payment.createdAt,
          };
        });
    } else if (type === 'ATTENDANCE') {
      reportTitle = 'Training Attendance & Punctuality Report';
      const { data, error } = await supabaseAdmin.from('attendance').select(ATTENDANCE_SELECT);
      if (error) throw error;
      rows = (data || [])
        .filter((row: any) => {
          if (!ctx.centerId) return true;
          const schedule = unwrap(row.schedules);
          return !schedule?.training_center_id || schedule.training_center_id === ctx.centerId;
        })
        .map((a: any) => {
          const record = formatAttendance(a);
          return {
            Date: record.date,
            SessionCode: record.sessionCode,
            Course: record.courseTitle,
            Trainee: record.traineeName,
            Instructor: record.instructorName,
            Room: record.room,
            Status: record.status,
            Remarks: record.remarks || 'None',
          };
        });
    } else if (type === 'CERTIFICATES') {
      reportTitle = 'Issued & Pending Certificates Report';
      const { data, error } = await supabaseAdmin.from('certificates').select(CERTIFICATE_SELECT);
      if (error) throw error;
      rows = (data || [])
        .filter((row: any) => {
          if (!ctx.centerId) return true;
          const course = unwrap(row.courses);
          return !course?.training_center_id || course.training_center_id === ctx.centerId;
        })
        .map((c: any) => {
          const cert = formatCertificate(c);
          return {
            CertificateNo: cert.certificateNo,
            Trainee: cert.traineeName,
            Course: cert.courseTitle,
            Status: cert.status,
            IssueDate: cert.issueDate,
            ExpiryDate: cert.expiryDate,
            VerificationCode: cert.qrVerificationCode,
          };
        });
    } else if (type === 'SCHEDULES') {
      reportTitle = 'Training Session Schedules Report';
      let query = supabaseAdmin.from('schedules').select(SCHEDULE_SELECT);
      query = applyCenterFilter(query, ctx.centerId);
      const { data, error } = await query;
      if (error) throw error;
      rows = (data || []).map((s: any) => {
        const schedule = formatSchedule(s);
        return {
          SessionCode: schedule.sessionCode,
          Course: schedule.courseTitle,
          Instructor: schedule.instructorName,
          Campus: schedule.centerName,
          Room: schedule.room,
          Date: schedule.date,
          Time: `${schedule.startTime} - ${schedule.endTime}`,
          Enrolled: `${schedule.enrolledCount} / ${schedule.capacity}`,
          Status: schedule.status,
        };
      });
    }

    if (format === 'csv') {
      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'REPORT_EXPORTED',
        entityType: 'REPORT',
        details: { reportType: type, format: 'CSV', rowCount: rows.length },
        ip,
        userAgent,
      });

      return new Response(toCsv(rows), {
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
    console.error('Failed to generate report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
