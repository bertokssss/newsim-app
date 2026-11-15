import { supabaseAdmin } from '@newsim/database';

export const MIN_PASSWORD_LENGTH = 12;
export const PASSWORD_RESET_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

/**
 * Validates that a proposed password meets all strong password requirements:
 * - At least 12 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&* etc.)
 */
export function validateStrongPassword(password?: string | null): PasswordValidationResult {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      error: 'Password is required.',
      details: { length: false, uppercase: false, lowercase: false, number: false, special: false },
    };
  }

  const length = password.length >= MIN_PASSWORD_LENGTH;
  const uppercase = /[A-Z]/.test(password);
  const lowercase = /[a-z]/.test(password);
  const number = /[0-9]/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);

  const valid = length && uppercase && lowercase && number && special;

  let error: string | undefined;
  if (!length) {
    error = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  } else if (!uppercase) {
    error = 'Password must include at least one uppercase letter (A-Z).';
  } else if (!lowercase) {
    error = 'Password must include at least one lowercase letter (a-z).';
  } else if (!number) {
    error = 'Password must include at least one number (0-9).';
  } else if (!special) {
    error = 'Password must include at least one special character (e.g. !@#$%^&*).';
  }

  return {
    valid,
    error,
    details: { length, uppercase, lowercase, number, special },
  };
}

export interface ResetLimitCheck {
  allowed: boolean;
  remainingMs?: number;
  remainingHours?: number;
  remainingMinutes?: number;
  nextAllowedAt?: string;
  error?: string;
}

/**
 * Checks whether an account has already reset or requested a password reset within the last 24 hours.
 * Enforces the strict rule: only ONE reset every 24 hours.
 */
export async function checkPasswordResetRateLimit(profileOrEmail: any): Promise<ResetLimitCheck> {
  let profile = profileOrEmail;

  if (typeof profileOrEmail === 'string') {
    const cleanEmail = profileOrEmail.trim().toLowerCase();
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, email, last_password_reset_at, last_password_reset_request_at')
      .ilike('email', cleanEmail)
      .maybeSingle();

    profile = data;
  }

  if (!profile) {
    return { allowed: true };
  }

  const lastReset = profile.last_password_reset_at
    ? new Date(profile.last_password_reset_at).getTime()
    : null;

  if (lastReset) {
    const elapsed = Date.now() - lastReset;
    if (elapsed < PASSWORD_RESET_COOLDOWN_MS) {
      const remainingMs = PASSWORD_RESET_COOLDOWN_MS - elapsed;
      const remainingHours = Math.floor(remainingMs / (3600 * 1000));
      const remainingMinutes = Math.ceil((remainingMs % (3600 * 1000)) / (60 * 1000));
      const nextAllowedAt = new Date(lastReset + PASSWORD_RESET_COOLDOWN_MS).toISOString();

      const timeMsg = remainingHours > 0
        ? `${remainingHours} hour${remainingHours === 1 ? '' : 's'} and ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`
        : `${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;

      return {
        allowed: false,
        remainingMs,
        remainingHours,
        remainingMinutes,
        nextAllowedAt,
        error: `Password reset limit reached. You can only reset your password once every 24 hours. Please try again in ${timeMsg}.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Records that a password reset request was initiated for an account.
 */
export async function recordPasswordResetRequested(userIdOrEmail: string) {
  const clean = (userIdOrEmail || '').trim();
  const now = new Date().toISOString();
  try {
    if (clean.includes('@')) {
      await supabaseAdmin
        .from('profiles')
        .update({ last_password_reset_request_at: now })
        .ilike('email', clean.toLowerCase());
    } else {
      await supabaseAdmin
        .from('profiles')
        .update({ last_password_reset_request_at: now })
        .eq('id', clean);
    }
  } catch (err) {
    console.warn('Failed to record password reset request timestamp:', err);
  }
}

/**
 * Records that a password reset was successfully completed.
 * Starts the 24-hour cooldown during which no further resets can be performed.
 */
export async function recordPasswordResetCompleted(userIdOrEmail: string) {
  const clean = (userIdOrEmail || '').trim();
  const now = new Date().toISOString();
  try {
    if (clean.includes('@')) {
      await supabaseAdmin
        .from('profiles')
        .update({ last_password_reset_at: now, updated_at: now })
        .ilike('email', clean.toLowerCase());
    } else {
      await supabaseAdmin
        .from('profiles')
        .update({ last_password_reset_at: now, updated_at: now })
        .eq('id', clean);
    }
  } catch (err) {
    console.warn('Failed to record password reset completion timestamp:', err);
  }
}
