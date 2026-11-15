import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  ASSESSMENT_SELECT,
  formatAssessment,
  isAdminContext,
  requireAdmin,
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
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.courseId !== undefined) updates.course_id = body.courseId;
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
