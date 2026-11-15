import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  applyCenterFilter,
  formatInstructor,
  INSTRUCTOR_SELECT,
  isAdminContext,
  matchesSearch,
  requireAdmin,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'INSTRUCTOR_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const centerId = searchParams.get('centerId') || 'ALL';

    let query = supabaseAdmin.from('instructors').select(INSTRUCTOR_SELECT);
    query = applyCenterFilter(query, centerId !== 'ALL' ? centerId : ctx.centerId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    const instructors = (data || []).map(formatInstructor);
    const instructorIds = instructors.map((i: any) => i.instructorId).filter(Boolean);

    let schedules: any[] = [];
    if (instructorIds.length) {
      const { data: scheduleRows } = await supabaseAdmin
        .from('schedules')
        .select('id, instructor_id, status, course_id')
        .in('instructor_id', instructorIds);
      schedules = scheduleRows || [];
    }

    const withCounts = instructors.map((instructor: any) => {
      const assigned = schedules.filter((s) => s.instructor_id === instructor.instructorId);
      return {
        ...instructor,
        activeCoursesCount: new Set(assigned.map((s) => s.course_id)).size,
        upcomingSessionsCount: assigned.filter((s) =>
          ['SCHEDULED', 'ONGOING'].includes((s.status || '').toUpperCase())
        ).length,
      };
    });

    const filtered = search
      ? withCounts.filter((i: any) =>
          matchesSearch([i.firstName, i.lastName, i.email, i.specialization], search)
        )
      : withCounts;

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    console.error('Failed to load instructors:', error);
    return NextResponse.json({ success: false, error: 'Failed to load instructors' }, { status: 500 });
  }
}
