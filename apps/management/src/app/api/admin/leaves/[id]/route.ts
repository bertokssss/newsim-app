import { NextRequest, NextResponse } from 'next/server';
import { reviewAdminLeaveRequest } from '@newsim/database';
import { isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'LEAVE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id: leaveId } = await params;
    const body = await request.json();
    const { action, adminNotes } = body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid action (APPROVE or REJECT) is required' },
        { status: 400 }
      );
    }

    const result = await reviewAdminLeaveRequest(leaveId, action, ctx.user.id, adminNotes);

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: action === 'APPROVE' ? 'LEAVE_REQUEST_APPROVED' : 'LEAVE_REQUEST_REJECTED',
      entityType: 'INSTRUCTOR_LEAVE',
      entityId: leaveId,
      details: {
        action,
        adminNotes,
        instructorId: result.leave.instructor_id,
        overlappingSchedulesCount: result.overlappingSchedules?.length || 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: result.leave,
      overlappingSchedules: result.overlappingSchedules || [],
      message: action === 'APPROVE'
        ? 'Leave request approved successfully.'
        : 'Leave request rejected.',
    });
  } catch (error: any) {
    console.error('Failed to review leave request:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to review leave request' },
      { status: 500 }
    );
  }
}
