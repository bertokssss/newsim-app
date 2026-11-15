import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getInstructorCourseIds } from '@newsim/database';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyInstructorRequestAsync(req, 'MATERIAL_MANAGE');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const instructorId = auth.user.id;
    const { id } = await params;

    // Check material exists and verify instructor assignment
    const { data: material } = await supabaseAdmin
      .from('learning_materials')
      .select('id, module_id, title, course_modules ( course_id )')
      .eq('id', id)
      .maybeSingle();

    if (!material) {
      return NextResponse.json({ success: false, error: 'Material not found' }, { status: 404 });
    }

    const courseId = (material.course_modules as any)?.course_id;
    if (courseId) {
      const assignedCourseIds = await getInstructorCourseIds(instructorId);
      if (!assignedCourseIds.includes(courseId)) {
        return createForbiddenResponse('Access denied: You are not assigned to manage materials for this course.');
      }
    }

    // Delete from Supabase
    const { error: delErr } = await supabaseAdmin
      .from('learning_materials')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: instructorId,
        action: 'LEARNING_MATERIAL_DELETED',
        entity_type: 'LEARNING_MATERIAL',
        entity_id: id,
        new_values: { title: material.title, courseId },
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('Could not record audit log:', auditErr);
    }

    return NextResponse.json({ success: true, message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Failed to delete learning material:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete material' }, { status: 500 });
  }
}
