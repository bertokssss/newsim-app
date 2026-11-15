import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent, checkRateLimit, getClientIp, createRateLimitResponse } from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`mgmt-setup-pw:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) {
      return createRateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json();
    const { password, accessToken } = body;

    if (!password || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Password and access token are required.' },
        { status: 400 }
      );
    }

    // Validate password strength
    const { validateStrongPassword } = await import('@newsim/auth');
    const passwordCheck = validateStrongPassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json({
        success: false,
        error: passwordCheck.error,
      }, { status: 400 });
    }

    // Verify the access token to get the user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !userData.user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session. Please request a new invitation.' },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    // Verify this user is an admin with pending/active status
    const { data: profile } = await supabaseAdmin.from('profiles').select('role, status').eq('id', userId).single();

    if (!profile || String(profile.role || '').toUpperCase() !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Account not found or not authorized.' },
        { status: 403 }
      );
    }

    // Set the password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: password,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Ensure profile is active (safety net — trigger should have done this)
    await supabaseAdmin.from('profiles').update({ status: 'ACTIVE' }).eq('id', userId).in('status', ['PENDING', 'pending']);

    const userAgent = req.headers.get('user-agent') || 'Browser';

    logAuditEvent({
      actorId: userId,
      actorEmail: userData.user.email || '',
      actorRole: 'ADMIN',
      action: 'ADMIN_PASSWORD_SET',
      targetType: 'ADMIN',
      targetId: userId,
      details: { method: 'INVITATION_SETUP' },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    return NextResponse.json({
      success: true,
      message: 'Password set successfully. Your account is now active.',
    });
  } catch (error: any) {
    console.error('Setup password error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set password. Please try again.' },
      { status: 500 }
    );
  }
}
