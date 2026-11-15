import crypto from 'crypto';

/**
 * Standard RFC 6238 TOTP Implementation
 * Uses Node.js crypto for robust HMAC-SHA1 calculation without external native dependencies.
 */

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length = 32): string {
  const randomBytes = crypto.randomBytes(length);
  let secret = '';
  for (let i = 0; i < randomBytes.length; i++) {
    secret += BASE32_CHARS[randomBytes[i] % 32];
  }
  return secret;
}

function base32Decode(base32: string): Buffer {
  const cleanBase32 = base32.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (let i = 0; i < cleanBase32.length; i++) {
    const val = BASE32_CHARS.indexOf(cleanBase32.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTOTP(secret: string, timeStep = 30, time = Date.now()): string {
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  const key = base32Decode(cleanSecret);
  const epoch = Math.floor(time / 1000);
  const counter = Math.floor(epoch / timeStep);

  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const codeInt =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const code = (codeInt % 1000000).toString().padStart(6, '0');
  return code;
}

export function verifyTOTP(token: string, secret: string, window = 1, timeStep = 30): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.trim().replace(/\s+/g, '');
  const cleanSecret = secret.trim().replace(/\s+/g, '').toUpperCase();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

  // Real validation only or dev fallback
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.VERCEL_ENV !== 'production' &&
    process.env.ALLOW_DEV_TOTP_BYPASS === 'true' &&
    cleanToken === '000000'
  ) {
    return true;
  }

  const now = Date.now();
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const checkTime = now + errorWindow * timeStep * 1000;
    const generated = generateTOTP(cleanSecret, timeStep, checkTime);
    if (generated === cleanToken) {
      return true;
    }
  }
  return false;
}

export function generateRecoveryCodes(count = 8): { plaintext: string[]; hashed: string[] } {
  const plaintext: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `${part1}-${part2}`;
    plaintext.push(code);

    const hash = crypto.createHash('sha256').update(code).digest('hex');
    hashed.push(hash);
  }

  return { plaintext, hashed };
}

export function verifyRecoveryCode(
  inputCode: string,
  hashedCodesInput: string | string[] | null
): { valid: boolean; updatedHashedCodesJson: string | null } {
  if (!inputCode || !hashedCodesInput) return { valid: false, updatedHashedCodesJson: null };

  const cleanInput = inputCode.trim().toUpperCase();
  const inputHash = crypto.createHash('sha256').update(cleanInput).digest('hex');

  try {
    const parsed = Array.isArray(hashedCodesInput)
      ? [...hashedCodesInput]
      : JSON.parse(hashedCodesInput);
    if (!Array.isArray(parsed)) {
      return { valid: false, updatedHashedCodesJson: null };
    }
    const hashedCodes = parsed.map((c) => String(c));
    const index = hashedCodes.indexOf(inputHash);
    if (index !== -1) {
      // Remove used recovery code
      hashedCodes.splice(index, 1);
      return { valid: true, updatedHashedCodesJson: JSON.stringify(hashedCodes) };
    }
  } catch {
    return { valid: false, updatedHashedCodesJson: null };
  }

  return { valid: false, updatedHashedCodesJson: null };
}

export function generateOtpAuthUri(accountName: string, issuer = 'NEWSIM', secret: string): string {
  const cleanAccount = accountName.trim();
  const cleanIssuer = (issuer || 'NEWSIM').trim();
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  const label = `${encodeURIComponent(cleanIssuer)}:${encodeURIComponent(cleanAccount)}`;
  return `otpauth://totp/${label}?secret=${cleanSecret}&issuer=${encodeURIComponent(cleanIssuer)}`;
}

export const TOTP_INACTIVITY_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in ms (72 hours)

export interface TotpRequirementCheck {
  mfaRequired: boolean;
  mfaSetupRequired: boolean;
  reason: 'FIRST_LOGIN_SETUP' | 'INACTIVE_3_DAYS' | 'RECENT_LOGIN_EXEMPT';
  lastLoginAt?: string | null;
  daysSinceLastLogin?: number;
}

/**
 * Evaluates whether TOTP (App Authenticator) is required for an account on login:
 * 1. If first login for the account (TOTP not yet configured):
 *    -> Provides the QR code for app authenticator, input code to log in.
 * 2. If already enrolled in app authenticator:
 *    -> If logged in within the last 3 days (< 72h): No TOTP required!
 *    -> If account is inactive for 3 days or more (>= 72h): TOTP code from app authenticator is required (like GitHub).
 */
export function checkTotpRequirement(profile: any): TotpRequirementCheck {
  const isMfaEnabled = !!profile?.mfa_enabled && !!profile?.mfa_secret;

  // 1. First login / never configured app authenticator -> Provide QR code setup
  if (!isMfaEnabled) {
    return {
      mfaRequired: true,
      mfaSetupRequired: true,
      reason: 'FIRST_LOGIN_SETUP',
      lastLoginAt: profile?.last_login_at || null,
    };
  }

  // 2. Already configured app authenticator -> evaluate 3-day inactivity window
  const lastLoginStr = profile?.last_login_at || profile?.last_mfa_verified_at;
  if (!lastLoginStr) {
    // No previous login timestamp recorded -> require TOTP code from authenticator
    return {
      mfaRequired: true,
      mfaSetupRequired: false,
      reason: 'INACTIVE_3_DAYS',
      lastLoginAt: null,
      daysSinceLastLogin: Infinity,
    };
  }

  const lastLoginTime = new Date(lastLoginStr).getTime();
  const now = Date.now();
  const elapsed = now - lastLoginTime;
  const daysSince = elapsed / (24 * 60 * 60 * 1000);

  // If 3 days or more of inactivity -> Require TOTP code
  if (elapsed >= TOTP_INACTIVITY_THRESHOLD_MS) {
    return {
      mfaRequired: true,
      mfaSetupRequired: false,
      reason: 'INACTIVE_3_DAYS',
      lastLoginAt: lastLoginStr,
      daysSinceLastLogin: daysSince,
    };
  }

  // Active within 3 days -> Exempt from TOTP on this login
  return {
    mfaRequired: false,
    mfaSetupRequired: false,
    reason: 'RECENT_LOGIN_EXEMPT',
    lastLoginAt: lastLoginStr,
    daysSinceLastLogin: daysSince,
  };
}

