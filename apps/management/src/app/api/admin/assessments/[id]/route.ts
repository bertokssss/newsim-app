import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  ASSESSMENT_SELECT,
  formatAssessment,
  isAdminContext,
  requireAdmin,
  resolveAssessmentModuleId,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('assessments')
      .select(ASSESSMENT_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: formatAssessment(data) });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();
    const { data: existing } = await supabaseAdmin
      .from('assessments')
      .select('id, course_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
    }

    const targetCourseId = body.courseId !== undefined ? body.courseId : existing.course_id;
    const resolvedModule = await resolveAssessmentModuleId(targetCourseId, body.moduleId);
    if (resolvedModule.error) {
      return NextResponse.json({ success: false, error: resolvedModule.error }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.description !== undefined) updates.description = String(body.description || '').trim() || null;
    if (body.courseId !== undefined) updates.course_id = body.courseId;
    if (resolvedModule.provided) updates.module_id = resolvedModule.moduleId;
    if (body.type !== undefined) updates.assessment_type = String(body.type).toUpperCase();
    if (body.passingScore !== undefined) updates.passing_score = !isNaN(Number(body.passingScore)) ? Number(body.passingScore) : 75;
    if (body.durationMinutes !== undefined) updates.duration_minutes = parseInt(body.durationMinutes, 10);
    if (body.status !== undefined) updates.status = String(body.status).toUpperCase();

    const { data, error } = await supabaseAdmin
      .from('assessments')
      .update(updates)
      .eq('id', id)
      .select(ASSESSMENT_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: formatAssessment(data) });
  } catch (error) {
    console.error('Failed to update assessment:', error);
    return NextResponse.json({ success: false, error: 'Failed to update assessment' }, { status: 500 });
  }
}
