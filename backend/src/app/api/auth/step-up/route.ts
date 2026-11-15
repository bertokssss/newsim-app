import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getSessionFromRequest } from '@newsim/auth';
import { verifyTOTP } from '@newsim/auth';
import { logAuditEvent } from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { activeUser } = session;
    const body = await req.json();
    const { password, mfaCode, actionName } = body;

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // 1. Password check
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Current password is required to authorize this critical operation.' },
        { status: 400 }
      );
    }

    const passwordValid = await bcrypt.compare(password, activeUser.passwordHash);
    if (!passwordValid) {
      logAuditEvent({
        actorId: activeUser.id,
        actorEmail: activeUser.email,
        actorRole: activeUser.role,
        action: 'STEP_UP_AUTH_FAILED',
        details: { reason: 'Invalid password', actionName },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'CRITICAL',
      });

      return NextResponse.json(
        { success: false, error: 'Incorrect password confirmation.' },
        { status: 401 }
      );
    }

    // 2. MFA check if MFA is enabled
    if (activeUser.mfaEnabled && activeUser.mfaSecret) {
      if (!mfaCode) {
        return NextResponse.json(
          { success: false, error: 'MFA 6-digit verification code is required for step-up authentication.' },
          { status: 400 }
        );
      }

      const mfaValid = verifyTOTP(mfaCode, activeUser.mfaSecret);
      if (!mfaValid) {
        logAuditEvent({
          actorId: activeUser.id,
          actorEmail: activeUser.email,
          actorRole: activeUser.role,
          action: 'STEP_UP_AUTH_FAILED',
          details: { reason: 'Invalid TOTP code', actionName },
          ipAddress: ip,
          userAgent,
          status: 'FAILED',
          severity: 'CRITICAL',
        });

        return NextResponse.json(
          { success: false, error: 'Invalid 6-digit MFA security code.' },
          { status: 401 }
        );
      }
    }

    logAuditEvent({
      actorId: activeUser.id,
      actorEmail: activeUser.email,
      actorRole: activeUser.role,
      action: 'STEP_UP_AUTH_SUCCESS',
      details: { actionName },
      ipAddress: ip,
      userAgent,
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({
      success: true,
      message: 'Step-up verification passed. Operation authorized.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Step-up authentication failed.' },
      { status: 500 }
    );
  }
}
