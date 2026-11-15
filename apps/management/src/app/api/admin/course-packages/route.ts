import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { isAdminContext, requireAdmin, requestMeta, writeAdminAudit } from '@/lib/admin-api';
import {
  writePackageMaterials,
  writePackageProcedures,
  writePackageAssessments,
  mergeCourseCurricula,
} from '@/lib/course-curriculum';
import { loadCoursePackagesWithFallback, directInsertPackage } from '@/lib/course-packages-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'COURSE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    const packages = await loadCoursePackagesWithFallback(status, search);
    return NextResponse.json({ success: true, data: packages });
  } catch (error: any) {
    console.error('Failed to load course packages:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load course packages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { packageCode, name, description, discount, validityDays, courses } = body;
    const { ip, userAgent } = requestMeta(request);

    if (!packageCode || !name || !courses || courses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Package code, name, and at least one course are required' },
        { status: 400 }
      );
    }

    // Check if package code already exists
    const { data: existing } = await supabaseAdmin
      .from('course_packages')
      .select('id')
      .eq('package_code', packageCode.trim().toUpperCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Package code already exists' },
        { status: 400 }
      );
    }

    // Calculate package price based on regular total - discount
    let regularTotal = 0;
    const courseIds = courses.map((c: any) => c.id);
    
    const { data: courseData, error: courseErr } = await supabaseAdmin
      .from('courses')
      .select('id, price')
      .in('id', courseIds);

    if (courseErr) throw courseErr;

    courseData.forEach((c: any) => {
      regularTotal += Number(c.price || 0);
    });

    const parsedDiscount = parseFloat(discount) || 0;
    const packagePrice = Math.max(0, regularTotal - parsedDiscount);

    // Insert Package with resilient dual-layer fallback
    let packageRow: any = null;
    const { data: insertedPkg, error: insertErr } = await supabaseAdmin
      .from('course_packages')
      .insert({
        package_code: packageCode.trim().toUpperCase(),
        name: name.trim(),
        description: description || '',
        package_price: packagePrice,
        discount: parsedDiscount,
        validity_days: parseInt(validityDays) || 365,
        status: 'ACTIVE',
      })
      .select('*')
      .maybeSingle();

    if (insertErr || !insertedPkg) {
      console.warn('PostgREST package insert error, falling back to direct DB insert:', insertErr?.message);
      const itemsToInsert = courses.map((course: any, index: number) => ({
        course_id: course.id,
        sort_order: index,
      }));
      packageRow = await directInsertPackage(
        {
          package_code: packageCode.trim().toUpperCase(),
          name: name.trim(),
          description: description || '',
          package_price: packagePrice,
          discount: parsedDiscount,
          validity_days: parseInt(validityDays) || 365,
          status: 'ACTIVE',
        },
        itemsToInsert
      );
    } else {
      packageRow = insertedPkg;
      // Insert Package Items
      const itemsToInsert = courses.map((course: any, index: number) => ({
        package_id: packageRow.id,
        course_id: course.id,
        sort_order: index,
      }));

      const { error: itemsErr } = await supabaseAdmin
        .from('course_package_items')
        .insert(itemsToInsert);

      if (itemsErr) {
        await supabaseAdmin.from('course_packages').delete().eq('id', packageRow.id);
        throw itemsErr;
      }
    }

    // ================= MERGE COURSE CONTENT INTO PACKAGE CURRICULUM =================
    try {
      const { mergedMaterials, mergedProcedures } = await mergeCourseCurricula(courses);

      // Fetch and merge assessments from selected courses
      let mergedAssessments: any[] = [];
      try {
        const { data: dbAssessments } = await supabaseAdmin
          .from('assessments')
          .select('*')
          .in('course_id', courseIds);

        mergedAssessments = (dbAssessments || []).map((a: any) => {
          const matchCourse = courses.find((c: any) => c.id === a.course_id);
          return {
            id: a.id,
            title: a.title,
            assessmentType: a.assessment_type || 'WRITTEN',
            passingScore: a.passing_score || 75,
            durationMinutes: a.duration_minutes || 60,
            courseId: a.course_id,
            courseCode: matchCourse?.code || 'COURSE',
            courseTitle: matchCourse?.title || matchCourse?.name || '',
          };
        });
      } catch (assessQueryErr) {
        console.warn('Could not query DB assessments for package courses:', assessQueryErr);
      }

      if (mergedAssessments.length === 0) {
        courses.forEach((c: any) => {
          mergedAssessments.push({
            id: `assess_${c.id}`,
            title: `${c.code} Comprehensive Competency Exam`,
            assessmentType: 'WRITTEN',
            passingScore: 75,
            durationMinutes: 60,
            courseId: c.id,
            courseCode: c.code,
            courseTitle: c.title || c.name,
          });
        });
      }

      // Persist merged package curriculum
      await writePackageMaterials(packageRow.id, mergedMaterials);
      await writePackageProcedures(packageRow.id, mergedProcedures);
      await writePackageAssessments(packageRow.id, mergedAssessments);
    } catch (mergeErr) {
      console.warn('Non-fatal: could not write merged package curriculum files:', mergeErr);
    }

    try {
      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'PACKAGE_CREATED',
        entityType: 'COURSE_PACKAGE',
        entityId: packageRow.id,
        details: {
          code: packageRow.package_code,
          name: packageRow.name,
          includedCourseCount: courses.length,
          mergedCurriculum: true,
        },
        ip,
        userAgent,
      });
    } catch (auditErr) {
      console.warn('Non-fatal: could not write admin audit for package creation:', auditErr);
    }

    return NextResponse.json({ success: true, data: packageRow });
  } catch (error: any) {
    console.error('Failed to create course package:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create course package' }, { status: 500 });
  }
}
