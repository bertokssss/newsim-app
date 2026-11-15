import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId') || 'crs-001';
    const gradebook = db.getInstructorGradebook(courseId, 'usr-ins-01');
    const assessments = db.getInstructorAssessments('usr-ins-01');

    return NextResponse.json({
      success: true,
      data: {
        gradebook,
        assessments,
      },
    });
  } catch (error) {
    console.error('Failed to load gradebook:', error);
    return NextResponse.json({ success: false, error: 'Failed to load gradebook' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { submissionId, score, feedback, reason } = body;

    if (!submissionId || typeof score !== 'number') {
      return NextResponse.json({ success: false, error: 'Submission ID and numerical score are required' }, { status: 400 });
    }

    const updated = db.updateSubmissionGrade(submissionId, score, feedback || '', reason, 'Capt. Arthur Bautista');
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to record grade' }, { status: 500 });
  }
}
