import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  supabaseAdmin,
  uploadToLearningMaterialsStorage,
  validateMaterialUploadMeta,
  isInHouseModularCourse,
} from '@newsim/database';
import {
  applyCenterFilter,
  ASSESSMENT_SELECT,
  COURSE_SELECT,
  formatAssessment,
  formatCourse,
  getDefaultCenterId,
  isAdminContext,
  matchesSearch,
  requestMeta,
  requireAdmin,
  writeAdminAudit,
} from '@/lib/admin-api';
import {
  getDefaultProcedures,
  writeMaterials,
  writeProcedures,
  ProcedureStep,
} from '@/lib/course-curriculum';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'COURSE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const category = searchParams.get('category') || 'ALL';
    const status = searchParams.get('status') || 'ALL';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let query = supabaseAdmin.from('courses').select(COURSE_SELECT);
    query = applyCenterFilter(query, ctx.centerId);

    const [
      { data, error },
      enrollmentsRes,
    ] = await Promise.all([
      query.order('created_at', { ascending: false }),
      supabaseAdmin.from('enrollments').select('course_id'),
    ]);

    if (error) throw error;

    let courses = (data || []).map(formatCourse);

    // Fetch enrolled count per course from enrollments
    try {
      const enrollments = enrollmentsRes.data;
      const countMap: Record<string, number> = {};
      (enrollments || []).forEach((e: any) => {
        if (e.course_id) {
          countMap[e.course_id] = (countMap[e.course_id] || 0) + 1;
        }
      });

      courses = courses.map((c: any) => ({
        ...c,
        enrolledCount: countMap[c.id] || 0,
        capacity: c.capacity || 24,
      }));
    } catch (countErr) {
      console.warn('Failed to calculate enrolled counts:', countErr);
    }

    if (search) {
      courses = courses.filter((c: any) =>
        matchesSearch([c.code, c.title, c.category, c.instructorName], search)
      );
    }
    if (category !== 'ALL') {
      courses = courses.filter((c: any) => c.category === category);
    }
    if (status !== 'ALL') {
      const normalizedStatus = status.toUpperCase();
      if (normalizedStatus === 'DISABLED' || normalizedStatus === 'SUSPENDED' || normalizedStatus === 'INACTIVE') {
        courses = courses.filter((c: any) => c.status === 'SUSPENDED' || c.status === 'DISABLED');
      } else if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'ENABLED' || normalizedStatus === 'PUBLISHED') {
        courses = courses.filter((c: any) => c.status === 'PUBLISHED' || c.status === 'ACTIVE');
      } else {
        courses = courses.filter((c: any) => c.status === normalizedStatus);
      }
    }

    return NextResponse.json({ success: true, data: courses.slice(0, limit) });
  } catch (error) {
    console.error('Failed to load courses:', error);
    return NextResponse.json({ success: false, error: 'Failed to load courses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};
    const syllabusFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = {
        code: formData.get('code'),
        title: formData.get('title'),
        category: formData.get('category'),
        description: formData.get('description'),
        durationHours: formData.get('durationHours'),
        capacity: formData.get('capacity'),
        fee: formData.get('fee'),
        centerId: formData.get('centerId'),
        // Syllabus fields
        syllabusOutline: formData.get('syllabusOutline') || formData.get('syllabusText'),
        // Procedures fields
        procedureOverview: formData.get('procedureOverview'),
        procedureSteps: formData.get('procedureSteps'),
        // Assessment fields
        assessmentTitle: formData.get('assessmentTitle'),
        assessmentType: formData.get('assessmentType'),
        assessmentPassingScore: formData.get('assessmentPassingScore'),
        assessmentDurationMinutes: formData.get('assessmentDurationMinutes'),
        assessmentDescription: formData.get('assessmentDescription'),
      };

      const allFileEntries = [
        ...formData.getAll('syllabusFiles'),
        ...formData.getAll('syllabusFile'),
      ];
      for (const entry of allFileEntries) {
        if (entry && typeof entry === 'object' && 'name' in entry && (entry as File).size > 0) {
          syllabusFiles.push(entry as File);
        }
      }
    } else {
      body = await request.json();
    }

    const { code, title, category, description, durationHours, capacity, fee, centerId } = body;
    const { ip, userAgent } = requestMeta(request);

    if (!code || !title) {
      return NextResponse.json(
        { success: false, error: 'Course code and title are required' },
        { status: 400 }
      );
    }

    // 50 MB Size Limit Check
    const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
    const totalFilesSize = syllabusFiles.reduce((acc, f) => acc + f.size, 0);
    if (totalFilesSize > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { success: false, error: `Total syllabus files size (${(totalFilesSize / 1024 / 1024).toFixed(1)} MB) exceeds 50 MB limit.` },
        { status: 400 }
      );
    }

    let assignedCenterId = centerId || ctx.centerId || null;
    if (!assignedCenterId) {
      try {
        const defaultCenterId = await getDefaultCenterId();
        if (defaultCenterId) {
          assignedCenterId = defaultCenterId;
        }
      } catch (centerErr) {
        console.warn('Could not query default training_center:', centerErr);
      }
    }

    const hours = parseInt(durationHours, 10) || 40;
    const totalDays = Math.max(1, Math.ceil(hours / 8));
    const isInHouse = isInHouseModularCourse(category);
    const normalizedCategory = isInHouse ? 'In-House Courses' : (category || 'Safety and Other STCW Courses');
    const theoryDays = isInHouse ? totalDays : (totalDays <= 1 ? 1 : Math.max(1, Math.round(totalDays * 0.4)));
    const practicalDays = isInHouse ? 0 : Math.max(0, totalDays - theoryDays);

    const { data, error } = await supabaseAdmin
      .from('courses')
      .insert({
        code: String(code).trim().toUpperCase(),
        name: String(title).trim(),
        category: normalizedCategory,
        description: description || '',
        duration_hours: hours,
        theory_days: theoryDays,
        practical_days: practicalDays,
        capacity: Math.min(Math.max(1, parseInt(capacity, 10) || 24), 24),
        price: parseFloat(fee) || 10000,
        training_center_id: assignedCenterId,
        status: 'PUBLISHED',
      })
      .select(COURSE_SELECT)
      .single();

    if (error) throw error;

    const courseId = data.id;

    // 1. Save Syllabus files and outline
    const materials: any[] = [];
    if (syllabusFiles.length > 0) {
      for (const file of syllabusFiles) {
        try {
          const check = validateMaterialUploadMeta(file.name, file.size, file.type);
          if (!check.valid) {
            console.warn(`Skipped invalid syllabus file ${file.name}: ${check.error}`);
            continue;
          }
          const buffer = Buffer.from(await file.arrayBuffer());
          const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${check.safeBaseName}`;
          const uploaded = await uploadToLearningMaterialsStorage(
            `courses/${courseId}/${uniqueName}`,
            buffer,
            check.contentType
          );

          const fileUrl = uploaded.storageUri;
          const ext = file.name.split('.').pop()?.toUpperCase() || 'DOC';
          const matType = ['PPT', 'PPTX'].includes(ext)
            ? 'PRESENTATION'
            : ['MP4', 'MOV', 'WEBM'].includes(ext)
            ? 'VIDEO'
            : 'SYLLABUS';

          materials.push({
            id: `mat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            courseId,
            title: `${String(title).trim()} - ${file.name.replace(/\.[^/.]+$/, '')}`,
            description: body.syllabusOutline ? String(body.syllabusOutline).trim() : `Official curriculum material: ${file.name}`,
            materialType: matType,
            fileName: file.name,
            fileSize: file.size,
            fileUrl,
            uploadedBy: ctx.user.username || ctx.user.email || 'Admin',
            createdAt: new Date().toISOString(),
          });
        } catch (fileErr) {
          console.warn(`Failed to save syllabus file ${file.name}:`, fileErr);
        }
      }
    } else if (body.syllabusOutline && String(body.syllabusOutline).trim()) {
      materials.push({
        id: `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        courseId,
        title: `${String(title).trim()} - Course Syllabus Outline`,
        description: String(body.syllabusOutline).trim(),
        materialType: 'SYLLABUS',
        fileName: 'syllabus_outline.txt',
        fileSize: Buffer.byteLength(String(body.syllabusOutline).trim(), 'utf-8'),
        fileUrl: '',
        uploadedBy: ctx.user.username || ctx.user.email || 'Admin',
        createdAt: new Date().toISOString(),
      });
    }

    if (materials.length > 0) {
      try {
        await writeMaterials(courseId, materials);
        // Sync to course_modules / learning_materials in database if possible
        const { data: newMod } = await supabaseAdmin
          .from('course_modules')
          .insert({
            course_id: courseId,
            title: 'Course Syllabus & Curriculum Materials',
            description: 'Official syllabus, curriculum structure, and learning materials',
            sort_order: 0,
          })
          .select('id')
          .single();

        if (newMod?.id) {
          for (const mat of materials) {
            await supabaseAdmin.from('learning_materials').insert({
              module_id: newMod.id,
              title: mat.title,
              description: mat.description,
              material_type: 'DOCUMENT',
              external_url: mat.fileUrl || '',
            });
          }
        }
      } catch (matErr) {
        console.warn('Failed saving syllabus materials:', matErr);
      }
    }

    // 2. Save Procedures
    let parsedProcedureSteps: ProcedureStep[] = [];
    if (typeof body.procedureSteps === 'string') {
      try {
        parsedProcedureSteps = JSON.parse(body.procedureSteps);
      } catch {
        parsedProcedureSteps = [];
      }
    } else if (Array.isArray(body.procedureSteps)) {
      parsedProcedureSteps = body.procedureSteps;
    }

    try {
      let finalSteps: ProcedureStep[] = [];
      if (parsedProcedureSteps.length > 0) {
        finalSteps = parsedProcedureSteps.map((s, idx) => ({
          id: s.id || `step-${Date.now()}-${idx}`,
          stepNumber: idx + 1,
          phase: (s.phase || 'THEORY').toUpperCase() as any,
          title: String(s.title || '').trim(),
          description: String(s.description || '').trim(),
          hours: Math.max(1, Number(s.hours || 1)),
          mandatory: Boolean(s.mandatory ?? true),
        }));
      } else {
        const defaults = getDefaultProcedures();
        if (body.procedureOverview && String(body.procedureOverview).trim()) {
          defaults[1].description = `${defaults[1].description}\n\nCourse Workflow Guidelines:\n${String(body.procedureOverview).trim()}`;
        }
        finalSteps = defaults;
      }
      await writeProcedures(courseId, finalSteps);
    } catch (procErr) {
      console.warn('Failed saving procedures:', procErr);
    }

    // 3. Save Assessment
    let createdAssessment: any = null;
    const assessTitle = body.assessmentTitle ? String(body.assessmentTitle).trim() : '';
    if (assessTitle) {
      try {
        const passingScore = parseInt(String(body.assessmentPassingScore || '75'), 10) || 75;
        const duration = parseInt(String(body.assessmentDurationMinutes || '60'), 10) || 60;
        const assessmentType = (body.assessmentType || 'WRITTEN').toUpperCase();

        const { data: newAssess, error: assessError } = await supabaseAdmin
          .from('assessments')
          .insert({
            title: assessTitle,
            course_id: courseId,
            assessment_type: assessmentType,
            passing_score: passingScore,
            duration_minutes: duration,
            status: 'PUBLISHED',
          })
          .select(ASSESSMENT_SELECT)
          .single();

        if (assessError) {
          console.warn('Assessment creation error:', assessError);
        } else if (newAssess) {
          createdAssessment = formatAssessment(newAssess);
          await writeAdminAudit({
            actorId: ctx.user.id,
            action: 'ASSESSMENT_CREATED',
            entityType: 'ASSESSMENT',
            entityId: newAssess.id,
            details: { title: newAssess.title, courseId, type: newAssess.assessment_type },
            ip,
            userAgent,
          });
        }
      } catch (assessEx) {
        console.warn('Assessment exception:', assessEx);
      }
    }

    // 4. For Safety and Other STCW Courses, ensure a course-specific practical rubric exists for after-module practical evaluation
    if (!isInHouse) {
      try {
        const courseCodeUpper = String(data.code || code).trim().toUpperCase();
        const courseNameTrimmed = String(data.name || title).trim();
        const { data: insertedRubric } = await supabaseAdmin
          .from('practical_rubrics')
          .insert({
            course_id: courseId,
            title: `${courseCodeUpper} — ${courseNameTrimmed} Practical Competency Rubric`,
            stcw_reference: `STCW ${courseCodeUpper}`,
            description: `Course-specific practical competency evaluation for ${courseNameTrimmed} (${courseCodeUpper}), unlocked after completing all modular lessons.`,
            instructions: `Complete all modular lessons for ${courseNameTrimmed} first, then demonstrate each practical competency criterion under instructor observation.`,
            passing_score: 75,
            max_score: 100,
            status: 'ACTIVE',
            created_by: ctx.user.id,
          })
          .select('id')
          .single();

        if (insertedRubric?.id) {
          await supabaseAdmin.from('practical_rubric_criteria').insert([
            {
              rubric_id: insertedRubric.id,
              criterion_name: 'Pre-Operational Safety & PPE Readiness',
              competency: 'Pre-Operational Safety & PPE Readiness',
              description: `Verifies PPE, equipment readiness, and safety protocols for ${courseCodeUpper}.`,
              performance_indicators: `Verifies PPE, equipment readiness, and safety protocols for ${courseCodeUpper}.`,
              max_points: 25,
              weight_pct: 25,
              is_critical: true,
              sort_order: 1,
            },
            {
              rubric_id: insertedRubric.id,
              criterion_name: 'Core STCW Practical Procedure Execution',
              competency: 'Core STCW Practical Procedure Execution',
              description: `Executes primary practical procedures required under ${courseNameTrimmed}.`,
              performance_indicators: `Executes primary practical procedures required under ${courseNameTrimmed}.`,
              max_points: 25,
              weight_pct: 25,
              is_critical: true,
              sort_order: 2,
            },
            {
              rubric_id: insertedRubric.id,
              criterion_name: 'Emergency Response & Contingency Handling',
              competency: 'Emergency Response & Contingency Handling',
              description: `Responds accurately to simulated faults or emergencies during ${courseCodeUpper} exercises.`,
              performance_indicators: `Responds accurately to simulated faults or emergencies during ${courseCodeUpper} exercises.`,
              max_points: 25,
              weight_pct: 25,
              is_critical: true,
              sort_order: 3,
            },
            {
              rubric_id: insertedRubric.id,
              criterion_name: 'Post-Exercise Debrief, Equipment Securing & Logging',
              competency: 'Post-Exercise Debrief, Equipment Securing & Logging',
              description: `Secures station equipment and completes post-operation debrief for ${courseCodeUpper}.`,
              performance_indicators: `Secures station equipment and completes post-operation debrief for ${courseCodeUpper}.`,
              max_points: 25,
              weight_pct: 25,
              is_critical: false,
              sort_order: 4,
            },
          ]);
        }
      } catch (rubricErr) {
        console.warn('Could not auto-create course practical rubric:', rubricErr);
      }
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_CREATED',
      entityType: 'COURSE',
      entityId: data.id,
      details: {
        code: data.code,
        title: data.name,
        hasSyllabus: materials.length > 0,
        hasProcedures: true,
        hasAssessment: Boolean(createdAssessment),
      },
      ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      course: formatCourse(data),
      materials,
      assessment: createdAssessment,
    });
  } catch (error) {
    console.error('Failed to create course:', error);
    return NextResponse.json({ success: false, error: 'Failed to create course' }, { status: 500 });
  }
}
