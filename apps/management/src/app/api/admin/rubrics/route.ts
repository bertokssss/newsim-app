import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminContext } from '@/lib/admin-api';
import { getPracticalRubricsList, getPracticalRubricDetails, supabaseAdmin } from '@newsim/database';

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, { permission: 'ASSESSMENT_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId') || undefined;
    const rubrics = await getPracticalRubricsList(courseId);

    return NextResponse.json({ success: true, data: rubrics });
  } catch (error: any) {
    console.error('Failed to load rubrics:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load practical rubrics' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, { permission: 'ASSESSMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await req.json();
    const {
      id,
      courseId,
      assessmentId,
      title,
      stcwReference,
      description,
      instructions,
      passingScore = 75,
      maxScore = 100,
      status = 'ACTIVE',
      criteria = [],
    } = body;

    if (!courseId || !title) {
      return NextResponse.json({ success: false, error: 'courseId and title are required' }, { status: 400 });
    }

    let rubricId = id;

    if (rubricId) {
      const { error: updErr } = await supabaseAdmin
        .from('practical_rubrics')
        .update({
          course_id: courseId,
          assessment_id: assessmentId || null,
          title,
          stcw_reference: stcwReference || '',
          description: description || '',
          instructions: instructions || '',
          passing_score: passingScore,
          max_score: maxScore,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rubricId);
      if (updErr) throw updErr;
    } else {
      const { data: created, error: insErr } = await supabaseAdmin
        .from('practical_rubrics')
        .insert({
          course_id: courseId,
          assessment_id: assessmentId || null,
          title,
          stcw_reference: stcwReference || '',
          description: description || '',
          instructions: instructions || '',
          passing_score: passingScore,
          max_score: maxScore,
          status,
          created_by: ctx.user.id,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      rubricId = created.id;
    }

    // Save criteria if provided
    if (Array.isArray(criteria) && criteria.length > 0) {
      // Delete existing criteria for fresh sync if updating
      if (id) {
        await supabaseAdmin.from('practical_rubric_criteria').delete().eq('rubric_id', rubricId);
      }

      for (let i = 0; i < criteria.length; i++) {
        const c = criteria[i];
        await supabaseAdmin.from('practical_rubric_criteria').insert({
          rubric_id: rubricId,
          criterion_name: c.criterionName || c.criterion_name,
          description: c.description || '',
          competency: c.competency || '',
          performance_indicators: c.performanceIndicators || c.performance_indicators || '',
          max_points: Number(c.maxPoints || c.max_points) || 25,
          weight_pct: Number(c.weightPct || c.weight_pct) || 25,
          sort_order: i + 1,
          is_critical: Boolean(c.isCritical || c.is_critical),
          rating_levels: c.ratingLevels || c.rating_levels || [],
        });
      }
    }

    const savedRubric = await getPracticalRubricDetails(rubricId);
    return NextResponse.json({ success: true, data: savedRubric });
  } catch (error: any) {
    console.error('Failed to save rubric:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save rubric' },
      { status: 500 }
    );
  }
}
