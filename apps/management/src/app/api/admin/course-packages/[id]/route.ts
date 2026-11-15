import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { isAdminContext, requireAdmin, requestMeta, writeAdminAudit } from '@/lib/admin-api';
import {
  getLiveMergedPackageCurriculum,
  resolveMaterialUrlsForResponse,
} from '@/lib/course-curriculum';

import { loadCoursePackageByIdWithFallback, directUpdatePackageStatus } from '@/lib/course-packages-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const pkg = await loadCoursePackageByIdWithFallback(id);

    if (!pkg) {
      return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
    }

    // Dynamically resolve live curriculum from bundled courses (AFF, BT, MARPOL, etc.)
    const includedCourses = (pkg.items || [])
      .map((it: any) => it.courses)
      .filter(Boolean);

    const curriculum = await getLiveMergedPackageCurriculum(id, includedCourses);
    if (curriculum && Array.isArray(curriculum.materials)) {
      curriculum.materials = await resolveMaterialUrlsForResponse(curriculum.materials);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...pkg,
        curriculum,
      },
    });
  } catch (error: any) {
    console.error('Failed to get course package:', error);
    return NextResponse.json({ success: false, error: 'Failed to get course package' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();
    const { ip, userAgent } = requestMeta(request);

    // Only allow updating status for now (Archive/Deactivate/Publish/Disable)
    if (body.status) {
      let data: any = null;
      try {
        const res = await supabaseAdmin
          .from('course_packages')
          .update({ status: body.status })
          .eq('id', id)
          .select('*')
          .single();
        if (res.error) throw res.error;
        data = res.data;
      } catch (sbErr) {
        console.warn('Supabase package update failed, falling back to direct DB:', sbErr);
        data = await directUpdatePackageStatus(id, body.status);
      }

      if (!data) {
        return NextResponse.json({ success: false, error: 'Course package not found or could not be updated' }, { status: 404 });
      }

      try {
        await writeAdminAudit({
          actorId: ctx.user.id,
          action: 'PACKAGE_UPDATED',
          entityType: 'COURSE_PACKAGE',
          entityId: data.id,
          details: { code: data.package_code, newStatus: body.status },
          ip,
          userAgent,
        });
      } catch (auditErr) {
        console.warn('Non-fatal: could not write admin audit for package update:', auditErr);
      }

      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: 'Invalid update payload' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update course package:', error);
    return NextResponse.json({ success: false, error: 'Failed to update course package' }, { status: 500 });
  }
}
