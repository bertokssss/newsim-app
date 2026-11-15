import { NextRequest, NextResponse } from 'next/server';
import { getAdminLeavesList } from '@newsim/database';
import { isAdminContext, requireAdmin } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'LEAVE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search') || '';

    const leaves = await getAdminLeavesList({ status, search });
    return NextResponse.json({ success: true, data: leaves });
  } catch (error: any) {
    console.error('Failed to load leaves for admin:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load leave requests' },
      { status: 500 }
    );
  }
}
