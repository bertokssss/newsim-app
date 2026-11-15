import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const course = db.getCourseById(id);
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const trainees = db.getInstructorTrainees('usr-ins-01');
    const materials = db.getInstructorMaterials(course.id, 'usr-ins-01');
    const assessments = db.getInstructorAssessments('usr-ins-01').filter((a) => a.courseId === course.id);
    const schedules = db.getInstructorSchedules('usr-ins-01').filter((s) => s.courseId === course.id);

    return NextResponse.json({
      success: true,
      data: {
        ...course,
        trainees,
        materials,
        assessments,
        schedules,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load course details' }, { status: 500 });
  }
}
