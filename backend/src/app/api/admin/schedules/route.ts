import { NextResponse } from 'next/server';
import { db, ScheduleRecord } from '@newsim/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '';
    const status = searchParams.get('status') || 'ALL';
    const instructorId = searchParams.get('instructorId') || 'ALL';

    let schedules = db.getSchedules();

    if (date) {
      schedules = schedules.filter((s) => s.date === date);
    }

    if (status !== 'ALL') {
      schedules = schedules.filter((s) => s.status === status);
    }

    if (instructorId !== 'ALL') {
      schedules = schedules.filter((s) => s.instructorId === instructorId);
    }

    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load schedules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { courseId, instructorId, room, date, startTime, endTime, capacity } = body;

    const course = db.getCourseById(courseId);
    const instructor = instructorId ? db.getUserById(instructorId) : undefined;
    const center = course ? db.getTrainingCenterById(course.centerId) : undefined;

    // Check for scheduling conflicts
    const allSchedules = db.getSchedules();
    const conflict = allSchedules.find(
      (s) =>
        s.date === date &&
        s.room.toLowerCase() === room.toLowerCase() &&
        s.status !== 'CANCELLED' &&
        s.startTime === startTime
    );

    if (conflict) {
      return NextResponse.json(
        { success: false, error: `Room conflict detected! ${room} is already booked for ${conflict.courseCode} at ${startTime}.` },
        { status: 409 }
      );
    }

    const newSchedule: ScheduleRecord = {
      id: `sch-${Date.now()}`,
      sessionCode: `SES-${startTime.replace(/[^a-zA-Z0-9]/g, '')}-${course?.code || 'CRS'}`,
      courseId: course?.id || 'crs-001',
      courseCode: course?.code || 'BST-01',
      courseTitle: course?.title || 'STCW Basic Safety Training',
      instructorId: instructor?.id || 'usr-ins-01',
      instructorName: instructor ? `${instructor.firstName} ${instructor.lastName}` : 'Capt. Arthur Bautista',
      centerId: center?.id || 'tc-01',
      centerName: center?.name || 'Manila Maritime Flagship',
      room: room || 'Bridge Simulator Alpha',
      date: date || new Date().toISOString().split('T')[0],
      startTime: startTime || '08:00 AM',
      endTime: endTime || '12:00 PM',
      capacity: parseInt(capacity, 10) || 16,
      enrolledCount: 0,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createSchedule(newSchedule);

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'SCHEDULE_CREATED',
      targetType: 'SCHEDULE',
      targetId: newSchedule.id,
      details: { sessionCode: newSchedule.sessionCode, room: newSchedule.room, date: newSchedule.date },
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, schedule: newSchedule });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create schedule' }, { status: 500 });
  }
}
