import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { isAdminContext, requireAdmin, writeAdminAudit } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { title, description } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Module title is required' }, { status: 400 });
    }

    // Get current max sort_order
    const { data: existing } = await supabaseAdmin
      .from('course_modules')
      .select('sort_order')
      .eq('course_id', id)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSortOrder = (existing?.[0]?.sort_order ?? 0) + 1;

    const { data, error } = await supabaseAdmin
      .from('course_modules')
      .insert({
        course_id: id,
        title: String(title).trim(),
        description: description ? String(description).trim() : '',
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_MODULE_CREATED',
      entityType: 'COURSE',
      entityId: id,
      details: { moduleId: data.id, title: data.title },
      ip: 'unknown',
      userAgent: 'unknown',
    });

    return NextResponse.json({ success: true, module: data });
  } catch (error: any) {
    console.error('Failed to create module:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create module' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(request, { permission: 'COURSE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    let moduleId = searchParams.get('moduleId');
    if (!moduleId) {
      try {
        const body = await request.json();
        moduleId = body?.moduleId;
      } catch {
        // no body
      }
    }

    if (!moduleId) {
      return NextResponse.json({ success: false, error: 'Module ID is required' }, { status: 400 });
    }

    // Delete associated learning materials first
    await supabaseAdmin
      .from('learning_materials')
      .delete()
      .eq('module_id', moduleId);

    // Delete the module
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
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete module' }, { status: 500 });
  }
}

