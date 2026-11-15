import { NextRequest, NextResponse } from 'next/server';
import { cancelInstructorLeaveRequest } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireInstructor(req, 'LEAVE_REQUEST');
    if (!auth.authorized) return auth.response;
    const instructorId = auth.instructorId;
    const { id } = await params;

    const cancelled = await cancelInstructorLeaveRequest(id, instructorId);

    if (!cancelled) {
      return NextResponse.json(
        { success: false, error: 'Leave request not found or cannot be cancelled' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: cancelled,
      message: 'Leave request cancelled successfully.',
    });
  } catch (error: any) {
    console.error('Failed to cancel leave request:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel leave request' },
      { status: 500 }
    );
  }
}
