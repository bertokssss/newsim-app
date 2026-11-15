import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const data = db.getAdminDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to load admin dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error loading dashboard metrics' },
      { status: 500 }
    );
  }
}
