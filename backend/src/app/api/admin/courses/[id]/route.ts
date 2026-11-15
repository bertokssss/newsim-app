import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const course = db.getCourseById(id);
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: course });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = db.updateCourse(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'COURSE_UPDATED',
      targetType: 'COURSE',
      targetId: id,
      details: body,
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update course' }, { status: 500 });
  }
}
