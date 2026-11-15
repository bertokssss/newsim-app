import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { generateBase32Secret, generateOtpAuthUri, generateRecoveryCodes, getProfileByAuthId, getSessionFromRequest, getJwtSecret } from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { mfaToken } = body;

    let user: any;

    // Either initialized from temporary mfaToken during onboarding, or from authenticated session
    if (mfaToken) {
      try {
        const decoded: any = jwt.verify(mfaToken, getJwtSecret());
        if (decoded?.purpose !== 'MFA_SETUP') {
          return NextResponse.json(
            { success: false, error: 'Invalid token purpose for MFA setup.' },
            { status: 403 }
          );
        }
        const profile = await getProfileByAuthId(decoded.userId);
        if (!profile) {
          return NextResponse.json(
            { success: false, error: 'User profile not found.' },
            { status: 403 }
          );
        }
        const role = (profile.role || '').toString().toUpperCase();
        if (role !== 'TRAINEE') {
          return NextResponse.json(
            { success: false, error: 'Unauthorized portal role for trainee MFA setup.' },
            { status: 403 }
          );
        }
        if (profile.mfa_enabled) {
          return NextResponse.json(
            { success: false, error: 'MFA is already enabled on this account.' },
            { status: 403 }
          );
        }
        user = { id: profile.id, email: profile.email };
      } catch {
        return NextResponse.json(
          { success: false, error: 'Setup token expired. Please login again.' },
          { status: 401 }
        );
      }
    } else {
      const session = getSessionFromRequest(req);
      if (session) {
        const role = (session.activeUser?.role || '').toString().toUpperCase();
        if (role !== 'TRAINEE') {
          return NextResponse.json(
            { success: false, error: 'Unauthorized portal role for trainee MFA setup.' },
            { status: 403 }
          );
        }
        const profile = await getProfileByAuthId(session.activeUser.id);
        if (profile?.mfa_enabled) {
          return NextResponse.json(
            { success: false, error: 'MFA is already enabled on this account.' },
            { status: 403 }
          );
        }
        user = session.activeUser;
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to setup MFA.' },
        { status: 401 }
      );
    }

    const secret = generateBase32Secret(32);
    const otpAuthUri = generateOtpAuthUri(user.email, 'NEWSIM Maritime System', secret);
    const { plaintext: recoveryCodes, hashed: hashedCodes } = generateRecoveryCodes(6);

    return NextResponse.json({
      success: true,
      secret,
      otpAuthUri,
      recoveryCodes,
      hashedCodesJson: JSON.stringify(hashedCodes),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate MFA setup credentials.' },
      { status: 500 }
    );
  }
}
