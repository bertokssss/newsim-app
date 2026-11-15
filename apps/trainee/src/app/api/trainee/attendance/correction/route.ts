import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Forbidden: Attendance correction requests are disabled for trainees. Only instructors and administrators manage attendance.',
    },
    { status: 403 }
  );
}
