import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRecaptchaToken,
  GOOGLE_RECAPTCHA_V2_FALLBACK_SITE_KEY,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from '@newsim/auth';
import {
  OAUTH_CAPTCHA_COOKIE,
  OAUTH_CAPTCHA_TTL_SECONDS,
  createOauthCaptchaPass,
} from '@/lib/oauth-captcha';

export const dynamic = 'force-dynamic';

const originKeyCache = new Map<string, { siteKey: string; fallback: boolean; expiresAt: number }>();

async function isSiteKeyValidForOrigin(siteKey: string, originUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(originUrl);
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    const co = Buffer.from(`${parsed.protocol}//${parsed.hostname}:${port}`)
      .toString('base64')
      .replace(/=/g, '.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(
        `https://www.google.com/recaptcha/api2/anchor?ar=1&k=${encodeURIComponent(siteKey)}&co=${encodeURIComponent(co)}&hl=en&size=normal`,
        { signal: controller.signal }
      );
      if (!res.ok) return false;
      const html = await res.text();
      if (html.includes('recaptcha.anchor.ErrorMain.init')) {
        return false;
      }
      return html.includes('recaptcha.anchor.Main.init');
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return true;
  }
}

/**
 * GET /api/auth/recaptcha/verify?origin=...
 *
 * Resolves the active reCAPTCHA v2 Checkbox site key for the current browser origin.
 * Uses the configured NEXT_PUBLIC_RECAPTCHA_SITE_KEY when authorized for the origin,
 * or falls back to the universal v2 Checkbox key if the deployment domain has not
 * yet been added to the Google reCAPTCHA Admin Console.
 */
export async function GET(req: NextRequest) {
  const configuredKey = (
    process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY ||
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
    ''
  ).trim();

  if (!configuredKey) {
    return NextResponse.json({
      success: true,
      siteKey: GOOGLE_RECAPTCHA_V2_FALLBACK_SITE_KEY,
      mode: 'v2',
      fallback: true,
    });
  }

  const originParam = req.nextUrl.searchParams.get('origin') || req.nextUrl.origin;
  const cacheKey = `${configuredKey}::${originParam}`;
  const cached = originKeyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      success: true,
      siteKey: cached.siteKey,
      mode: 'v2',
      fallback: cached.fallback,
    });
  }

  const validForOrigin = await isSiteKeyValidForOrigin(configuredKey, originParam);
  const resolvedKey = validForOrigin ? configuredKey : GOOGLE_RECAPTCHA_V2_FALLBACK_SITE_KEY;

  originKeyCache.set(cacheKey, {
    siteKey: resolvedKey,
    fallback: !validForOrigin,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  return NextResponse.json({
    success: true,
    siteKey: resolvedKey,
    mode: 'v2',
    fallback: !validForOrigin,
  });
}

/**
 * POST /api/auth/recaptcha/verify
 *
 * Verifies a Google reCAPTCHA v2 token server-side.
 * When `action === 'google_register'`, a short-lived signed pass cookie is issued so that
 * /auth/callback can confirm the third-party (Google) registration passed reCAPTCHA.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`recaptcha-verify:${ip}`, { limit: 20, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return createRateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token : '';
    const action = typeof body?.action === 'string' ? body.action : undefined;

    const result = await verifyRecaptchaToken(token, {
      remoteIp: ip,
      mode: 'v2',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'reCAPTCHA verification failed. Please try again.' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      score: result.score,
      action: result.action,
    });

    if (action === 'google_register') {
      response.cookies.set(OAUTH_CAPTCHA_COOKIE, createOauthCaptchaPass(), {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: OAUTH_CAPTCHA_TTL_SECONDS,
      });
    }

    return response;
  } catch (error: unknown) {
    console.error('reCAPTCHA verify endpoint error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error verifying reCAPTCHA.' },
      { status: 500 }
    );
  }
}
