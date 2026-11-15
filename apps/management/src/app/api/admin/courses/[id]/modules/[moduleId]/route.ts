import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  const { id, moduleId } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { title, description, status } = body;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updates.title = String(title).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabaseAdmin
      .from('course_modules')
      .update(updates)
      .eq('id', moduleId)
      .eq('course_id', id)
      .select()
      .single();

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_MODULE_UPDATED',
      entityType: 'COURSE',
      entityId: id,
      details: { moduleId, title: data.title },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true, module: data });
  } catch (error: any) {
    console.error('Failed to update module:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update module' },
      { status: 500 }
    );
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
    // 1. Delete associated learning materials for this module first
    await supabaseAdmin
      .from('learning_materials')
      .delete()
      .eq('module_id', moduleId);

    // 2. Delete the module itself
    const { error } = await supabaseAdmin
      .from('course_modules')
      .delete()
      .eq('id', moduleId)
      .eq('course_id', id);

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_MODULE_DELETED',
      entityType: 'COURSE',
      entityId: id,
      details: { moduleId },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true, moduleId });
  } catch (error: any) {
    console.error('Failed to delete module:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete module' },
      { status: 500 }
    );
  }
}
