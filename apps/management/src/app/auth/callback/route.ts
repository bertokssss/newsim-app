import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { resolveSafeAppOrigin } from '@newsim/auth';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') || '/setup-password';

  function resolveTraineeBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_TRAINEE_URL) {
      return process.env.NEXT_PUBLIC_TRAINEE_URL;
    }
    const safeOrigin = resolveSafeAppOrigin(req, 'http://localhost:3000');
    const traineePort = process.env.NEXT_PUBLIC_TRAINEE_PORT || '3002';
    try {
      const parsed = new URL(safeOrigin);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        parsed.port = traineePort;
        return parsed.origin;
      }
      if (parsed.hostname.includes('-3000.')) {
        parsed.hostname = parsed.hostname.replace('-3000.', `-${traineePort}.`);
        return parsed.origin;
      }
    } catch {
      // fallback below
    }
    return `http://localhost:${traineePort}`;
  }

  const code = searchParams.get('code');
  if (code) {
    const traineeUrl = new URL(`${resolveTraineeBaseUrl()}/auth/callback`);
    searchParams.forEach((val, key) => {
      traineeUrl.searchParams.set(key, val);
    });
    return NextResponse.redirect(traineeUrl);
  }

  const errorParam = searchParams.get('error');
  if (errorParam) {
    const traineeUrl = new URL(`${resolveTraineeBaseUrl()}/login`);
    searchParams.forEach((val, key) => {
      traineeUrl.searchParams.set(key, val);
    });
    return NextResponse.redirect(traineeUrl);
  }

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=invalid_callback', req.url));
  }

  try {
    // Create a temporary Supabase client to exchange the token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify the OTP/token — this confirms the email
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });

    if (error || !data.user) {
      console.error('Token verification failed:', error);
      return NextResponse.redirect(new URL('/login?error=verification_failed', req.url));
    }

    // The Supabase trigger will automatically update profiles.status from 'PENDING' to 'ACTIVE'
    // But let's also do it here cleanly using canonical uppercase status
    await supabaseAdmin
      .from('profiles')
      .update({ status: 'ACTIVE' })
      .eq('id', data.user.id)
      .in('status', ['pending', 'PENDING']);

    // If it was a signup confirmation, they already have a password
    // If it was an invite confirmation, they still need to set it
    const finalNext = type === 'signup' ? '/login?message=Account+activated.+You+can+now+log+in.' : next;
    
    const redirectUrl = new URL(finalNext, req.url);
    if (data.session && type !== 'signup') {
      redirectUrl.searchParams.set('access_token', data.session.access_token);
      redirectUrl.searchParams.set('refresh_token', data.session.refresh_token);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('Auth callback error:', err);
    return NextResponse.redirect(new URL('/login?error=callback_error', req.url));
  }
}
