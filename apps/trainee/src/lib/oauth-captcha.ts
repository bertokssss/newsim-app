import crypto from 'crypto';
import { getJwtSecret } from '@newsim/auth';

/**
 * Short-lived, HMAC-signed proof that the browser passed the Google reCAPTCHA
 * challenge on the Register page right before starting Google (third-party) OAuth.
 *
 * Flow:
 *   1. Register page executes reCAPTCHA (action `google_register`).
 *   2. POST /api/auth/recaptcha/verify validates the token with Google and sets this cookie.
 *   3. /auth/callback requires a valid pass before provisioning a NEW Google trainee account.
 *
 * Manual (email + password) registration does NOT use this — it is verified by email OTP.
 */
export const OAUTH_CAPTCHA_COOKIE = 'newsim_oauth_captcha';
export const OAUTH_CAPTCHA_TTL_SECONDS = 10 * 60;

function sign(payload: string): string {
  return crypto
    .createHmac('sha256', `newsim-oauth-captcha:${getJwtSecret()}`)
    .update(payload)
    .digest('hex');
}

export function createOauthCaptchaPass(): string {
  const nonce = crypto.randomBytes(12).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + OAUTH_CAPTCHA_TTL_SECONDS;
  const payload = `${nonce}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyOauthCaptchaPass(value?: string | null): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [nonce, expRaw, signature] = parts;
  const exp = Number(expRaw);
  if (!nonce || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const expected = sign(`${nonce}.${expRaw}`);
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
