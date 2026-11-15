import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptchaToken } from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    const result = await verifyRecaptchaToken(token);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'reCAPTCHA verification failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      score: result.score,
      action: result.action,
    });
  } catch (error: any) {
    console.error('reCAPTCHA verify endpoint error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error verifying reCAPTCHA.' },
      { status: 500 }
    );
  }
}
