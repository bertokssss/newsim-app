import { NextRequest, NextResponse } from 'next/server';
import {
  deleteFromLearningMaterialsStorage,
  readStorageJson,
  supabaseAdmin,
} from '@newsim/database';
import { isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';
import {
  getMaterialsStoragePath,
  resolveMaterialUrlsForResponse,
  writeMaterials,
} from '@/lib/course-curriculum';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  const { id, materialId } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    if (ctx.centerId) {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('id, training_center_id')
        .eq('id', id)
        .maybeSingle();
      if (!course) {
        return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
      }
      if (course.training_center_id !== ctx.centerId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const materials = (await readStorageJson<any[]>(getMaterialsStoragePath(id))) || [];
    const target = materials.find((m) => m.id === materialId);
    const remaining = materials.filter((m) => m.id !== materialId);
    if (materials.length > 0) {
      await writeMaterials(id, remaining);
    }

    // Delete from Supabase learning_materials table if present
    try {
      if (target?.fileUrl) {
        await supabaseAdmin
          .from('learning_materials')
          .delete()
          .eq('external_url', target.fileUrl);
      }
      await supabaseAdmin
        .from('learning_materials')
        .delete()
        .eq('id', materialId);
    } catch (dbErr) {
      console.warn('Non-fatal: could not delete from learning_materials in DB:', dbErr);
    }

    if (target?.fileUrl) {
      await deleteFromLearningMaterialsStorage(target.fileUrl);
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_MATERIAL_DELETED',
      entityType: 'COURSE',
      entityId: id,
      details: { materialId, title: target?.title },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    const resolved = await resolveMaterialUrlsForResponse(remaining);
    return NextResponse.json({ success: true, data: resolved });
  } catch (error: any) {
    console.error('Failed to delete material:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete material' }, { status: 500 });
  }
}
