import { NextRequest, NextResponse } from 'next/server';
import { verifyCertificateCode } from '@newsim/database';
import { checkRateLimit, getClientIp, createRateLimitResponse, sanitizeText } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`cert-verify:${ip}`, { limit: 30, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return createRateLimitResponse(rl.retryAfterSeconds);
    }

    const { searchParams } = new URL(req.url);
    const code = sanitizeText(searchParams.get('code') || '', 64);

    if (!code) {
      return NextResponse.json({ success: false, error: 'Certificate ID or QR code is required' }, { status: 400 });
    }

    const verification = await verifyCertificateCode(code);
    return NextResponse.json({ success: true, data: verification });
  } catch (error) {
    console.error('Failed to verify certificate in Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to verify certificate' }, { status: 500 });
  }
}
