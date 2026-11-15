import { NextRequest, NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = db.deleteLearningMaterial(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Material not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Material archived' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to archive material' }, { status: 500 });
  }
}
