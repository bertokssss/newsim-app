import { NextRequest, NextResponse } from 'next/server';
import { getUnreadNotificationCount, supabaseAdmin } from '@newsim/database';
import {
  applyCenterFilter,
  isAdminContext,
  requireAdmin,
  unwrap,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

const SIDEBAR_CACHE_TTL_MS = 15_000; // 15 seconds
const sidebarCountsCache = new Map<
  string,
  { data: Record<string, any>; expiresAt: number }
>();

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!isAdminContext(ctx)) return ctx;

  const perms = ctx.permissions || [];
  const cacheKey = `${ctx.centerId || 'ALL'}:${ctx.user.id}:${perms.slice().sort().join(',')}`;
  const now = Date.now();
  const cached = sidebarCountsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({
      success: true,
      data: cached.data,
    });
  }

  try {
    /* ──────────────────────────────────────────────────────────────
     * Fire all count queries in parallel for speed.
     * Each query is scoped to the admin's training center when
     * applicable (SUPER_ADMIN sees everything).
     * ──────────────────────────────────────────────────────────── */

    let traineeQuery = supabaseAdmin
      .from('trainees')
      .select('profile_id', { count: 'exact', head: true });
    traineeQuery = applyCenterFilter(traineeQuery, ctx.centerId);

    let instructorQuery = supabaseAdmin
      .from('instructors')
      .select('profile_id', { count: 'exact', head: true });
    instructorQuery = applyCenterFilter(instructorQuery, ctx.centerId);

    let courseQuery = supabaseAdmin
      .from('courses')
      .select('id', { count: 'exact', head: true });
    courseQuery = applyCenterFilter(courseQuery, ctx.centerId);

    let enrollmentQuery = supabaseAdmin
      .from('enrollments')
      .select('id', { count: 'exact', head: true });
    enrollmentQuery = applyCenterFilter(enrollmentQuery, ctx.centerId);

    // Pending payments – only query if admin has financial permissions
    const pendingPaymentQuery = ctx.hasFinancialAccess
      ? ctx.centerId
        ? supabaseAdmin
            .from('payments')
            .select('id, enrollments!inner(training_center_id)', { count: 'exact', head: true })
            .eq('status', 'PENDING')
            .eq('enrollments.training_center_id', ctx.centerId)
        : supabaseAdmin
            .from('payments')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'PENDING')
      : Promise.resolve({ count: 0 });

    let certificateQuery = supabaseAdmin
      .from('certificates')
      .select('id', { count: 'exact', head: true });

    const notificationQuery = getUnreadNotificationCount(ctx.user.id, 'ADMIN', {
      canViewPayments: ctx.hasFinancialAccess,
      permissions: ctx.user.permissions,
    });

    const [
      traineesRes,
      instructorsRes,
      coursesRes,
      enrollmentsRes,
      pendingPaymentsRes,
      certificatesRes,
      unreadNotificationsCount,
    ] = await Promise.all([
      traineeQuery,
      instructorQuery,
      courseQuery,
      enrollmentQuery,
      pendingPaymentQuery,
      certificateQuery,
      notificationQuery,
    ]);

    const responseData = {
      trainees: traineesRes.count ?? 0,
      instructors: instructorsRes.count ?? 0,
      courses: coursesRes.count ?? 0,
      enrollments: enrollmentsRes.count ?? 0,
      pendingPayments: (pendingPaymentsRes as any).count ?? 0,
      certificates: certificatesRes.count ?? 0,
      unreadNotifications: unreadNotificationsCount ?? 0,
      hasFinancialAccess: ctx.hasFinancialAccess,
      permissions: perms,
    };

    sidebarCountsCache.set(cacheKey, {
      data: responseData,
      expiresAt: now + SIDEBAR_CACHE_TTL_MS,
    });

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error('Failed to load sidebar counts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load sidebar counts' },
      { status: 500 }
    );
  }
}
