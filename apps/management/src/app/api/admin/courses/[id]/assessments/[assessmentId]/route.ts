import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { ASSESSMENT_SELECT, formatAssessment, isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> }
) {
  const { id, assessmentId } = await params;
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { title, type, passingScore, durationMinutes, status } = body;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updates.title = String(title).trim();
    if (type !== undefined) updates.assessment_type = String(type).toUpperCase();
    if (passingScore !== undefined) updates.passing_score = !isNaN(Number(passingScore)) ? Number(passingScore) : 75;
    if (durationMinutes !== undefined) updates.duration_minutes = parseInt(durationMinutes, 10) || 60;
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabaseAdmin
      .from('assessments')
      .update(updates)
      .eq('id', assessmentId)
      .eq('course_id', id)
      .select(ASSESSMENT_SELECT)
      .single();

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_ASSESSMENT_UPDATED',
      entityType: 'ASSESSMENT',
      entityId: assessmentId,
      details: { courseId: id, title: data.title },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true, assessment: formatAssessment(data) });
  } catch (error: any) {
    console.error('Failed to update assessment:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update assessment' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> }
) {
  const { id, assessmentId } = await params;
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { error } = await supabaseAdmin
      .from('assessments')
      .delete()
      .eq('id', assessmentId)
      .eq('course_id', id);

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_ASSESSMENT_DELETED',
      entityType: 'ASSESSMENT',
      entityId: assessmentId,
      details: { courseId: id },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete assessment:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete assessment' }, { status: 500 });
  }
}
