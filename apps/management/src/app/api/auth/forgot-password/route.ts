import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import {
  generatePasswordResetLink,
  resetPassword,
  sendPasswordResetEmail,
  logAuditEvent,
  checkPasswordResetRateLimit,
  recordPasswordResetRequested,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  isHoneypotTriggered,
  sanitizeEmail,
  isValidEmail,
  resolveSafeAppOrigin,
} from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`mgmt-forgot:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) {
      return createRateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json();
    if (isHoneypotTriggered(body)) {
      return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
    }

    const { email } = body;
    const trimmedEmail = sanitizeEmail(email);

    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }
    const origin = resolveSafeAppOrigin(req, 'http://localhost:3000');
    const redirectTo = `${origin}/reset-password?email=${encodeURIComponent(trimmedEmail)}`;

    let actionLink: string | null = null;
    let recipientName = 'Administrator';

    // 1. Check if profile exists
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, role, status, last_password_reset_at')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (profile) {
      recipientName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Administrator';

      // Check 24-hour rate limit: only one reset every 24 hours
      const limitCheck = await checkPasswordResetRateLimit(profile);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { success: false, error: limitCheck.error },
          { status: 429 }
        );
      }
    }

    // 2. Generate recovery link via Supabase Admin API
    try {
      const linkResult = await generatePasswordResetLink(trimmedEmail, redirectTo);
      if (linkResult?.properties?.action_link) {
        actionLink = linkResult.properties.action_link;
      }
    } catch (genErr) {
      console.warn('generatePasswordResetLink notice (continuing with standard reset):', genErr);
    }

    // 3. Trigger Supabase password reset email as well
    try {
      await resetPassword(trimmedEmail, redirectTo);
    } catch {
      // Handled safely
    }

    // 4. Send custom styled email via nodemailer if actionLink was generated
    if (actionLink) {
      await sendPasswordResetEmail(trimmedEmail, recipientName, actionLink, 'NEWSIM Management Portal');
    }

    if (profile?.id) {
      await recordPasswordResetRequested(profile.id);
    }

    const userAgent = req.headers.get('user-agent') || 'Browser';

    logAuditEvent({
      actorEmail: trimmedEmail,
      actorRole: 'ANONYMOUS',
      action: 'PASSWORD_RESET_REQUESTED',
      targetType: 'USER',
      details: { email: trimmedEmail, portal: 'MANAGEMENT' },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    return NextResponse.json({
      success: true,
      message: 'A password reset link has been dispatched to your email address. Please check your inbox to proceed with resetting your password.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({
      success: true,
      message: 'If an account is associated with this email, a password reset link has been sent.',
    });
  }
}
