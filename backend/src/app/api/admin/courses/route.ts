import { NextResponse } from 'next/server';
import { db, CourseRecord } from '@newsim/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const category = searchParams.get('category') || 'ALL';
    const status = searchParams.get('status') || 'ALL';

    let courses = db.getCourses();

    if (search) {
      courses = courses.filter(
        (c) =>
          c.code.toLowerCase().includes(search) ||
          c.title.toLowerCase().includes(search) ||
          c.category.toLowerCase().includes(search) ||
          c.instructorName.toLowerCase().includes(search)
      );
    }

    if (category !== 'ALL') {
      courses = courses.filter((c) => c.category === category);
    }

    if (status !== 'ALL') {
      courses = courses.filter((c) => c.status === status);
    }

    return NextResponse.json({ success: true, data: courses });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load courses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, title, category, description, durationHours, capacity, fee, instructorId, centerId, prerequisites } = body;

    if (!code || !title) {
      return NextResponse.json({ success: false, error: 'Course code and title are required' }, { status: 400 });
    }

    const instructor = instructorId ? db.getUserById(instructorId) : undefined;
    const center = centerId ? db.getTrainingCenterById(centerId) : undefined;

    const newCourse: CourseRecord = {
      id: `crs-${Date.now()}`,
      code: code.toUpperCase(),
      title,
      category: category || 'STCW Mandatory',
      description: description || '',
      durationHours: parseInt(durationHours, 10) || 40,
      trainingDays: Math.ceil((parseInt(durationHours, 10) || 40) / 8),
      capacity: parseInt(capacity, 10) || 20,
      fee: parseFloat(fee) || 10000,
      prerequisites: prerequisites || ['Medical Fitness Certificate'],
      instructorId: instructor?.id || 'usr-ins-01',
      instructorName: instructor ? `${instructor.firstName} ${instructor.lastName}` : 'Capt. Arthur Bautista',
      centerId: center?.id || 'tc-01',
      centerName: center?.name || 'Manila Maritime Flagship',
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createCourse(newCourse);

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'COURSE_CREATED',
      targetType: 'COURSE',
      targetId: newCourse.id,
      details: { code: newCourse.code, title: newCourse.title },
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, course: newCourse });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create course' }, { status: 500 });
  }
}
