import { NextResponse } from 'next/server';
import { db, AttendanceRecord } from '@newsim/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '';
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search')?.toLowerCase() || '';

    let records = db.getAttendance();

    if (date) {
      records = records.filter((r) => r.date === date);
    }

    if (status !== 'ALL') {
      records = records.filter((r) => r.status === status);
    }

    if (search) {
      records = records.filter(
        (r) =>
          r.traineeName.toLowerCase().includes(search) ||
          r.courseTitle.toLowerCase().includes(search) ||
          r.sessionCode.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load attendance' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, sessionCode, courseId, traineeId, instructorId, room, status, remarks } = body;

    const course = db.getCourseById(courseId);
    const trainee = db.getTraineeById(traineeId);
    const instructor = instructorId ? db.getUserById(instructorId) : undefined;

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      date: date || new Date().toISOString().split('T')[0],
      sessionCode: sessionCode || 'SES-0800',
      courseId: course?.id || 'crs-001',
      courseTitle: course?.title || 'STCW Training',
      traineeId: trainee?.id || 'trn-001',
      traineeName: trainee ? `${trainee.firstName} ${trainee.lastName}` : 'Trainee',
      instructorId: instructor?.id || 'usr-ins-01',
      instructorName: instructor ? `${instructor.firstName} ${instructor.lastName}` : 'Instructor',
      room: room || 'Main Hall',
      status: status || 'PRESENT',
      remarks: remarks || '',
      updatedBy: 'admin@newsim.com',
      updatedAt: new Date().toISOString(),
    };

    db.createAttendance(newRecord);

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'ATTENDANCE_RECORDED',
      targetType: 'ATTENDANCE',
      targetId: newRecord.id,
      details: { session: newRecord.sessionCode, trainee: newRecord.traineeName, status: newRecord.status },
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, record: newRecord });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to record attendance' }, { status: 500 });
  }
}
