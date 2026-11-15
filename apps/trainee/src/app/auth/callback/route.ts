import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAdmin, db, UserRecord, dispatchNotificationEvent, NOTIFICATION_EVENTS, resilientFetch } from '@newsim/database';
import {
  getProfileByAuthId,
  createSessionToken,
  setSessionCookies,
  logAuditEvent,
  recordTermsAcceptance,
  TERMS_VERSION,
  PRIVACY_VERSION,
  resolveSafeAppOrigin,
  resolveEffectivePermissionsForUser,
  getJwtSecret,
  sendGoogleNumberMatchEmail,
} from '@newsim/auth';

function generateNumberMatchChallenge(targetNumber: number): number[] {
  const choices = new Set<number>([targetNumber]);
  while (choices.size < 3) {
    choices.add(crypto.randomInt(10, 100));
  }
  const arr = Array.from(choices);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * OAuth Callback Route
 *
 * Handles the redirect from Supabase after Google or Facebook OAuth authentication.
 * Flow: Provider → Supabase OAuth callback → this route with ?code=...
 *
 * This route:
 * 1. Exchanges the authorization code for a Supabase session using the SSR server client (with cookies for PKCE verifier)
 * 2. Retrieves the authenticated user and OAuth provider (Google or Facebook)
 * 3. Fetches or creates a NEWSIM profile (role=TRAINEE only)
 * 4. Ensures a corresponding trainee record exists in public.trainees
 * 5. Validates role and account status
 * 6. For new registrations, redirects first to Trainee Access (/login) with a success notification
 * 7. For existing trainee logins, creates a NEWSIM session token, sets cookies, and redirects to dashboard (or validated next URL)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = resolveSafeAppOrigin(request, 'http://localhost:3002');
  const code = searchParams.get('code');
  const flowId = searchParams.get('sb_flow_id') || undefined;
  const oauthError = searchParams.get('error');
  const nextParam = searchParams.get('next');
  const termsAgreed =
    searchParams.get('terms_agreed') === '1' ||
    request.cookies.get('newsim_oauth_terms')?.value === '1';
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'Browser';

  // 1. Validate the authorization code
  if (!code) {
    console.error('OAuth callback: missing authorization code', oauthError || '');
    return NextResponse.redirect(
      `${origin}/login?error=${oauthError ? 'google_signin_failed' : 'missing_code'}`
    );
  }

  // Validate next redirect destination against open-redirect vulnerability
  const safeNext =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/dashboard';

  // Collect Supabase SSR cookies during code exchange so we can persist them directly on the redirect response.
  const pendingSupabaseCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: resilientFetch,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const item of cookiesToSet) {
            pendingSupabaseCookies.push(item);
          }
        },
      },
    }
  );

  // 2. Exchange the code for a Supabase session using @supabase/ssr server client
  // This automatically reads the PKCE code_verifier stored in cookies by createBrowserClient
  let authUser: any = null;
  try {
    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);

    if (exchangeError) {
      // Check whether a concurrent callback request already exchanged the single-use code into a valid session.
      const { data: existingUserData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (existingUserData?.user) {
        authUser = existingUserData.user;
      } else {
        console.error('OAuth callback: code exchange failed:', exchangeError.message);
        logAuditEvent({
          actorEmail: 'unknown',
          actorRole: 'ANONYMOUS',
          action: 'OAUTH_CALLBACK_FAILED',
          targetType: 'USER',
          details: { reason: exchangeError.message },
          ipAddress: ip,
          userAgent,
          status: 'FAILED',
          severity: 'WARNING',
        });
        return NextResponse.redirect(
          `${origin}/login?error=oauth_callback_failed`
        );
      }
    } else {
      authUser = sessionData?.user;
      if (!authUser) {
        const { data: userData } = await supabase.auth.getUser();
        authUser = userData?.user;
      }
    }
  } catch (err: any) {
    console.error('OAuth callback: exception during session exchange:', err?.message || err);
    return NextResponse.redirect(
      `${origin}/login?error=oauth_callback_failed`
    );
  }

  if (!authUser) {
    console.error('OAuth callback: no authenticated user found after code exchange');
    return NextResponse.redirect(
      `${origin}/login?error=oauth_callback_failed`
    );
  }

  const authEmail = authUser.email || '';
  const provider = authUser.app_metadata?.provider || 'oauth';
  const flow = searchParams.get('flow') || request.cookies.get('newsim_oauth_flow')?.value || null;

  // 3. Fetch existing NEWSIM profile
  let profile = await getProfileByAuthId(authUser.id);

  // If no profile by ID, check if an existing profile exists with the same email
  if (!profile && authEmail) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', authEmail)
      .maybeSingle();

    if (profileByEmail) {
      if ((profileByEmail.role || '').toUpperCase() === 'TRAINEE') {
        // Link existing trainee profile with this OAuth account
        profile = profileByEmail;
      } else {
        logAuditEvent({
          actorEmail: authEmail,
          actorRole: profileByEmail.role || 'TRAINEE',
          action: 'OAUTH_EMAIL_ALREADY_EXISTS',
          targetType: 'USER',
          details: { provider, existingRole: profileByEmail.role },
          ipAddress: ip,
          userAgent,
          severity: 'WARNING',
        });

        return NextResponse.redirect(
          `${origin}/login?error=account_already_exists`
        );
      }
    }
  }

  const isNewRegistration = !profile;

  // If an existing profile exists, validate role and status before proceeding
  if (profile) {
    const rawRole = (profile.role || '').toString().toUpperCase();
    if (rawRole !== 'TRAINEE') {
      logAuditEvent({
        actorId: authUser.id,
        actorEmail: authEmail,
        actorRole: rawRole,
        action: 'LOGIN_REJECTED_UNAUTHORIZED_PORTAL',
        targetType: 'USER',
        details: { role: rawRole, provider },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'WARNING',
      });
      return NextResponse.redirect(
        `${origin}/login?error=unauthorized_portal`
      );
    }

    const existingStatus = (profile.status || 'ACTIVE').toString().toUpperCase();
    if (existingStatus === 'SUSPENDED') {
      return NextResponse.redirect(`${origin}/login?error=account_suspended`);
    }
    if (existingStatus === 'LOCKED') {
      return NextResponse.redirect(`${origin}/login?error=account_locked`);
    }
    if (existingStatus === 'INACTIVE') {
      return NextResponse.redirect(`${origin}/login?error=account_inactive`);
    }
    if (existingStatus === 'PENDING') {
      return NextResponse.redirect(`${origin}/login?error=account_pending`);
    }
  }

  // 4. Third-Party (Google) Registration Security Confirmation:
  // If initiated from /register OR if this is a brand-new OAuth trainee account,
  // enforce the 2-digit Number-Matching Security Challenge before completing registration.
  if (flow === 'register' || isNewRegistration) {
    const meta = authUser.user_metadata || {};
    const firstName =
      meta.given_name ||
      meta.first_name ||
      meta.full_name?.split(' ')[0] ||
      meta.name?.split(' ')[0] ||
      profile?.first_name ||
      'Trainee';
    const lastName =
      meta.family_name ||
      meta.last_name ||
      meta.full_name?.split(' ').slice(1).join(' ') ||
      meta.name?.split(' ').slice(1).join(' ') ||
      profile?.last_name ||
      'Account';
    const avatarUrl =
      meta.avatar_url ||
      meta.picture?.data?.url ||
      (typeof meta.picture === 'string' ? meta.picture : null) ||
      profile?.avatar_url ||
      null;

    const targetNumber = crypto.randomInt(10, 100);
    const options = generateNumberMatchChallenge(targetNumber);
    const jti = crypto.randomUUID();
    const targetHmac = crypto
      .createHmac('sha256', getJwtSecret())
      .update(`${jti}:${targetNumber}`)
      .digest('hex');

    const fullName = `${firstName} ${lastName}`.trim() || authEmail;
    await sendGoogleNumberMatchEmail(authEmail, fullName, targetNumber);

    const googleMatchToken = jwt.sign(
      {
        purpose: 'GOOGLE_REGISTRATION_MATCH',
        jti,
        userId: authUser.id,
        email: authEmail,
        firstName,
        lastName,
        avatarUrl,
        provider,
        termsAgreed: Boolean(termsAgreed),
        options,
        targetHmac,
      },
      getJwtSecret(),
      { expiresIn: '10m' }
    );

    logAuditEvent({
      actorId: profile?.id || undefined,
      actorEmail: authEmail,
      actorRole: 'TRAINEE',
      action: 'GOOGLE_NUMBER_MATCH_CHALLENGE_ISSUED',
      targetType: 'USER',
      details: { authUserId: authUser.id, provider, isNewRegistration },
      ipAddress: ip,
      userAgent,
      severity: 'INFO',
    });

    const matchRedirect = NextResponse.redirect(
      `${origin}/register?google_match=1&token=${encodeURIComponent(googleMatchToken)}`
    );
    matchRedirect.cookies.delete('newsim_oauth_flow');
    matchRedirect.cookies.delete('newsim_oauth_terms');
    matchRedirect.cookies.delete('trainee_session_token');
    matchRedirect.cookies.delete('session_token');
    return matchRedirect;
  }

  // 5. Profile must exist at this point (existing trainee login)
  if (!profile) {
    console.error('OAuth callback: profile not found for user', authUser.id);
    return NextResponse.redirect(
      `${origin}/login?error=profile_not_found`
    );
  }

  // 6. Validate role — only TRAINEE can access the Trainee Portal
  const rawRole = (profile.role || '').toString().toUpperCase();

  if (rawRole !== 'TRAINEE') {
    logAuditEvent({
      actorId: authUser.id,
      actorEmail: authEmail,
      actorRole: rawRole,
      action: 'LOGIN_REJECTED_UNAUTHORIZED_PORTAL',
      targetType: 'USER',
      details: { role: rawRole, provider },
      ipAddress: ip,
      userAgent,
      status: 'FAILED',
      severity: 'WARNING',
    });
    return NextResponse.redirect(
      `${origin}/login?error=unauthorized_portal`
    );
  }

  // 6b. Ensure corresponding record exists in public.trainees table (SRN MUST remain NULL for new Google trainees)
  try {
    const { data: existingTrainee } = await supabaseAdmin
      .from('trainees')
      .select('profile_id, srn, trainee_number')
      .eq('profile_id', authUser.id)
      .maybeSingle();

    if (!existingTrainee) {
      // SECTION 4 & 9: SRN MUST remain NULL when a NEW trainee registers through Google.
      // NEVER generate an SRN, UUID, timestamp, or random number.
      const { error: traineeError } = await supabaseAdmin
        .from('trainees')
        .insert({
          profile_id: authUser.id,
          srn: null,
          trainee_number: null,
          enrollment_status: 'ACTIVE',
        });

      if (traineeError) {
        console.warn('OAuth callback: trainees insert notice:', traineeError);
      }
    } else {
      // SECTION 8: If an existing trainee already has an SRN and logs in using Google:
      // DO NOT erase the SRN. DO NOT set it back to NULL. DO NOT replace it with the Google ID.
      // The existing SRN remains completely preserved.
    }
  } catch (err) {
    console.warn('OAuth callback: trainees table sync error:', err);
  }

  // 7. Validate account status
  const status = (profile.status || 'ACTIVE').toString().toUpperCase();

  if (status === 'SUSPENDED') {
    return NextResponse.redirect(
      `${origin}/login?error=account_suspended`
    );
  }

  if (status === 'LOCKED') {
    return NextResponse.redirect(
      `${origin}/login?error=account_locked`
    );
  }

  if (status === 'INACTIVE') {
    return NextResponse.redirect(
      `${origin}/login?error=account_inactive`
    );
  }

  if (status === 'PENDING') {
    return NextResponse.redirect(
      `${origin}/login?error=account_pending`
    );
  }

  const resolvedPermissions = await resolveEffectivePermissionsForUser(authUser.id, 'TRAINEE');

  // 9. Existing user login: Create NEWSIM session and redirect to dashboard
  const userRecord: UserRecord = {
    id: authUser.id,
    email: authEmail,
    username: profile.username || (authEmail ? authEmail.split('@')[0] : ''),
    passwordHash: '',
    role: 'TRAINEE',
    status: 'ACTIVE',
    firstName: profile.first_name || '',
    lastName: profile.last_name || '',
    department: profile.department || '',
    permissions: resolvedPermissions,
    mfaEnabled: false,
    failedLoginAttempts: 0,
    mustChangePassword: false,
    createdAt: profile.created_at || new Date().toISOString(),
    updatedAt: profile.updated_at || new Date().toISOString(),
  };

  // Keep in-memory DB in sync for session validation
  try {
    if (!db.getUserById(userRecord.id)) {
      db.createUser(userRecord);
    }
  } catch {
    // non-blocking
  }

  const { token } = createSessionToken(userRecord, ip, userAgent);

  // Update last_login_at in Supabase profiles
  try {
    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', authUser.id);
  } catch {
    // non-blocking
  }

  logAuditEvent({
    actorId: authUser.id,
    actorEmail: authEmail,
    actorRole: 'TRAINEE',
    action: 'LOGIN_SUCCESS',
    targetType: 'SESSION',
    details: { method: `${provider.toUpperCase()}_OAUTH`, provider },
    ipAddress: ip,
    userAgent,
    severity: 'INFO',
  });

  // 10. Set session cookies and redirect to destination
  const redirectUrl = `${origin}${safeNext}`;
  const response = NextResponse.redirect(redirectUrl);
  for (const { name, value, options } of pendingSupabaseCookies) {
    response.cookies.set(name, value, options);
  }
  response.cookies.delete('newsim_oauth_flow');
  response.cookies.delete('newsim_oauth_terms');
  setSessionCookies(response, token, 'TRAINEE');

  return response;
}
