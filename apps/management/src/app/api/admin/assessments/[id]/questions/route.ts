import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { data, error } = await supabaseAdmin
      .from('assessment_questions')
      .select('*, assessment_choices(*)')
      .eq('assessment_id', id)
      .order('sort_order', { ascending: true })
      .order('sort_order', { referencedTable: 'assessment_choices', ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, questions: data || [] });
  } catch (error: any) {
    console.error('Failed to load assessment questions:', error);
    return NextResponse.json({ success: false, error: 'Failed to load assessment questions' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { questionText, questionType = 'MULTIPLE_CHOICE', points = 1, choices = [] } = body;

    if (!questionText || !String(questionText).trim()) {
      return NextResponse.json({ success: false, error: 'Question text is required' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('assessment_questions')
      .select('sort_order')
      .eq('assessment_id', id)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSortOrder = (existing?.[0]?.sort_order ?? 0) + 1;

    const { data: question, error: qErr } = await supabaseAdmin
      .from('assessment_questions')
      .insert({
        assessment_id: id,
        question_text: String(questionText).trim(),
        question_type: String(questionType).toUpperCase(),
        points: Number(points) > 0 ? Number(points) : 1,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (qErr) throw qErr;

    let createdChoices: any[] = [];
    if (Array.isArray(choices) && choices.length > 0) {
      const choicesToInsert = choices
        .map((c: any, idx: number) => ({
          question_id: question.id,
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
        createdChoices = cData || [];
      }
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'ASSESSMENT_QUESTION_CREATED',
      entityType: 'ASSESSMENT_QUESTION',
      entityId: question.id,
      details: { assessmentId: id, questionText: question.question_text, choicesCount: createdChoices.length },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({
      success: true,
      question: {
        ...question,
        assessment_choices: createdChoices,
      },
    });
  } catch (error: any) {
    console.error('Failed to create question:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create question' }, { status: 500 });
  }
}
