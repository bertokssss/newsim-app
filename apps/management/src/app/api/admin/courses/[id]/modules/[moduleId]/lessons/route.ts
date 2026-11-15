import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  resolveMaterialAccessUrl,
  sanitizeMaterialUrl,
  supabaseAdmin,
  uploadToLearningMaterialsStorage,
  validateMaterialUploadMeta,
} from '@newsim/database';
import { isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  const { id, moduleId } = await params;
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

    const formData = await request.formData();
    const title = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';
    const materialType = ((formData.get('material_type') as string) || 'DOCUMENT').toUpperCase();
    const rawExternalUrl = (formData.get('external_url') as string) || '';
    const externalUrl = rawExternalUrl ? sanitizeMaterialUrl(rawExternalUrl) : '';
    const file = formData.get('file') as File | null;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Lesson title is required' }, { status: 400 });
    }
    if (rawExternalUrl && !externalUrl) {
      return NextResponse.json({ success: false, error: 'Invalid external URL' }, { status: 400 });
    }

    let fileUrl = '';
    let signedUrl = '';

    if (file && typeof file.arrayBuffer === 'function' && file.size > 0) {
      const check = validateMaterialUploadMeta(file.name, file.size, file.type);
      if (!check.valid) {
        return NextResponse.json({ success: false, error: check.error }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const uniqueName = `lesson_${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${check.safeBaseName}`;
      const uploaded = await uploadToLearningMaterialsStorage(
        `courses/${id}/${uniqueName}`,
        buffer,
        check.contentType
      );
      fileUrl = uploaded.storageUri;
      signedUrl = uploaded.signedUrl;
    }

    const { data, error } = await supabaseAdmin
      .from('learning_materials')
      .insert({
        module_id: moduleId,
        title: title.trim(),
        description: description.trim(),
        material_type: materialType,
        external_url: fileUrl || externalUrl || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_LESSON_UPLOADED',
      entityType: 'COURSE',
      entityId: id,
      details: { moduleId, title, materialType, fileUrl },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    const resolvedExternalUrl =
      signedUrl || (data?.external_url ? await resolveMaterialAccessUrl(data.external_url) : null);

    return NextResponse.json({
      success: true,
      material: { ...data, external_url: resolvedExternalUrl },
    });
  } catch (error: any) {
    console.error('Failed to upload lesson:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to upload lesson' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  const { id, moduleId } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    let lessonId = searchParams.get('lessonId');
    if (!lessonId) {
      try {
        const body = await request.json();
        lessonId = body?.lessonId;
      } catch {
        // no body
      }
    }

    if (!lessonId) {
      return NextResponse.json({ success: false, error: 'Lesson ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('learning_materials')
      .delete()
      .eq('id', lessonId)
      .eq('module_id', moduleId);

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_LESSON_DELETED',
      entityType: 'COURSE',
      entityId: id,
      details: { moduleId, lessonId },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true, lessonId });
  } catch (error: any) {
    console.error('Failed to delete lesson:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete lesson' }, { status: 500 });
  }
}

