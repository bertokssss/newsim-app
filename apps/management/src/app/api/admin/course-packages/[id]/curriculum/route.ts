import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { isAdminContext, requireAdmin, requestMeta, writeAdminAudit } from '@/lib/admin-api';
import {
  readPackageMaterials,
  writePackageMaterials,
  readPackageProcedures,
  writePackageProcedures,
  readPackageAssessments,
  writePackageAssessments,
  mergeCourseCurricula,
  getLiveMergedPackageCurriculum,
  resolveMaterialUrlsForResponse,
  ProcedureStep,
} from '@/lib/course-curriculum';
import { loadCoursePackageByIdWithFallback } from '@/lib/course-packages-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const pkg = await loadCoursePackageByIdWithFallback(id);
    const includedCourses = (pkg?.items || []).map((it: any) => it.courses).filter(Boolean);

    const curriculum = await getLiveMergedPackageCurriculum(id, includedCourses);
    const resolvedMaterials = await resolveMaterialUrlsForResponse(curriculum.materials || []);

    return NextResponse.json({
      success: true,
      data: {
        ...curriculum,
        materials: resolvedMaterials,
      },
    });
  } catch (error: any) {
    console.error('Failed to get package curriculum:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load package curriculum' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { ip, userAgent } = requestMeta(request);

    // Case 1: Re-sync / Reset merged curriculum from original bundled courses
    if (body.action === 'RESET_MERGED') {
      const { data: pkg, error: pkgErr } = await supabaseAdmin
        .from('course_packages')
        .select(`
          *,
          items:course_package_items(
            sort_order,
            courses(id, code, name, description, duration_hours, price, category)
          )
        `)
        .eq('id', id)
        .single();

      if (pkgErr || !pkg) {
        return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
      }

      const includedCourses = (pkg.items || []).map((it: any) => it.courses).filter(Boolean);
      if (includedCourses.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Package has no bundled courses to merge from' },
          { status: 400 }
        );
      }

      const { mergedMaterials, mergedProcedures } = await mergeCourseCurricula(includedCourses);

      // Merge assessments from DB for these courses
      const courseIds = includedCourses.map((c: any) => c.id);
      let mergedAssessments: any[] = [];
      try {
        const { data: dbAssess } = await supabaseAdmin
          .from('assessments')
          .select('*')
          .in('course_id', courseIds);

        mergedAssessments = (dbAssess || []).map((a: any) => {
          const match = includedCourses.find((c: any) => c.id === a.course_id);
          return {
            id: a.id,
            title: a.title,
            assessmentType: a.assessment_type || 'WRITTEN',
            passingScore: a.passing_score || 75,
            durationMinutes: a.duration_minutes || 60,
            courseId: a.course_id,
            courseCode: match?.code || 'COURSE',
            courseTitle: match?.name || '',
          };
        });
      } catch (err) {
        console.warn('DB assessment fetch warning on package reset:', err);
      }

      if (mergedAssessments.length === 0) {
        includedCourses.forEach((c: any) => {
          mergedAssessments.push({
            id: `assess_${c.id}`,
            title: `${c.code} Comprehensive Competency Exam`,
            assessmentType: 'WRITTEN',
            passingScore: 75,
            durationMinutes: 60,
            courseId: c.id,
            courseCode: c.code,
            courseTitle: c.name,
          });
        });
      }

      await writePackageMaterials(id, mergedMaterials);
      await writePackageProcedures(id, mergedProcedures);
      await writePackageAssessments(id, mergedAssessments);

      try {
        await writeAdminAudit({
          actorId: ctx.user.id,
          action: 'PACKAGE_CURRICULUM_RESET_MERGED',
          entityType: 'COURSE_PACKAGE',
          entityId: id,
          details: { bundledCourseCount: includedCourses.length },
          ip,
          userAgent,
        });
      } catch (e) {
        console.warn('Audit warning:', e);
      }

      return NextResponse.json({
        success: true,
        data: {
          materials: mergedMaterials,
          procedures: mergedProcedures,
          assessments: mergedAssessments,
        },
      });
    }

    // Case 2: Update Procedures
    if (Array.isArray(body.procedures)) {
      const seenProcIds = new Set<string>();
      const normalizedProcedures: ProcedureStep[] = body.procedures.map((p: any, idx: number) => {
        let stepId = p.id || `pkg-step-${Date.now()}-${idx + 1}`;
        if (seenProcIds.has(stepId)) {
          stepId = `${stepId}-${p.sourceCourseCode || 'step'}-${idx + 1}`;
        }
        seenProcIds.add(stepId);

        return {
          id: stepId,
          stepNumber: idx + 1,
          phase: (p.phase || 'THEORY').toUpperCase(),
          title: String(p.title || '').trim(),
          description: String(p.description || '').trim(),
          hours: Math.max(1, Number(p.hours || 1)),
          mandatory: Boolean(p.mandatory ?? true),
          sourceCourseCode: p.sourceCourseCode,
          sourceCourseTitle: p.sourceCourseTitle,
        };
      });
      await writePackageProcedures(id, normalizedProcedures);
    }

    // Case 3: Update Assessments
    if (Array.isArray(body.assessments)) {
      const seenAssessIds = new Set<string>();
      const normalizedAssessments = body.assessments.map((a: any, idx: number) => {
        let assessId = a.id || `pkg-assess-${Date.now()}-${idx + 1}`;
        if (seenAssessIds.has(assessId)) {
          assessId = `${assessId}-${a.courseCode || 'course'}-${idx + 1}`;
        }
        seenAssessIds.add(assessId);

        return {
          id: assessId,
          title: String(a.title || '').trim(),
          assessmentType: (a.assessmentType || 'WRITTEN').toUpperCase(),
          passingScore: Math.min(100, Math.max(1, Number(a.passingScore || 75))),
          durationMinutes: Math.max(10, Number(a.durationMinutes || 60)),
          courseId: a.courseId || '',
          courseCode: a.courseCode || 'PACKAGE',
          courseTitle: a.courseTitle || '',
        };
      });
      await writePackageAssessments(id, normalizedAssessments);
    }

    // Case 4: Update Materials
    if (Array.isArray(body.materials)) {
      await writePackageMaterials(id, body.materials);
    }

    try {
      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'PACKAGE_CURRICULUM_UPDATED',
        entityType: 'COURSE_PACKAGE',
        entityId: id,
        details: {
          hasProcedures: Array.isArray(body.procedures),
          hasAssessments: Array.isArray(body.assessments),
          hasMaterials: Array.isArray(body.materials),
        },
        ip,
        userAgent,
      });
    } catch (e) {
      console.warn('Audit warning:', e);
    }

    const [rawUpdatedMaterials, updatedProcedures, updatedAssessments] = await Promise.all([
      readPackageMaterials(id),
      readPackageProcedures(id),
      readPackageAssessments(id),
    ]);
    const updatedMaterials = await resolveMaterialUrlsForResponse(rawUpdatedMaterials);

    return NextResponse.json({
      success: true,
      data: {
        materials: updatedMaterials,
        procedures: updatedProcedures,
        assessments: updatedAssessments,
      },
    });
  } catch (error: any) {
    console.error('Failed to update package curriculum:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update package curriculum' },
      { status: 500 }
    );
  }
}
