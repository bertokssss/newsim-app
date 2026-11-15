import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, remarks } = body;

    const existing = db.getAttendanceById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Attendance record not found' }, { status: 404 });
    }

    const updated = db.updateAttendance(id, {
      status,
      remarks,
      updatedBy: 'admin@newsim.com',
    });

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'ATTENDANCE_MODIFIED',
      targetType: 'ATTENDANCE',
      targetId: id,
      details: { previousStatus: existing.status, newStatus: status, reason: remarks },
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'WARNING',
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update attendance' }, { status: 500 });
  }
}
