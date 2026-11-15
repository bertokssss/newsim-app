import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = db.updateSchedule(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'SCHEDULE_UPDATED',
      targetType: 'SCHEDULE',
      targetId: id,
      details: body,
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update schedule' }, { status: 500 });
  }
}
