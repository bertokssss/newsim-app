import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { ASSESSMENT_SELECT, formatAssessment, isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';
import { readMaterials, readProcedures, resolveMaterialUrlsForResponse, resolveModuleLessonUrls } from '@/lib/course-curriculum';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  let step = 'fetching course';
  try {
    const { data: course, error: cErr } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (cErr) throw new Error(`[Course] ${cErr.message || cErr.code}`);
    if (ctx.centerId && course.training_center_id !== ctx.centerId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Course belongs to another training center' },
        { status: 403 }
      );
    }

    step = 'fetching modules';
    let loadedModules: any[] = [];
    const { data: modules, error: mErr } = await supabaseAdmin
      .from('course_modules')
      .select('*, learning_materials(*)')
      .eq('course_id', id)
      .order('sort_order', { ascending: true });

    if (mErr) {
      console.warn('Failed with relation, trying without:', mErr.message);
      const { data: fallbackModules } = await supabaseAdmin
        .from('course_modules')
        .select('*')
        .eq('course_id', id);
      loadedModules = fallbackModules || [];
    } else {
      loadedModules = modules || [];
    }

    step = 'fetching enrollments count';
    const { count: enrolledCount } = await supabaseAdmin
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', id);

    step = 'fetching assessments';
    let assessments: any[] = [];
    try {
      const { data: asmData, error: aErr } = await supabaseAdmin
        .from('assessments')
        .select(ASSESSMENT_SELECT)
        .eq('course_id', id)
        .order('created_at', { ascending: false });
      if (aErr) {
        console.warn('Failed with relation, trying simple:', aErr.message);
        const { data: simpleAsmData } = await supabaseAdmin
          .from('assessments')
          .select('*, assessment_questions(id)')
          .eq('course_id', id);
        assessments = (simpleAsmData || []).map((row: any) => formatAssessment(row));
      } else {
        assessments = (asmData || []).map((row: any) => formatAssessment(row));
      }
    } catch (aErr) {
      console.warn('Failed to fetch course assessments:', aErr);
    }

    step = 'fetching materials and procedures';
    const rawMaterials = await readMaterials(id);
    const materials = await resolveMaterialUrlsForResponse(rawMaterials);
    const resolvedModules = await resolveModuleLessonUrls(loadedModules);
    const procedures = await readProcedures(id);

    const isFullModular =
      String(course.category || '').toLowerCase().includes('in-house') ||
      String(course.category || '').toLowerCase().includes('in house') ||
      (String(course.category || '').toLowerCase().includes('modular') &&
        !String(course.category || '').toLowerCase().includes('practical')) ||
      (course.practical_days !== undefined && course.practical_days !== null && Number(course.practical_days) === 0);
    const rawTotalDays = Math.ceil((course.duration_hours || 40) / 8) || 1;
    const theoryDays = isFullModular
      ? Math.min(3, rawTotalDays)
      : (course.theory_days ?? (rawTotalDays <= 1 ? 1 : Math.max(1, Math.round(rawTotalDays * 0.4))));
    const practicalDays = isFullModular
      ? 0
      : (course.practical_days ?? Math.max(0, rawTotalDays - theoryDays));
    const totalDays = isFullModular ? theoryDays : theoryDays + practicalDays;

    return NextResponse.json({ 
      success: true, 
      course: {
        ...course,
        trainingDays: totalDays,
        theory_days: theoryDays,
        practical_days: practicalDays,
        theoryDays,
        practicalDays,
        capacity: Math.min(Math.max(1, Number(course.capacity || 24)), 24),
        enrolledCount: enrolledCount || 0,
      }, 
      modules: resolvedModules, 
      assessments,
      materials,
      procedures,
    });
  } catch (error: any) {
    console.error(`Failed at ${step}:`, error);
    return NextResponse.json({ success: false, error: 'Failed to load course details', details: error.message || error.toString() }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { data: existingCourse } = await supabaseAdmin
      .from('courses')
      .select('id, training_center_id, category')
      .eq('id', id)
      .maybeSingle();

    if (!existingCourse) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }
    if (ctx.centerId && existingCourse.training_center_id !== ctx.centerId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Course belongs to another training center' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, code, title, name, category, description, duration_hours, durationHours, capacity, fee, price, theory_days, theoryDays, practical_days, practicalDays } = body;

    const updates: any = {};
    if (status !== undefined) {
      const s = String(status).toUpperCase().trim();
      if (['DISABLED', 'SUSPENDED', 'INACTIVE', 'OFF'].includes(s)) {
        updates.status = 'SUSPENDED';
      } else if (['ACTIVE', 'ENABLED', 'PUBLISHED', 'ON'].includes(s)) {
        updates.status = 'PUBLISHED';
      } else if (['DRAFT', 'ARCHIVED'].includes(s)) {
        updates.status = s;
      } else {
        updates.status = 'SUSPENDED';
      }
    }
    if (code !== undefined) updates.code = String(code).trim().toUpperCase();
    if (title !== undefined || name !== undefined) {
      updates.name = String(title ?? name).trim();
    }
    if (category !== undefined) updates.category = category;
    if (description !== undefined) updates.description = description;
    if (duration_hours !== undefined || durationHours !== undefined) {
      updates.duration_hours = parseInt(duration_hours ?? durationHours, 10) || 40;
    }
    if (capacity !== undefined) {
      updates.capacity = Math.min(Math.max(1, parseInt(capacity, 10) || 24), 24);
    }
    if (fee !== undefined || price !== undefined) {
      updates.price = parseFloat(fee ?? price) || 0;
    }
    if (theory_days !== undefined || theoryDays !== undefined) {
      const td = parseInt(theory_days ?? theoryDays, 10);
      if (!isNaN(td) && td >= 1) updates.theory_days = td;
    }
    if (practical_days !== undefined || practicalDays !== undefined) {
      const pd = parseInt(practical_days ?? practicalDays, 10);
      if (!isNaN(pd) && pd >= 0) updates.practical_days = pd;
    }

    const effectiveCat = String(updates.category ?? existingCourse.category ?? '').toLowerCase();
    if (
      effectiveCat.includes('in-house') ||
      effectiveCat.includes('in house') ||
      (effectiveCat.includes('modular') && !effectiveCat.includes('practical'))
    ) {
      updates.practical_days = 0;
      const effHours = Number(updates.duration_hours ?? 24);
      updates.theory_days = Math.min(3, Math.max(1, Math.ceil(effHours / 8)));
    }

    const { data: updatedCourse, error } = await supabaseAdmin
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_UPDATED',
      entityType: 'COURSE',
      entityId: id,
      details: updates,
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true, data: updatedCourse || updates, course: updatedCourse });
  } catch (error: any) {
    console.error('Failed to update course:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update course' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { data: existingCourse } = await supabaseAdmin
      .from('courses')
      .select('id, training_center_id, category')
      .eq('id', id)
      .maybeSingle();

    if (!existingCourse) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }
    if (ctx.centerId && existingCourse.training_center_id !== ctx.centerId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Course belongs to another training center' },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_DELETED',
      entityType: 'COURSE',
      entityId: id,
      details: { deleted: true },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete course:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete course' }, { status: 500 });
  }
}
