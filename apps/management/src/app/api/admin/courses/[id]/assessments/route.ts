import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  ASSESSMENT_SELECT,
  formatAssessment,
  isAdminContext,
  requireAdmin,
  resolveAssessmentModuleId,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { data, error } = await supabaseAdmin
      .from('assessments')
      .select(ASSESSMENT_SELECT)
      .eq('course_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: (data || []).map((row: any) => formatAssessment(row)) });
  } catch (error: any) {
    console.error('Failed to load course assessments:', error);
    return NextResponse.json({ success: false, error: 'Failed to load course assessments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { title, type, passingScore, durationMinutes, description, moduleId } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Assessment title is required' }, { status: 400 });
    }

    const resolvedModule = await resolveAssessmentModuleId(id, moduleId);
    if (resolvedModule.error) {
      return NextResponse.json({ success: false, error: resolvedModule.error }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('assessments')
      .insert({
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        course_id: id,
        module_id: resolvedModule.moduleId,
        assessment_type: (type || 'WRITTEN').toUpperCase(),
        passing_score: !isNaN(Number(passingScore)) ? Number(passingScore) : 75,
        duration_minutes: parseInt(durationMinutes, 10) || 60,
        status: 'PUBLISHED',
      })
      .select(ASSESSMENT_SELECT)
      .single();

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_ASSESSMENT_CREATED',
      entityType: 'ASSESSMENT',
      entityId: data.id,
      details: { title: data.title, courseId: id, type: data.assessment_type },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true, assessment: formatAssessment(data) });
  } catch (error: any) {
    console.error('Failed to create course assessment:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create assessment' }, { status: 500 });
  }
}
