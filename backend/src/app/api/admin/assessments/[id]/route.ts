import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const assessment = db.getAssessmentById(id);
    if (!assessment) {
      return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: assessment });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = db.updateAssessment(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update assessment' }, { status: 500 });
  }
}
