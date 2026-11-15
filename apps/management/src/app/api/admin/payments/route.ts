import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  formatPayment,
  isAdminContext,
  matchesSearch,
  PAYMENT_SELECT,
  requestMeta,
  requireAdmin,
  toDbPaymentStatus,
  unwrap,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'PAYMENT_VIEW', requireFinancial: true });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';
    const method = searchParams.get('method') || 'ALL';
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(PAYMENT_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw error;

    let payments = (data || [])
      .filter((row: any) => {
        if (!ctx.centerId) return true;
        const enrollment = unwrap(row.enrollments);
        return !enrollment?.training_center_id || enrollment.training_center_id === ctx.centerId;
      })
      .map(formatPayment);

    if (search) {
      payments = payments.filter((p: any) =>
        matchesSearch([p.paymentNo, p.traineeName, p.referenceNumber, p.courseTitle], search)
      );
    }
    if (status !== 'ALL') payments = payments.filter((p: any) => p.status === status.toUpperCase());
    if (method !== 'ALL') payments = payments.filter((p: any) => p.method === method.toUpperCase());

    return NextResponse.json({ success: true, data: payments.slice(0, limit) });
  } catch (error) {
    console.error('Failed to load payments:', error);
    return NextResponse.json({ success: false, error: 'Failed to load payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'PAYMENT_VERIFY', requireFinancial: true });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { enrollmentId, traineeId, amount, method, referenceNumber } = body;
    const { ip, userAgent } = requestMeta(request);

    if (!traineeId) {
      return NextResponse.json({ success: false, error: 'Trainee is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert({
        trainee_id: traineeId,
        enrollment_id: enrollmentId || null,
        amount: parseFloat(amount) || 0,
        payment_method: (method || 'OTHER').toUpperCase(),
        reference_number: referenceNumber || `PAY-${Date.now()}`,
        status: 'PENDING',
      })
      .select(PAYMENT_SELECT)
      .single();

    if (error) throw error;

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'PAYMENT_CREATED',
      entityType: 'PAYMENT',
      entityId: data.id,
      details: { amount: data.amount, method },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, payment: formatPayment(data) });
  } catch (error) {
    console.error('Failed to create payment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create payment' }, { status: 500 });
  }
}
