import { NextResponse } from 'next/server';
import { db, EnrollmentRecord } from '@newsim/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    let enrollments = db.getEnrollments();

    if (search) {
      enrollments = enrollments.filter(
        (e) =>
          e.enrollmentNo.toLowerCase().includes(search) ||
          e.traineeName.toLowerCase().includes(search) ||
          e.traineeEmail.toLowerCase().includes(search) ||
          e.courseTitle.toLowerCase().includes(search)
      );
    }

    if (status !== 'ALL') {
      enrollments = enrollments.filter((e) => e.status === status);
    }

    return NextResponse.json({ success: true, data: enrollments });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load enrollments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { traineeId, courseId } = body;

    const trainee = db.getTraineeById(traineeId);
    const course = db.getCourseById(courseId);

    if (!trainee || !course) {
      return NextResponse.json({ success: false, error: 'Trainee and Course are required' }, { status: 400 });
    }

    const newEnrollment: EnrollmentRecord = {
      id: `enr-${Date.now()}`,
      enrollmentNo: `ENR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      traineeId: trainee.id,
      traineeName: `${trainee.firstName} ${trainee.lastName}`,
      traineeEmail: trainee.email,
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      centerId: course.centerId,
      centerName: course.centerName,
      status: 'APPROVED',
      paymentStatus: 'PENDING',
      paymentAmount: course.fee,
      appliedAt: new Date().toISOString(),
      enrolledAt: new Date().toISOString(),
    };

    db.createEnrollment(newEnrollment);

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'ENROLLMENT_CREATED',
      targetType: 'ENROLLMENT',
      targetId: newEnrollment.id,
      details: { enrollmentNo: newEnrollment.enrollmentNo, trainee: newEnrollment.traineeName },
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, enrollment: newEnrollment });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create enrollment' }, { status: 500 });
  }
}
