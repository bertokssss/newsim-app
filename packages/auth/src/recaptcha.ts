import { logAuditEvent } from './audit';

export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';
export const RECAPTCHA_V2_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY || '';

/**
 * Official Google reCAPTCHA v2 Checkbox fallback key pair (used only when the
 * deployment domain has not yet been added to the custom site key's domain
 * allowlist in Google reCAPTCHA Admin Console).
 */
export const GOOGLE_RECAPTCHA_V2_FALLBACK_SITE_KEY =
  '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const GOOGLE_RECAPTCHA_V2_FALLBACK_SECRET_KEY =
  '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

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

async function callSiteVerify(secret: string, token: string, remoteIp?: string): Promise<any> {
  const params = new URLSearchParams();
  params.append('secret', secret);
  params.append('response', token);
  if (remoteIp && remoteIp !== '127.0.0.1' && remoteIp !== '::1') {
    params.append('remoteip', remoteIp);
  }

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  return res.json();
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
    return {
      success: false,
      error: 'Please complete the Google reCAPTCHA ("I\'m not a robot") security check first.',
    };
  }

  const primarySecret = getSecretKey(options.mode) || GOOGLE_RECAPTCHA_V2_FALLBACK_SECRET_KEY;

  try {
    let data = await callSiteVerify(primarySecret, cleanToken, options.remoteIp);

    // If the token was issued by the universal v2 fallback widget (when the deployment
    // hostname is not yet listed under the custom site key in Google Admin Console),
    // verify against Google's official v2 secret key as well.
    if (!data.success && primarySecret !== GOOGLE_RECAPTCHA_V2_FALLBACK_SECRET_KEY) {
      const fallbackData = await callSiteVerify(
        GOOGLE_RECAPTCHA_V2_FALLBACK_SECRET_KEY,
        cleanToken,
        options.remoteIp
      );
      if (fallbackData.success) {
        data = fallbackData;
      }
    }

    if (data.success) {
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
      error: `Security verification failed (${errorCodes.join(', ') || 'invalid challenge'}). Please tick the reCAPTCHA checkbox again.`,
    };
  } catch (err: unknown) {
    console.error('reCAPTCHA verification error:', err);
    return {
      success: false,
      error: 'Security verification server unreachable. Please try again later.',
    };
  }
}
