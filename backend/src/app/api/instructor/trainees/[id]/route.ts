import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const trainee = db.getTraineeById(id);
    if (!trainee) {
      return NextResponse.json({ success: false, error: 'Trainee not found' }, { status: 404 });
    }

    const progress = db.getInstructorProgress('usr-ins-01').find((p) => p.traineeId === trainee.id);
    const submissions = db.getInstructorSubmissions(undefined, 'usr-ins-01').filter((s) => s.traineeId === trainee.id);
    const attendance = db.getInstructorAttendance('usr-ins-01').filter((a) => a.traineeId === trainee.id);

    return NextResponse.json({
      success: true,
      data: {
        ...trainee,
        progress,
        submissions,
        attendance,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load trainee profile' }, { status: 500 });
  }
}
