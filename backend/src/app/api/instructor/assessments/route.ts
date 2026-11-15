import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const type = searchParams.get('type') || 'ALL';

    let assessments = db.getInstructorAssessments('usr-ins-01');

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
    console.error('Failed to load assessments:', error);
    return NextResponse.json({ success: false, error: 'Failed to load assessments' }, { status: 500 });
  }
}
