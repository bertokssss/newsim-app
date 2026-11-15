import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    let progress = db.getInstructorProgress('usr-ins-01');

    if (search) {
      progress = progress.filter(
        (p) =>
          p.traineeName.toLowerCase().includes(search) ||
          p.srn.toLowerCase().includes(search) ||
          p.rank.toLowerCase().includes(search) ||
          p.courseTitle.toLowerCase().includes(search)
      );
    }

    if (status !== 'ALL') {
      progress = progress.filter((p) => p.status === status);
    }

    return NextResponse.json({ success: true, data: progress });
  } catch (error) {
    console.error('Failed to load trainee progress:', error);
    return NextResponse.json({ success: false, error: 'Failed to load trainee progress' }, { status: 500 });
  }
}
