import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminContext } from '@/lib/admin-api';
import { getGradingPoliciesList, saveGradingPolicy } from '@newsim/database';

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, { permission: 'ASSESSMENT_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const list = await getGradingPoliciesList();
    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    console.error('Failed to load grading policies:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load grading policies' },
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
      name,
      attendanceWeight,
      practicalWeight,
      moduleQuizWeight,
      passingGrade,
      minAttendancePct,
      lateCreditPct,
      excusedMode,
      practicalCompetencyRequired,
      status,
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Policy name is required' }, { status: 400 });
    }

    const saved = await saveGradingPolicy({
      id,
      courseId,
      name,
      attendanceWeight: Number(attendanceWeight) || 0,
      practicalWeight: Number(practicalWeight) || 0,
      moduleQuizWeight: Number(moduleQuizWeight) || 0,
      passingGrade: Number(passingGrade) || 75,
      minAttendancePct: Number(minAttendancePct) || 80,
      lateCreditPct: Number(lateCreditPct) || 75,
      excusedMode,
      practicalCompetencyRequired,
      status,
      userId: ctx.user.id,
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    console.error('Failed to save grading policy:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save grading policy' },
      { status: 400 }
    );
  }
}
