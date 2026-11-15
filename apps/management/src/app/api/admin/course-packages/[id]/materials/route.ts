import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  deleteFromLearningMaterialsStorage,
  sanitizeMaterialUrl,
  uploadToLearningMaterialsStorage,
  validateMaterialUploadMeta,
} from '@newsim/database';
import { isAdminContext, requireAdmin, requestMeta, writeAdminAudit } from '@/lib/admin-api';
import {
  readPackageMaterials,
  resolveMaterialUrlsForResponse,
  writePackageMaterials,
} from '@/lib/course-curriculum';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const materials = await readPackageMaterials(id);
    const resolved = await resolveMaterialUrlsForResponse(materials);
    return NextResponse.json({ success: true, data: resolved });
  } catch (error: any) {
    console.error('Failed to fetch package materials:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch package materials' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const formData = await request.formData();
    const title = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';
    const materialType = ((formData.get('material_type') as string) || 'SYLLABUS').toUpperCase();
    const rawExternalUrl = (formData.get('external_url') as string) || '';
    const externalUrl = rawExternalUrl ? sanitizeMaterialUrl(rawExternalUrl) : '';
    const sourceCourseCode = (formData.get('source_course_code') as string) || 'PACKAGE';
    const file = formData.get('file') as File | null;

    if (!title.trim()) {
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
      const uploaded = await uploadToLearningMaterialsStorage(
        `packages/${id}/${uniqueName}`,
        buffer,
        check.contentType
      );

      fileUrl = uploaded.storageUri;
      signedUrl = uploaded.signedUrl;
      fileName = file.name;
      fileSize = file.size;
    } else if (externalUrl) {
      fileUrl = externalUrl;
      signedUrl = externalUrl;
    }

    const materialItem = {
      id: `pkg_mat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      courseId: id,
      sourceCourseId: id,
      sourceCourseCode: sourceCourseCode.trim(),
      sourceCourseTitle: 'Course Package Bundle',
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

    const currentMaterials = await readPackageMaterials(id);
    currentMaterials.unshift(materialItem);
    await writePackageMaterials(id, currentMaterials);

    const { ip, userAgent } = requestMeta(request);
    try {
      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'PACKAGE_MATERIAL_ADDED',
        entityType: 'COURSE_PACKAGE',
        entityId: id,
        details: { title: materialItem.title, materialType },
        ip,
        userAgent,
      });
    } catch (e) {
      console.warn('Audit warning:', e);
    }

    return NextResponse.json({
      success: true,
      data: { ...materialItem, fileUrl: signedUrl || materialItem.fileUrl },
    });
  } catch (error: any) {
    console.error('Failed to add package material:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to add package material' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('id');

    if (!materialId) {
      return NextResponse.json({ success: false, error: 'Material ID is required' }, { status: 400 });
    }

    const currentMaterials = await readPackageMaterials(id);
    const targetMaterial = currentMaterials.find((m: any) => m.id === materialId);

    if (!targetMaterial) {
      return NextResponse.json({ success: false, error: 'Material not found in package' }, { status: 404 });
    }

    if (targetMaterial.fileUrl) {
      await deleteFromLearningMaterialsStorage(targetMaterial.fileUrl);
    }

    const remainingMaterials = currentMaterials.filter((m: any) => m.id !== materialId);
    await writePackageMaterials(id, remainingMaterials);

    const { ip, userAgent } = requestMeta(request);
    try {
      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'PACKAGE_MATERIAL_DELETED',
        entityType: 'COURSE_PACKAGE',
        entityId: id,
        details: { materialId, title: targetMaterial.title },
        ip,
        userAgent,
      });
    } catch (e) {
      console.warn('Audit warning:', e);
    }

    const resolved = await resolveMaterialUrlsForResponse(remainingMaterials);
    return NextResponse.json({ success: true, data: resolved });
  } catch (error: any) {
    console.error('Failed to delete package material:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete package material' },
      { status: 500 }
    );
  }
}
