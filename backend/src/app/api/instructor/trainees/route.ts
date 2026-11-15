import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    let trainees = db.getInstructorTrainees('usr-ins-01');

    if (search) {
      trainees = trainees.filter(
        (t) =>
          t.firstName.toLowerCase().includes(search) ||
          t.lastName.toLowerCase().includes(search) ||
          t.email.toLowerCase().includes(search) ||
          t.srn.toLowerCase().includes(search) ||
          t.rank.toLowerCase().includes(search)
      );
    }

    if (status !== 'ALL') {
      trainees = trainees.filter((t) => t.status === status);
    }

    return NextResponse.json({ success: true, data: trainees });
  } catch (error) {
    console.error('Failed to load trainees:', error);
    return NextResponse.json({ success: false, error: 'Failed to load trainees' }, { status: 500 });
  }
}
