import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const submissions = db.getInstructorSubmissions(id, 'usr-ins-01');
    return NextResponse.json({ success: true, data: submissions });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load submissions' }, { status: 500 });
  }
}
