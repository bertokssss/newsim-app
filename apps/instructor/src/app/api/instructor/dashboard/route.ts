import { NextRequest, NextResponse } from 'next/server';
import { getInstructorDashboardData } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireInstructor(req);
    if (!auth.authorized) return auth.response;
    const instructorId = auth.instructorId;
    const data = await getInstructorDashboardData(instructorId);
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        permissions: auth.permissions,
      },
    });
  } catch (error) {
    console.error('Failed to load instructor dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error loading dashboard metrics' },
      { status: 500 }
    );
  }
}
