import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  ASSESSMENT_SELECT,
  formatAssessment,
  isAdminContext,
  matchesSearch,
  requestMeta,
  requireAdmin,
  unwrap,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

async function withAttemptStats(rows: any[]) {
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return rows.map((row) => formatAssessment(row));

  const { data: attempts } = await supabaseAdmin
    .from('assessment_attempts')
    .select('assessment_id, score, status, passed')
    .in('assessment_id', ids);

  const stats = new Map<string, { submissions: number; passed: number; failed: number; total: number }>();
  for (const attempt of attempts || []) {
    const current = stats.get(attempt.assessment_id) || { submissions: 0, passed: 0, failed: 0, total: 0 };
    current.submissions += 1;
    current.total += Number(attempt.score || 0);
    const passed = attempt.passed ?? (attempt.status || '').toString().toUpperCase() === 'PASSED';
    if (passed) current.passed += 1;
    else current.failed += 1;
    stats.set(attempt.assessment_id, current);
  }

  return rows.map((row) => {
    const current = stats.get(row.id);
    return formatAssessment(row, current
      ? {
          submissions: current.submissions,
          passed: current.passed,
          failed: current.failed,
          average: current.submissions ? Math.round(current.total / current.submissions) : 0,
        }
      : undefined);
  });
}

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const type = searchParams.get('type') || 'ALL';

    const { data, error } = await supabaseAdmin
      .from('assessments')
      .select(ASSESSMENT_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const scoped = (data || []).filter((row: any) => {
      if (!ctx.centerId) return true;
      const course = unwrap(row.courses);
      return !course?.training_center_id || course.training_center_id === ctx.centerId;
    });

    let assessments = await withAttemptStats(scoped);
    if (search) {
      assessments = assessments.filter((a) =>
        matchesSearch([a.code, a.title, a.courseTitle, a.courseCode], search)
      );
    }
    if (type !== 'ALL') {
      assessments = assessments.filter((a) => a.type === type.toUpperCase());
    }

    return NextResponse.json({ success: true, data: assessments });
  } catch (error) {
    console.error('Failed to load assessments:', error);
    return NextResponse.json({ success: false, error: 'Failed to load assessments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'ASSESSMENT_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { title, courseId, type, passingScore, durationMinutes } = body;
    const { ip, userAgent } = requestMeta(request);

    if (!title || !courseId) {
      return NextResponse.json(
        { success: false, error: 'Assessment title and course are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('assessments')
      .insert({
        title: String(title).trim(),
        course_id: courseId,
        assessment_type: (type || 'WRITTEN').toUpperCase(),
        passing_score: parseInt(passingScore, 10) || 75,
        duration_minutes: parseInt(durationMinutes, 10) || 60,
        status: 'PUBLISHED',
      })
      .select(ASSESSMENT_SELECT)
      .single();

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'ASSESSMENT_CREATED',
      entityType: 'ASSESSMENT',
      entityId: data.id,
      details: { title: data.title, courseId },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, assessment: formatAssessment(data) });
  } catch (error) {
    console.error('Failed to create assessment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create assessment' }, { status: 500 });
  }
}
