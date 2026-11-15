import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  verifyRecoveryTokenAndReset,
  updatePassword,
  getSessionFromRequest,
  logAuditEvent,
  validateStrongPassword,
  checkPasswordResetRateLimit,
  recordPasswordResetCompleted,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`instructor-reset:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) {
      return createRateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json();
    const { newPassword, accessToken, email, code, token_hash, tokenHash } = body;

    // 1. Enforce 12-character strong password input validation
    const passwordCheck = validateStrongPassword(newPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { success: false, error: passwordCheck.error },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(req);
    const authHeader = req.headers.get('authorization');
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const cookieToken = req.cookies.get('session_token')?.value;
    const token = accessToken || headerToken || cookieToken;
    const resolvedTokenHash = token_hash || tokenHash;

    let targetUserId: string | null = null;
    let targetUserEmail: string | null = email ? email.trim().toLowerCase() : null;

    // Check 24-hour rate limit before executing password reset
    if (targetUserEmail) {
      const limitCheck = await checkPasswordResetRateLimit(targetUserEmail);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { success: false, error: limitCheck.error },
          { status: 429 }
        );
      }
    }

    // Attempt 1 & 2: Verify PKCE code or Supabase recovery token_hash without modifying password until status/cooldown verified
    let verifiedUser: { id: string; email?: string | null } | null = null;
    if (code) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sc = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        );
        const { data: exData, error: exErr } = await sc.auth.exchangeCodeForSession(code);
        if (!exErr && exData?.user) {
          verifiedUser = { id: exData.user.id, email: exData.user.email };
        }
      } catch (cErr) {
        console.warn('Code exchange note in reset password:', cErr);
      }
    }

    if (!verifiedUser && resolvedTokenHash) {
      try {
        const { data: otpData, error: otpErr } = await supabaseAdmin.auth.verifyOtp({
          token_hash: resolvedTokenHash,
          type: 'recovery',
        });
        if (!otpErr && otpData?.user) {
          verifiedUser = { id: otpData.user.id, email: otpData.user.email };
        }
      } catch (oErr) {
        console.warn('OTP verify note in reset password:', oErr);
      }
    }

    if (verifiedUser) {
      const { data: profileRow } = await supabaseAdmin
        .from('profiles')
        .select('id, email, status, offense_level, last_password_reset_at')
        .eq('id', verifiedUser.id)
        .maybeSingle();

      if (
        profileRow &&
        (['SUSPENDED', 'LOCKED'].includes(String(profileRow.status || '').toUpperCase()) ||
          Number(profileRow.offense_level || 0) >= 3)
      ) {
        return NextResponse.json(
          { success: false, error: 'Account is permanently suspended and requires authorized administrator activation.' },
          { status: 403 }
        );
      }
      if (profileRow) {
        const limitCheck = await checkPasswordResetRateLimit(profileRow);
        if (!limitCheck.allowed) {
          return NextResponse.json({ success: false, error: limitCheck.error }, { status: 429 });
        }
      }

      await supabaseAdmin.auth.admin.updateUserById(verifiedUser.id, { password: newPassword });
      targetUserId = verifiedUser.id;
      targetUserEmail = verifiedUser.email || targetUserEmail;
    }

    // Attempt 3: Cryptographically verified Supabase recovery access_token (verified via Supabase Auth)
    if (!targetUserId && (accessToken || headerToken)) {
      const recoveryJwt = accessToken || headerToken;
      if (recoveryJwt) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const sc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } }
          );
          const { data: userData, error: userErr } = await sc.auth.getUser(recoveryJwt);
          if (!userErr && userData?.user) {
            const { data: profileRow } = await supabaseAdmin
              .from('profiles')
              .select('id, email, status, offense_level, last_password_reset_at')
              .eq('id', userData.user.id)
              .maybeSingle();

            if (
              profileRow &&
              (['SUSPENDED', 'LOCKED'].includes(String(profileRow.status || '').toUpperCase()) ||
                Number(profileRow.offense_level || 0) >= 3)
            ) {
              return NextResponse.json(
                {
                  success: false,
                  error: 'Account is permanently suspended and requires authorized administrator activation.',
                },
                { status: 403 }
              );
            }

            if (profileRow) {
              const limitCheck = await checkPasswordResetRateLimit(profileRow);
              if (!limitCheck.allowed) {
                return NextResponse.json({ success: false, error: limitCheck.error }, { status: 429 });
              }
            }

            await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
              password: newPassword,
            });
            targetUserId = userData.user.id;
            targetUserEmail = userData.user.email || targetUserEmail;
          }
        } catch (tokErr) {
          console.warn('Recovery token verification failed in reset password:', tokErr);
        }
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Unable to verify password reset authorization. Please request a new password reset link.' },
        { status: 401 }
      );
    }

    // Record password reset completion & start the 24-hour cooldown (preserve permanent suspensions)
    await recordPasswordResetCompleted(targetUserId);
    await supabaseAdmin
      .from('profiles')
      .update({
        failed_login_attempts: 0,
        lockout_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .not('status', 'in', '("SUSPENDED","LOCKED")');

    const userAgent = req.headers.get('user-agent') || 'Browser';

    logAuditEvent({
      actorId: targetUserId || session?.userId || 'UNKNOWN',
      actorEmail: targetUserEmail || session?.email || 'UNKNOWN',
      actorRole: session?.role || 'INSTRUCTOR',
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'USER',
      targetId: targetUserId || undefined,
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully. You may now sign in with your new password.',
    });
  } catch (error: any) {
    console.error('INSTRUCTOR reset password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update password. Please try requesting a new link.' },
      { status: 400 }
    );
  }
}
