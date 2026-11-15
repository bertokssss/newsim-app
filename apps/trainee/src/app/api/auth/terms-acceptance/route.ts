import { NextRequest, NextResponse } from 'next/server';
import {
  verifyTraineeRequest,
  createUnauthorizedResponse,
  createForbiddenResponse,
  recordTermsAcceptance,
  TERMS_VERSION,
  PRIVACY_VERSION,
  getClientIp,
} from '@newsim/auth';

export async function POST(req: NextRequest) {
  const auth = verifyTraineeRequest(req);
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 403
      ? createForbiddenResponse(auth.error)
      : createUnauthorizedResponse(auth.error);
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.agreedToTerms) {
      return NextResponse.json(
        { success: false, error: 'Explicit agreement to the Terms and Conditions is required.' },
        { status: 400 }
      );
    }

    const acceptanceContext =
      body?.acceptanceContext === 'SETTINGS' || body?.acceptanceContext === 'PORTAL_UPDATE'
        ? body.acceptanceContext
        : 'OAUTH_ONBOARDING';

    const result = await recordTermsAcceptance({
      userId: auth.user.id,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent') || 'Browser',
      acceptanceContext,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to record terms acceptance.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      termsVersion: TERMS_VERSION,
      acceptedAt: result.acceptedAt,
    });
  } catch (err) {
    console.error('Terms acceptance API error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to process terms acceptance.' },
      { status: 500 }
    );
  }
}
