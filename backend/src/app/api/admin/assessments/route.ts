import { NextResponse } from 'next/server';
import { db, AssessmentRecord } from '@newsim/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const type = searchParams.get('type') || 'ALL';

    let assessments = db.getAssessments();

    if (search) {
      assessments = assessments.filter(
        (a) =>
          a.code.toLowerCase().includes(search) ||
          a.title.toLowerCase().includes(search) ||
          a.courseTitle.toLowerCase().includes(search)
      );
    }

    if (type !== 'ALL') {
      assessments = assessments.filter((a) => a.type === type);
    }

    return NextResponse.json({ success: true, data: assessments });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load assessments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, courseId, type, totalPoints, passingScore, durationMinutes } = body;

    const course = db.getCourseById(courseId || 'crs-001');

    const newAssessment: AssessmentRecord = {
      id: `asm-${Date.now()}`,
      code: `ASM-${course?.code || 'GEN'}-${Date.now().toString().slice(-4)}`,
      title: title || 'Comprehensive Module Assessment',
      courseId: course?.id || 'crs-001',
      courseCode: course?.code || 'BST-01',
      courseTitle: course?.title || 'STCW Basic Safety Training',
      type: type || 'WRITTEN',
      totalPoints: parseInt(totalPoints, 10) || 100,
      passingScore: parseInt(passingScore, 10) || 75,
      durationMinutes: parseInt(durationMinutes, 10) || 60,
      status: 'PUBLISHED',
      submissionsCount: 0,
      passedCount: 0,
      failedCount: 0,
      averageScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createAssessment(newAssessment);

    return NextResponse.json({ success: true, assessment: newAssessment });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create assessment' }, { status: 500 });
  }
}
