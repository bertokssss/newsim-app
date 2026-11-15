import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string; questionId: string }> }
) {
  const { id, assessmentId, questionId } = await params;
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { questionText, questionType, points, choices } = body;

    const updates: Record<string, any> = {};
    if (questionText !== undefined) updates.question_text = String(questionText).trim();
    if (questionType !== undefined) updates.question_type = String(questionType).toUpperCase();
    if (points !== undefined) updates.points = Number(points) > 0 ? Number(points) : 1;

    // Update question
    const { data: updatedQuestion, error: qErr } = await supabaseAdmin
      .from('assessment_questions')
      .update(updates)
      .eq('id', questionId)
      .eq('assessment_id', assessmentId)
      .select()
      .single();

    if (qErr) throw qErr;

    // If choices are provided, replace them
    let currentChoices: any[] = [];
    if (Array.isArray(choices)) {
      await supabaseAdmin.from('assessment_choices').delete().eq('question_id', questionId);

      const choicesToInsert = choices
        .map((c: any, idx: number) => ({
          question_id: questionId,
          choice_text: String(c.choice_text || c.text || '').trim(),
          is_correct: Boolean(c.is_correct ?? c.isCorrect),
          sort_order: c.sort_order ?? idx + 1,
        }))
        .filter((c) => c.choice_text.length > 0);

      if (choicesToInsert.length > 0) {
        const { data: cData, error: cErr } = await supabaseAdmin
          .from('assessment_choices')
          .insert(choicesToInsert)
          .select()
          .order('sort_order', { ascending: true });

        if (cErr) throw cErr;
        currentChoices = cData || [];
      }
    } else {
      const { data: cData } = await supabaseAdmin
        .from('assessment_choices')
        .select('*')
        .eq('question_id', questionId)
        .order('sort_order', { ascending: true });
      currentChoices = cData || [];
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_ASSESSMENT_QUESTION_UPDATED',
      entityType: 'ASSESSMENT_QUESTION',
      entityId: questionId,
      details: { assessmentId, courseId: id, questionText: updatedQuestion.question_text },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({
      success: true,
      question: {
        ...updatedQuestion,
        assessment_choices: currentChoices,
      },
    });
  } catch (error: any) {
    console.error('Failed to update question:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update question' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string; questionId: string }> }
) {
  const { id, assessmentId, questionId } = await params;
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    // Delete choices first if any just in case
    await supabaseAdmin.from('assessment_choices').delete().eq('question_id', questionId);

    const { error } = await supabaseAdmin
      .from('assessment_questions')
      .delete()
      .eq('id', questionId)
      .eq('assessment_id', assessmentId);

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_ASSESSMENT_QUESTION_DELETED',
      entityType: 'ASSESSMENT_QUESTION',
      entityId: questionId,
      details: { assessmentId, courseId: id },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete question:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete question' }, { status: 500 });
  }
}
