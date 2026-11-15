import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@newsim/database';
import { generateBase32Secret, generateOtpAuthUri, generateRecoveryCodes } from '@newsim/auth';
import { getSessionFromRequest, getProfileByAuthId } from '@newsim/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'newsim-superadmin-secure-jwt-key-maritime-2026';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { mfaToken } = body;

    let user: any;

    // Either initialized from temporary mfaToken during onboarding, or from authenticated session
    if (mfaToken) {
      try {
        const decoded: any = jwt.verify(mfaToken, JWT_SECRET);
        user = db.getUserById(decoded.userId);
        
        if (!user) {
          const profile = await getProfileByAuthId(decoded.userId);
          if (profile) {
            user = {
              id: profile.user_id,
              email: profile.email,
            };
          }
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'Setup token expired. Please login again.' },
          { status: 401 }
        );
      }
    } else {
      const session = getSessionFromRequest(req);
      if (session) {
        user = session.activeUser;
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to setup MFA.' },
        { status: 401 }
      );
    }

    const secret = generateBase32Secret();
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
