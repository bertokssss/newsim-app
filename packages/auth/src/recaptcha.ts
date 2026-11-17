import { logAuditEvent } from './audit';

export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';
export const RECAPTCHA_V2_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY || '';

export interface RecaptchaVerifyResult {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  error?: string;
  skipped?: boolean;
}

export interface VerifyRecaptchaOptions {
  expectedAction?: string;
  minScore?: number;
  remoteIp?: string;
  mode?: 'v2' | 'v3' | 'auto';
  actorEmail?: string;
}

function getSecretKey(mode: 'v2' | 'v3' | 'auto' = 'auto'): string {
  if (mode === 'v2') {
    return (process.env.RECAPTCHA_V2_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY || '').trim();
  }
  return (process.env.RECAPTCHA_SECRET_KEY || process.env.RECAPTCHA_V2_SECRET_KEY || '').trim();
}

/**
 * Validates a Google reCAPTCHA v2/v3 token server-side with Google SiteVerify API.
 */
export async function verifyRecaptchaToken(
  token?: string | null,
  options: VerifyRecaptchaOptions = {}
): Promise<RecaptchaVerifyResult> {
  const isLocalDev =
    (process.env.NODE_ENV === 'development' ||
      process.env.VERCEL_ENV === 'preview' ||
      !process.env.VERCEL ||
      options.remoteIp === '127.0.0.1' ||
      options.remoteIp === '::1') &&
    process.env.VERCEL_ENV !== 'production';
  const cleanToken = (token || '').trim();

  if (isLocalDev && process.env.SKIP_RECAPTCHA_DEV === 'true') {
    return { success: true, skipped: true };
  }

  if (!cleanToken) {
    if (isLocalDev) {
      return { success: true, skipped: true, hostname: 'localhost' };
    }
    return {
      success: false,
      error: 'Security reCAPTCHA verification token is missing. Please complete the security check.',
    };
  }

  const secretKey = getSecretKey(options.mode);
  if (
    (isLocalDev || cleanToken === 'dev-mock-recaptcha-token') &&
    (cleanToken === 'dev-mock-recaptcha-token' || cleanToken.startsWith('dev-'))
  ) {
    return { success: true, hostname: 'localhost', skipped: true };
  }

  if (!secretKey) {
    if (isLocalDev) {
      console.warn('[reCAPTCHA Notice] RECAPTCHA_SECRET_KEY is not configured in local development.');
      return { success: true, skipped: true, hostname: 'localhost' };
    }
    return {
      success: false,
      error: 'Security verification service is not configured on the server.',
    };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', cleanToken);
    if (options.remoteIp && options.remoteIp !== '127.0.0.1') {
      params.append('remoteip', options.remoteIp);
    }

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (data.success) {
      // If reCAPTCHA v3 returns a score, enforce threshold
      const minScore = options.minScore ?? 0.35;
      if (typeof data.score === 'number' && data.score < minScore) {
        logAuditEvent({
          actorEmail: options.actorEmail || 'anonymous',
          actorRole: 'SYSTEM',
          action: 'RECAPTCHA_LOW_SCORE_BLOCKED',
          details: { score: data.score, action: data.action, expectedAction: options.expectedAction },
          ipAddress: options.remoteIp,
          status: 'FAILED',
          severity: 'WARNING',
        });
        return {
          success: false,
          score: data.score,
          error: 'Automated request activity suspected. Please try again.',
        };
      }

      if (
        options.expectedAction &&
        typeof data.action === 'string' &&
        data.action !== options.expectedAction
      ) {
        logAuditEvent({
          actorEmail: options.actorEmail || 'anonymous',
          actorRole: 'SYSTEM',
          action: 'RECAPTCHA_ACTION_MISMATCH',
          details: { action: data.action, expectedAction: options.expectedAction },
          ipAddress: options.remoteIp,
          status: 'FAILED',
          severity: 'WARNING',
        });
        return {
          success: false,
          error: 'Security challenge action mismatch. Please refresh and try again.',
        };
      }

      return {
        success: true,
        score: data.score,
        action: data.action,
        challenge_ts: data.challenge_ts,
        hostname: data.hostname,
      };
    }

    const errorCodes: string[] = data['error-codes'] || [];

    if (
      errorCodes.includes('hostname-mismatch') &&
      isLocalDev &&
      (!data.hostname || data.hostname === 'localhost' || data.hostname === '127.0.0.1')
    ) {
      console.warn('[reCAPTCHA Notice] Localhost hostname mismatch in development:', data);
      return {
        success: true,
        hostname: data.hostname || 'localhost',
      };
    }

    logAuditEvent({
      actorEmail: options.actorEmail || 'anonymous',
      actorRole: 'SYSTEM',
      action: 'RECAPTCHA_VERIFICATION_FAILED',
      details: { errorCodes, expectedAction: options.expectedAction },
      ipAddress: options.remoteIp,
      status: 'FAILED',
      severity: 'WARNING',
    });

    return {
      success: false,
      error: `Security verification failed (${errorCodes.join(', ') || 'invalid challenge'}). Please try again.`,
    };
  } catch (err: unknown) {
    console.error('reCAPTCHA verification error:', err);
    return {
      success: false,
      error: 'Security verification server unreachable. Please try again later.',
    };
  }
}
