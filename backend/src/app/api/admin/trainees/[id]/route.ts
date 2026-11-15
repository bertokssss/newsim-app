import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const trainee = db.getTraineeById(id);

    if (!trainee) {
      return NextResponse.json({ success: false, error: 'Trainee not found' }, { status: 404 });
    }

    // Trainee enrollment records
    const enrollments = db.getEnrollments().filter((e) => e.traineeId === id);
    const attendance = db.getAttendance().filter((a) => a.traineeId === id);
    const certificates = db.getCertificates().filter((c) => c.traineeId === id);
    const payments = db.getPayments().filter((p) => p.traineeId === id);

    return NextResponse.json({
      success: true,
      data: {
        ...trainee,
        enrollments,
        attendance,
        certificates,
        payments,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = db.updateTrainee(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Trainee not found' }, { status: 404 });
    }

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'TRAINEE_UPDATED',
      targetType: 'TRAINEE',
      targetId: id,
      details: body,
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update trainee' }, { status: 500 });
  }
}
