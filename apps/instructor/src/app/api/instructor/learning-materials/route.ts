import { NextRequest, NextResponse } from 'next/server';
import {
  supabaseAdmin,
  getInstructorCourseIds,
  resolveMaterialAccessUrl,
  sanitizeMaterialUrl,
} from '@newsim/database';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'COURSE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const instructorId = auth.user.id;
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId') || 'ALL';
    const search = searchParams.get('search')?.toLowerCase() || '';

    // Scope check: Instructor can only view materials for their assigned courses
    const assignedCourseIds = await getInstructorCourseIds(instructorId);
    if (assignedCourseIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    let targetCourseIds = assignedCourseIds;
    if (courseId !== 'ALL') {
      if (!assignedCourseIds.includes(courseId)) {
        return createForbiddenResponse('Access denied: You are not assigned to instruct this course.');
      }
      targetCourseIds = [courseId];
    }

    // Query course modules for target courses
    const { data: modules, error: modErr } = await supabaseAdmin
      .from('course_modules')
      .select('id, course_id, title, courses (id, code, name)')
      .in('course_id', targetCourseIds);

    if (modErr) throw modErr;
    if (!modules || modules.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const moduleIds = modules.map((m: any) => m.id);
    const moduleMap = new Map<string, any>(modules.map((m: any) => [m.id, m]));

    // Query persistent learning materials from Supabase
    const { data: materialsData, error: matErr } = await supabaseAdmin
      .from('learning_materials')
      .select('*')
      .in('module_id', moduleIds)
      .order('created_at', { ascending: false });

    if (matErr) throw matErr;

    const authUser = auth.user;
    const instructorDisplayName = authUser ? `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim() : 'Instructor';

    let materials = await Promise.all(
      (materialsData || []).map(async (m: any) => {
        const mod = moduleMap.get(m.module_id);
        const crs = (mod as any)?.courses;
        const resolvedUrl = await resolveMaterialAccessUrl(m.external_url || m.file_url || '');
        return {
          id: m.id,
          courseId: mod?.course_id || '',
          courseCode: crs?.code || 'STCW',
          courseTitle: crs?.name || 'Maritime Course',
          moduleId: m.module_id,
          moduleName: mod?.title || 'Core Maritime Module',
          title: m.title,
          description: m.description || '',
          fileType: m.material_type || 'PDF',
          fileSize: m.file_size || null,
          url: resolvedUrl,
          instructorId: m.created_by || instructorId,
          instructorName: instructorDisplayName,
          isArchived: false,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
        };
      })
    );

    if (search) {
      materials = materials.filter(
        (m: any) =>
          m.title.toLowerCase().includes(search) ||
          m.moduleName.toLowerCase().includes(search) ||
          m.courseTitle.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, data: materials });
  } catch (error) {
    console.error('Failed to load learning materials from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load learning materials' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'MATERIAL_MANAGE');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const instructorId = auth.user.id;
    const instructorName = `${auth.user.firstName || ''} ${auth.user.lastName || ''}`.trim() || 'Instructor';

    const body = await req.json();
    const { courseId, moduleName, title, description, fileType, url } = body;

    if (!courseId || !title || !moduleName) {
      return NextResponse.json({ success: false, error: 'Course, module name, and title are required' }, { status: 400 });
    }

    // Strict Scope check: Instructor must be assigned to this course
    const assignedCourseIds = await getInstructorCourseIds(instructorId);
    if (!assignedCourseIds.includes(courseId)) {
      return createForbiddenResponse('Access denied: You are not assigned to upload materials for this course.');
    }

    // Resolve or create course_module for this course
    let { data: existingMod } = await supabaseAdmin
      .from('course_modules')
      .select('id, title')
      .eq('course_id', courseId)
      .eq('title', moduleName)
      .maybeSingle();

    if (!existingMod) {
      const { data: anyMod } = await supabaseAdmin
        .from('course_modules')
        .select('id, title')
        .eq('course_id', courseId)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (anyMod) {
        existingMod = anyMod;
      } else {
        const { data: newMod, error: modCreateErr } = await supabaseAdmin
          .from('course_modules')
          .insert({
            course_id: courseId,
            title: moduleName,
            sort_order: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id, title')
          .single();

        if (modCreateErr) throw modCreateErr;
        existingMod = newMod;
      }
    }

    const targetModuleId = existingMod?.id;
    const rawUrl = url ? String(url).trim() : '';
    const safeUrl = rawUrl ? sanitizeMaterialUrl(rawUrl) : '';
    if (rawUrl && !safeUrl) {
      return NextResponse.json({ success: false, error: 'Invalid external material URL' }, { status: 400 });
    }

    // Persist learning material to Supabase
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('learning_materials')
      .insert({
        module_id: targetModuleId,
        title,
        description: description || '',
        material_type: fileType || 'DOCUMENT',
        file_url: safeUrl || null,
        external_url: safeUrl || null,
        created_by: instructorId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: instructorId,
        action: 'LEARNING_MATERIAL_CREATED',
        entity_type: 'LEARNING_MATERIAL',
        entity_id: inserted.id,
        new_values: { courseId, title, moduleName, fileType },
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('Could not record audit log:', auditErr);
    }

    // Fetch course info for clean return
    const { data: crs } = await supabaseAdmin
      .from('courses')
      .select('code, name')
      .eq('id', courseId)
      .maybeSingle();

    const resolvedUrl = await resolveMaterialAccessUrl(inserted.external_url || inserted.file_url || '');
    const formatted = {
      id: inserted.id,
      courseId,
      courseCode: crs?.code || 'STCW',
      courseTitle: crs?.name || 'Maritime Course',
      moduleId: targetModuleId,
      moduleName: existingMod?.title || moduleName,
      title: inserted.title,
      description: inserted.description || '',
      fileType: inserted.material_type || 'PDF',
      fileSize: inserted.file_size || null,
      url: resolvedUrl,
      instructorId,
      instructorName,
      isArchived: false,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Failed to create learning material in Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload material' }, { status: 500 });
  }
}
