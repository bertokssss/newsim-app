import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  applyCenterFilter,
  formatTrainee,
  isAdminContext,
  matchesSearch,
  requireAdmin,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'ENROLLMENT_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500);

    let query = supabaseAdmin
      .from('trainees')
      .select('*, profiles(first_name, last_name, email, phone, status, avatar_url), training_centers(name)');
    query = applyCenterFilter(query, ctx.centerId);

    const [{ data, error }, { data: pendingInvites }] = await Promise.all([
      query.order('created_at', { ascending: false }).limit(limit),
      supabaseAdmin.from('invitations').select('email').eq('status', 'PENDING'),
    ]);
    if (error) throw error;

    const pendingEmails = new Set(
      (pendingInvites || []).map((inv: { email?: string }) => (inv.email || '').toLowerCase().trim())
    );

    let trainees = (data || []).map((row: any) => {
      const formatted = formatTrainee(row);
      if (formatted.email && pendingEmails.has(formatted.email.toLowerCase().trim())) {
        formatted.status = 'PENDING';
      }
      return formatted;
    });

    if (search) {
      trainees = trainees.filter((t: any) =>
        matchesSearch([t.firstName, t.lastName, t.email, t.srn, t.phone], search)
      );
    }

    return NextResponse.json({ success: true, data: trainees });
  } catch (error) {
    console.error('Failed to load trainees:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load trainees' },
      { status: 500 }
    );
  }
}

export { POST } from '@/app/api/super-admin/trainees/route';

