import { NextRequest, NextResponse } from 'next/server';
import { getInstructorLeavesList, createInstructorLeaveRequest } from '@newsim/database';
import { requireInstructor } from '@/lib/require-instructor';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireInstructor(req, 'LEAVE_REQUEST');
    if (!auth.authorized) return auth.response;
    const instructorId = auth.instructorId;

    const leaves = await getInstructorLeavesList(instructorId);
    return NextResponse.json({ success: true, data: leaves });
  } catch (error: any) {
    console.error('Failed to load instructor leaves:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load leave requests' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireInstructor(req, 'LEAVE_REQUEST');
    if (!auth.authorized) return auth.response;
    const instructorId = auth.instructorId;
    const body = await req.json();
    const { leaveType, startDate, endDate, reason } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    if (endDate < startDate) {
      return NextResponse.json(
        { success: false, error: 'End date must be on or after start date' },
        { status: 400 }
      );
    }

    const created = await createInstructorLeaveRequest({
      instructorId,
      leaveType: leaveType || 'VACATION',
      startDate,
      endDate,
      reason: reason || '',
    });

    return NextResponse.json({
      success: true,
      data: created,
      message: 'Leave request filed successfully. Awaiting administration review.',
    });
  } catch (error: any) {
    console.error('Failed to file leave request:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to file leave request' },
      { status: 500 }
    );
  }
}
