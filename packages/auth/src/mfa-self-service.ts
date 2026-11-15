import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@newsim/database';
import { logAuditEvent } from './audit';
import { getJwtSecret } from './jwt-secret';
import { getProfileByAuthId, signInWithPassword } from './supabase-auth';
import {
  generateBase32Secret,
  generateOtpAuthUri,
  generateRecoveryCodes,
  verifyTOTP,
} from './totp';

export interface MfaServiceFailure {
  ok: false;
  status: number;
  error: string;
}

export interface PortalTotpSetupInitResult {
  secret: string;
  otpAuthUri: string;
  setupToken: string;
}

export type CompletePortalTotpSetupResult =
  | {
      ok: true;
      mfaEnabled: true;
      recoveryCodes: string[];
    }
  | MfaServiceFailure;

export type RegenerateRecoveryCodesResult =
  | {
      ok: true;
      recoveryCodes: string[];
    }
  | MfaServiceFailure;

/**
 * Checks whether a Supabase Auth user has an email/password identity registered.
 */
export async function userHasLocalPassword(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) return true;
    const providers = Array.isArray(data.user.app_metadata?.providers)
      ? data.user.app_metadata.providers.map((p: unknown) => String(p).toLowerCase())
      : [];
    const identities = Array.isArray(data.user.identities)
      ? data.user.identities.map((i: { provider?: string | null }) => String(i?.provider || '').toLowerCase())
      : [];

    if (providers.length === 0 && identities.length === 0) return true;
    return providers.includes('email') || identities.includes('email');
  } catch {
    return true;
  }
}

/**
 * Verifies the user's current password against Supabase Auth, falling back to legacy bcrypt hash if present.
 */
export async function verifyUserCurrentPassword(
  email: string,
  currentPassword: string,
  fallbackHash?: string
): Promise<boolean> {
  if (!currentPassword) return false;
  try {
    await signInWithPassword(email, currentPassword);
    return true;
  } catch {
    if (fallbackHash) {
      try {
        return await bcrypt.compare(currentPassword, fallbackHash);
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Issues a freshly generated Base32 TOTP secret, otpauth URI, and a signed 15-minute setup token.
 */
export function initializePortalTotpSetup(params: {
  userId: string;
  email: string;
  issuer?: string;
}): PortalTotpSetupInitResult {
  const secret = generateBase32Secret(32);
  const issuer = (params.issuer || 'NEWSIM').trim() || 'NEWSIM';
  const otpAuthUri = generateOtpAuthUri(params.email, issuer, secret);
  const setupToken = jwt.sign(
    {
      purpose: 'PORTAL_MFA_SETUP',
      userId: params.userId,
      secret,
    },
    getJwtSecret(),
    { expiresIn: '15m' }
  );

  return { secret, otpAuthUri, setupToken };
}

/**
 * Verifies a 6-digit TOTP code against a server-signed setupToken and activates RFC 6238 MFA in Supabase.
 */
export async function completePortalTotpSetup(params: {
  userId: string;
  email: string;
  role: string;
  setupToken: string;
  code: string;
  ip: string;
  userAgent: string;
}): Promise<CompletePortalTotpSetupResult> {
  const { userId, email, role, setupToken, code, ip, userAgent } = params;

  if (!setupToken || !code) {
    return {
      ok: false,
      status: 400,
      error: 'Setup verification token and 6-digit authenticator code are required.',
    };
  }

  let decoded: { purpose?: string; userId?: string; secret?: string };
  try {
    decoded = jwt.verify(setupToken, getJwtSecret()) as {
      purpose?: string;
      userId?: string;
      secret?: string;
    };
  } catch {
    return {
      ok: false,
      status: 401,
      error: 'TOTP setup session expired. Please generate a new QR code and try again.',
    };
  }

  if (decoded?.purpose !== 'PORTAL_MFA_SETUP' || decoded?.userId !== userId || !decoded?.secret) {
    return {
      ok: false,
      status: 403,
      error: 'Invalid TOTP setup verification token.',
    };
  }

  if (!verifyTOTP(code, decoded.secret)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid 6-digit authenticator code. Please verify your device clock and try again.',
    };
  }

  const { plaintext, hashed } = generateRecoveryCodes(6);
  const now = new Date().toISOString();

  const { error: updateErr } = await supabaseAdmin
    .from('profiles')
    .update({
      mfa_enabled: true,
      mfa_secret: decoded.secret,
      recovery_codes: JSON.stringify(hashed),
      last_login_at: now,
      updated_at: now,
    })
    .eq('id', userId);

  if (updateErr) {
    return {
      ok: false,
      status: 500,
      error: `Failed to persist Two-Factor Authentication settings: ${updateErr.message}`,
    };
  }

  logAuditEvent({
    actorId: userId,
    actorEmail: email,
    actorRole: role,
    action: 'MFA_ENABLED',
    targetType: 'USER',
    targetId: userId,
    details: { method: 'PORTAL_TOTP_ENROLLMENT' },
    ipAddress: ip,
    userAgent,
    severity: 'INFO',
  });

  return {
    ok: true,
    mfaEnabled: true,
    recoveryCodes: plaintext,
  };
}

/**
 * Verifies user step-up credentials, invalidates prior recovery codes, and issues 6 fresh single-use codes.
 */
export async function regenerateUserRecoveryCodes(params: {
  userId: string;
  email: string;
  role: string;
  currentPassword?: string;
  mfaCode?: string;
  fallbackHash?: string;
  ip: string;
  userAgent: string;
}): Promise<RegenerateRecoveryCodesResult> {
  const { userId, email, role, currentPassword, mfaCode, fallbackHash, ip, userAgent } = params;

  const profile = await getProfileByAuthId(userId);
  if (!profile) {
    return { ok: false, status: 404, error: 'Account profile not found.' };
  }

  if (!profile.mfa_enabled || !profile.mfa_secret) {
    return {
      ok: false,
      status: 400,
      error: 'Two-Factor Authentication (TOTP) must be active before regenerating emergency recovery codes.',
    };
  }

  const hasPassword = await userHasLocalPassword(userId);

  if (hasPassword) {
    if (!currentPassword) {
      return { ok: false, status: 400, error: 'Current password is required to authorize recovery code regeneration.' };
    }
    const pwMatch = await verifyUserCurrentPassword(email, currentPassword, fallbackHash);
    if (!pwMatch) {
      return { ok: false, status: 400, error: 'Current password is incorrect.' };
    }
    if (mfaCode && !verifyTOTP(mfaCode, profile.mfa_secret)) {
      return { ok: false, status: 400, error: 'Invalid 6-digit authenticator code.' };
    }
  } else {
    if (!mfaCode || !verifyTOTP(mfaCode, profile.mfa_secret)) {
      return {
        ok: false,
        status: 400,
        error: 'A valid 6-digit authenticator code is required to regenerate emergency recovery codes.',
      };
    }
  }

  const { plaintext, hashed } = generateRecoveryCodes(6);
  const { error: updateErr } = await supabaseAdmin
    .from('profiles')
    .update({
      recovery_codes: JSON.stringify(hashed),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateErr) {
    return {
      ok: false,
      status: 500,
      error: `Failed to save regenerated recovery codes: ${updateErr.message}`,
    };
  }

  logAuditEvent({
    actorId: userId,
    actorEmail: email,
    actorRole: role,
    action: 'MFA_RECOVERY_CODES_REGENERATED',
    targetType: 'USER',
    targetId: userId,
    ipAddress: ip,
    userAgent,
    severity: 'WARNING',
  });

  return {
    ok: true,
    recoveryCodes: plaintext,
  };
}
