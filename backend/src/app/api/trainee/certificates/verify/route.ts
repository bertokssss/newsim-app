import { NextRequest, NextResponse } from 'next/server';
import { verifyCertificateCode } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code') || '';

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
