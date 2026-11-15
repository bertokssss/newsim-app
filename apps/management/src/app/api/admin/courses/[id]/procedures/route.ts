import { NextRequest, NextResponse } from 'next/server';
import { isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';
import { readProcedures, writeProcedures } from '@/lib/course-curriculum';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const steps = await readProcedures(id);
    return NextResponse.json({ success: true, data: steps });
  } catch (error: any) {
    console.error('Failed to read procedural steps:', error);
    return NextResponse.json({ success: false, error: 'Failed to read procedural steps' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { steps } = body;

    if (!Array.isArray(steps)) {
      return NextResponse.json({ success: false, error: 'Steps array is required' }, { status: 400 });
    }

    // Normalize and sort steps
    const normalized = steps.map((s: any, idx: number) => ({
      id: s.id || `step-${Date.now()}-${idx}`,
      stepNumber: idx + 1,
      phase: (s.phase || 'THEORY').toUpperCase(),
      title: String(s.title || '').trim(),
      description: String(s.description || '').trim(),
      hours: Math.max(1, Number(s.hours || 1)),
      mandatory: Boolean(s.mandatory ?? true),
    }));

    await writeProcedures(id, normalized);

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_PROCEDURAL_STEPS_UPDATED',
      entityType: 'COURSE',
      entityId: id,
      details: { stepCount: normalized.length },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true, data: normalized });
  } catch (error: any) {
    console.error('Failed to save procedural steps:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to save procedural steps' }, { status: 500 });
  }
}
