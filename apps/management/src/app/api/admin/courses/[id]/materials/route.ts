import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  sanitizeMaterialUrl,
  supabaseAdmin,
  uploadToLearningMaterialsStorage,
  validateMaterialUploadMeta,
} from '@newsim/database';
import { isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';
import {
  readMaterials,
  resolveMaterialUrlsForResponse,
  writeMaterials,
} from '@/lib/course-curriculum';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_VIEW' });
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
    const materials = await readMaterials(id);
    const resolved = await resolveMaterialUrlsForResponse(materials);
    return NextResponse.json({ success: true, data: resolved });
  } catch (error: any) {
    console.error('Failed to fetch materials:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch materials' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    const rawExternalUrl = (formData.get('external_url') as string) || '';
    const externalUrl = rawExternalUrl ? sanitizeMaterialUrl(rawExternalUrl) : '';
    const rawType = ((formData.get('material_type') as string) || 'SYLLABUS').toUpperCase();
    const materialType: 'SYLLABUS' | 'PRESENTATION' | 'DOCUMENT' | 'VIDEO' =
      rawType === 'PRESENTATION' || rawType === 'DOCUMENT' || rawType === 'VIDEO'
        ? rawType
        : 'SYLLABUS';
    const file = formData.get('file') as File | null;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Material title is required' }, { status: 400 });
    }
    if (rawExternalUrl && !externalUrl) {
      return NextResponse.json({ success: false, error: 'Invalid external material URL' }, { status: 400 });
    }

    let fileUrl = '';
    let signedUrl = '';
    let fileName = '';
    let fileSize = 0;

    if (file && typeof file.arrayBuffer === 'function' && file.size > 0) {
      const check = validateMaterialUploadMeta(file.name, file.size, file.type);
      if (!check.valid) {
        return NextResponse.json({ success: false, error: check.error }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${check.safeBaseName}`;
      const objectPath = `courses/${id}/${uniqueName}`;
      const uploaded = await uploadToLearningMaterialsStorage(objectPath, buffer, check.contentType);

      fileUrl = uploaded.storageUri;
      signedUrl = uploaded.signedUrl;
      fileName = file.name;
      fileSize = file.size;
    } else if (externalUrl) {
      fileUrl = externalUrl;
      signedUrl = externalUrl;
    }

    const materialItem = {
      id: `mat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      courseId: id,
      title: title.trim(),
      description: description.trim(),
      materialType,
      fileName,
      fileSize,
      fileUrl,
      externalUrl,
      uploadedBy: ctx.user.username || ctx.user.email || 'Admin',
      createdAt: new Date().toISOString(),
    };

    const currentMaterials = await readMaterials(id);
    currentMaterials.unshift(materialItem);
    await writeMaterials(id, currentMaterials);

    // Also attempt to record in database course_modules if available
    try {
      let { data: mod } = await supabaseAdmin
        .from('course_modules')
        .select('id')
        .eq('course_id', id)
        .eq('title', 'Course Syllabus & Presentation Materials')
        .maybeSingle();

      if (!mod) {
        const { data: newMod } = await supabaseAdmin
          .from('course_modules')
          .insert({
            course_id: id,
            title: 'Course Syllabus & Presentation Materials',
            description: 'Official syllabus, lecture presentations, and training handouts',
            sort_order: 0,
          })
          .select('id')
          .single();
        mod = newMod;
      }

      if (mod?.id) {
        await supabaseAdmin.from('learning_materials').insert({
          module_id: mod.id,
          title: title.trim(),
          description: description.trim(),
          material_type: materialType === 'SYLLABUS' || materialType === 'PRESENTATION' ? 'DOCUMENT' : materialType,
          external_url: fileUrl || externalUrl,
        });
      }
    } catch (dbErr) {
      console.warn('Non-fatal: could not sync material to DB table:', dbErr);
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_MATERIAL_UPLOADED',
      entityType: 'COURSE',
      entityId: id,
      details: { title, materialType, fileName },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({
      success: true,
      material: { ...materialItem, fileUrl: signedUrl || materialItem.fileUrl },
    });
  } catch (error: any) {
    console.error('Failed to upload material:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to upload material' }, { status: 500 });
  }
}
