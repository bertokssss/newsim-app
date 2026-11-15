import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { CERTIFICATE_SELECT, formatCertificate, isAdminContext, requireAdmin } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'CERTIFICATE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || searchParams.get('id') || '').trim();

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Verification code or certificate number is required' },
        { status: 400 }
      );
    }

    // Targeted indexed search by certificate_number or id (no unescaped PostgREST .or())
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
    let matched: any = null;

    if (isUUID) {
      const { data: byId, error: byIdErr } = await supabaseAdmin
        .from('certificates')
        .select(CERTIFICATE_SELECT)
        .eq('id', code)
        .limit(1);
      if (byIdErr) throw byIdErr;
      matched = (byId || [])[0] || null;
    }

    if (!matched) {
      const { data: byNo, error: byNoErr } = await supabaseAdmin
        .from('certificates')
        .select(CERTIFICATE_SELECT)
        .eq('certificate_number', code)
        .limit(1);
      if (byNoErr) throw byNoErr;
      matched = (byNo || [])[0] || null;
    }

    if (matched && ctx.centerId) {
      const courseCenterId = Array.isArray(matched.courses)
        ? matched.courses[0]?.training_center_id
        : matched.courses?.training_center_id;
      if (courseCenterId && courseCenterId !== ctx.centerId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Certificate belongs to another training center' },
          { status: 403 }
        );
      }
    }

    if (!matched) {
      return NextResponse.json({
        success: true,
        data: {
          isValid: false,
          status: 'NOT_FOUND',
          message: `No authentic STCW certificate found matching ID or QR code: "${code}".`,
        },
      });
    }

    const formatted = formatCertificate(matched);
    const isRevoked = formatted.status === 'REVOKED';
    const isExpired = formatted.expiryDate !== 'Never' && new Date(formatted.expiryDate) < new Date();
    const isValid = !isRevoked && !isExpired && (formatted.status === 'ISSUED' || formatted.status === 'ACTIVE' || formatted.status === 'CLAIMED');

    return NextResponse.json({
      success: true,
      data: {
        isValid,
        status: isRevoked ? 'REVOKED' : isExpired ? 'EXPIRED' : 'VALID',
        certificate: formatted,
        verifiedAt: new Date().toISOString(),
        institution: 'NEWSIM Maritime Training Institute (Official STCW Registry)',
      },
    });
  } catch (error) {
    console.error('Failed to verify certificate:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete certificate verification' },
      { status: 500 }
    );
  }
}
