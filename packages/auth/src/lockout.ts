import { dispatchNotificationEvent, NOTIFICATION_EVENTS, supabaseAdmin } from '@newsim/database';
import { logAuditEvent } from './audit';

export const PERMANENT_SUSPENSION_TITLE = "Account Suspended";
export const PERMANENT_SUSPENSION_MESSAGE = "Your account has been suspended due to multiple incorrect login attempts. Please contact the administrator to reactivate your account, then try logging in again with the correct credentials.";

export interface LockoutStatus {
  isLocked: boolean;
  isPermanent: boolean;
  offenseLevel: number;
  remainingSeconds: number;
  remainingMinutes: number;
  lockoutUntil?: string | null;
  message?: string;
  error?: string;
}

export interface FailedLoginResult {
  isNowLocked: boolean;
  isLocked?: boolean;
  isPermanent: boolean;
  offenseLevel: number;
  failedAttempts: number;
  cumulativeFailedAttempts: number;
  attemptsRemaining: number;
  lockoutUntil?: string | null;
  remainingMinutes?: number;
  remainingSeconds?: number;
  error?: string;
  message?: string;
}

/**
 * Resolves a user profile from Supabase by email, username, or ID.
 */
export async function getProfileByIdentifier(identifier: string) {
  if (!identifier) return null;
  const cleanId = identifier.trim().toLowerCase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

  try {
    if (isUuid) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (!error && data) return data;
      return null;
    }

    // If identifier has '@', search primarily by email
    if (cleanId.includes('@')) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .ilike('email', cleanId)
        .maybeSingle();

      if (!error && data) return data;
      return null;
    }

    // Otherwise, search across email and username using parameterized equality checks (no .or() filter interpolation)
    const { data: byEmail, error: emailErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .ilike('email', cleanId)
      .maybeSingle();

    if (!emailErr && byEmail) return byEmail;

    const { data: byUsername, error: userErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .ilike('username', cleanId)
      .maybeSingle();

    if (!userErr && byUsername) return byUsername;
  } catch (err) {
    console.error('getProfileByIdentifier lookup error:', err);
  }

  return null;
}

/**
 * Helper to determine if a given previous timestamp belongs to a previous calendar day
 * or is at least 24 hours in the past.
 * Uses 'Asia/Manila' (GMT+8) as the system timezone.
 */
export function isNewDay(previousTimestamp?: string | null): boolean {
  if (!previousTimestamp) return false;
  try {
    const prevDate = new Date(previousTimestamp);
    const nowDate = new Date();
    
    // 1. If 24 hours or more have elapsed
    if (nowDate.getTime() - prevDate.getTime() >= 24 * 60 * 60 * 1000) {
      return true;
    }

    // 2. Or if calendar date in local timezone (Asia/Manila, UTC+8) is different
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });
    const prevDay = formatter.format(prevDate);
    const nowDay = formatter.format(nowDate);

    return prevDay !== nowDay;
  } catch {
    return false;
  }
}

/**
 * Checks if the given profile is currently under temporary suspension / lockout or permanent suspension.
 * - If permanently suspended (offense level 3 or MULTIPLE_INCORRECT_LOGIN), returns exact required message.
 * - If temporary suspension (5 min or 30 min) is active, returns remaining time.
 * - If temporary suspension has expired, clears lockout_until.
 * - If a new calendar day has arrived (tomorrow), refreshes the daily limit of invalid attempts.
 */
export async function checkAccountLockout(profileOrIdentifier: any): Promise<LockoutStatus> {
  let profile = profileOrIdentifier;
  if (typeof profileOrIdentifier === 'string') {
    profile = await getProfileByIdentifier(profileOrIdentifier);
  }
  if (!profile) {
    return { isLocked: false, isPermanent: false, offenseLevel: 0, remainingSeconds: 0, remainingMinutes: 0 };
  }

  const status = (profile.status || '').toString().toUpperCase();
  const offenseLevel = Number(profile.offense_level) || 0;
  const reason = profile.suspension_reason;

  // 1. Permanent lockout check (Offense Tier 3: 20 cumulative failed attempts, or explicit LOCKED/SUSPENDED status)
  if (
    status === 'SUSPENDED' ||
    status === 'LOCKED' ||
    offenseLevel >= 3 ||
    Number(profile.cumulative_failed_attempts || 0) >= 20
  ) {
    if (
      offenseLevel >= 3 ||
      status === 'LOCKED' ||
      reason === 'MULTIPLE_INCORRECT_LOGIN' ||
      (profile.cumulative_failed_attempts && profile.cumulative_failed_attempts >= 20)
    ) {
      return {
        isLocked: true,
        isPermanent: true,
        offenseLevel: Math.max(offenseLevel, 3),
        remainingSeconds: 0,
        remainingMinutes: 0,
        message: PERMANENT_SUSPENSION_MESSAGE,
        error: PERMANENT_SUSPENSION_MESSAGE,
      };
    }

    const msg = 'Your account has been suspended. Please contact system administration.';
    return {
      isLocked: true,
      isPermanent: true,
      offenseLevel,
      remainingSeconds: 0,
      remainingMinutes: 0,
      message: msg,
      error: msg,
    };
  }

  // 2. Temporary suspension check (Tier 1: 5 min, Tier 2: 30 min)
  if (profile.lockout_until) {
    const lockoutTime = new Date(profile.lockout_until).getTime();
    const now = Date.now();

    if (now < lockoutTime) {
      const remainingMs = lockoutTime - now;
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

      const durationMinutes = (offenseLevel >= 2 || remainingMinutes > 5) ? 30 : 5;
      const msg = `Your account is temporarily suspended for ${durationMinutes} minutes due to repeated incorrect login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'} (${remainingSeconds}s).`;
      return {
        isLocked: true,
        isPermanent: false,
        offenseLevel: offenseLevel || 1,
        remainingSeconds,
        remainingMinutes,
        lockoutUntil: profile.lockout_until,
        message: msg,
        error: msg,
      };
    }

    // Temporary suspension has expired: clear active lockout window while preserving cumulative offense escalation
    try {
      await supabaseAdmin
        .from('profiles')
        .update({
          lockout_until: null,
          failed_login_attempts: 0,
        })
        .eq('id', profile.id);

      profile.lockout_until = null;
      profile.failed_login_attempts = 0;
    } catch (err) {
      console.warn('Failed to clear expired lockout timestamp on profile:', err);
    }
  } else if (
    status !== 'SUSPENDED' &&
    offenseLevel === 0 &&
    (Number(profile.failed_login_attempts) > 0 || Number(profile.cumulative_failed_attempts) > 0)
  ) {
    // Only clear stale pre-lockout failed attempts after a full 24-hour quiet window
    const lastAction = profile.updated_at || profile.suspended_at;
    const elapsedMs = lastAction ? Date.now() - new Date(lastAction).getTime() : 0;
    if (elapsedMs >= 24 * 60 * 60 * 1000) {
      try {
        await supabaseAdmin
          .from('profiles')
          .update({
            failed_login_attempts: 0,
            cumulative_failed_attempts: 0,
            lockout_until: null,
          })
          .eq('id', profile.id);

        profile.failed_login_attempts = 0;
        profile.cumulative_failed_attempts = 0;
      } catch (err) {
        console.warn('Failed to reset stale pre-lockout attempts on profile:', err);
      }
    }
  }

  return { isLocked: false, isPermanent: false, offenseLevel: Number(profile.offense_level) || 0, remainingSeconds: 0, remainingMinutes: 0 };
}

/**
 * Records a failed login attempt with progressive 3-tier offense rules and daily reset:
 * - 1st Offense (5 attempts in current day): 5-minute temporary suspension
 * - 2nd Offense (10 attempts in current day): 30-minute temporary suspension
 * - 3rd Offense (20 cumulative attempts): Permanent suspension with exact prompt message
 * - Everyday / Tomorrow: Resets the daily limit of invalid login attempts,
 *   while recording all multiple failed attempts in audit logs and database profile.
 */
export async function recordFailedLogin(profileIdOrIdentifier: string, currentProfileOrAttempts?: any): Promise<FailedLoginResult> {
  let profile: any = null;
  const cleanId = (profileIdOrIdentifier || '').trim();

  if (cleanId) {
    profile = await getProfileByIdentifier(cleanId);
  }

  if (!profile && typeof currentProfileOrAttempts === 'object' && currentProfileOrAttempts?.id) {
    const { data } = await supabaseAdmin.from('profiles').select('*').eq('id', currentProfileOrAttempts.id).maybeSingle();
    profile = data || currentProfileOrAttempts;
  }

  profile = profile || {};
  const profileId = profile.id || profileIdOrIdentifier;

  // Extract IP and UserAgent if provided in options
  const ip = currentProfileOrAttempts?.ip || '127.0.0.1';
  const userAgent = currentProfileOrAttempts?.userAgent || 'Browser';

  if (!profile?.id) {
    logAuditEvent({
      actorId: undefined,
      actorEmail: cleanId || 'unknown',
      actorRole: 'USER',
      action: 'LOGIN_FAILED',
      targetType: 'USER',
      details: { reason: 'Invalid credentials (unmatched identifier)' },
      ipAddress: ip,
      userAgent,
      status: 'FAILED',
      severity: 'WARNING',
    });

    return {
      isNowLocked: false,
      isLocked: false,
      isPermanent: false,
      offenseLevel: 0,
      failedAttempts: 0,
      cumulativeFailedAttempts: 0,
      attemptsRemaining: 5,
      error: 'Invalid email or password.',
    };
  }

  // Execute atomic PostgreSQL row-locked lockout transition (FOR UPDATE)
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('record_failed_login_attempt', {
    p_profile_id: profile.id,
  });

  if (rpcError || !rpcData || rpcData.found === false) {
    console.error('Error executing atomic record_failed_login_attempt RPC:', rpcError);
    throw new Error('Authentication lockout guard failed safely.');
  }

  const newStreak = Number(rpcData.failed_attempts) || 0;
  const newCumulative = Number(rpcData.cumulative_attempts) || 0;
  const newOffenseLevel = Number(rpcData.offense_level) || 0;
  const isLocked = Boolean(rpcData.is_locked);
  const isPermanent = Boolean(rpcData.is_permanent);
  const remainingSeconds = Number(rpcData.remaining_seconds) || 0;
  const remainingMinutes = remainingSeconds > 0 ? Math.ceil(remainingSeconds / 60) : 0;
  const lockoutUntil = rpcData.lockout_until || null;

  // Always log every failed login attempt in audit logs so attempts remain permanently recorded
  logAuditEvent({
    actorId: profileId,
    actorEmail: profile.email || cleanId,
    actorRole: profile.role?.toUpperCase() || 'USER',
    action: 'LOGIN_FAILED',
    targetType: 'USER',
    targetId: profileId,
    details: {
      reason: 'Invalid credentials',
      dailyAttempt: newStreak,
      dailyCumulative: newCumulative,
      offenseLevel: newOffenseLevel,
    },
    ipAddress: ip,
    userAgent,
    status: 'FAILED',
    severity: 'WARNING',
  });

  // Tier 3: 20 cumulative attempts -> Permanent Suspension
  if (isPermanent) {
    // Synchronize canonical MULTIPLE_INCORRECT_LOGIN code & ban in Supabase Auth
    await supabaseAdmin
      .from('profiles')
      .update({ suspension_reason: 'MULTIPLE_INCORRECT_LOGIN' })
      .eq('id', profileId);

    await supabaseAdmin.auth.admin.updateUserById(profileId, { ban_duration: '876600h' }).catch(() => {});

    logAuditEvent({
      actorId: profileId,
      actorEmail: profile.email || cleanId,
      actorRole: profile.role?.toUpperCase() || 'USER',
      action: 'ACCOUNT_PERMANENTLY_SUSPENDED',
      targetType: 'USER',
      targetId: profileId,
      details: { reason: PERMANENT_SUSPENSION_MESSAGE, totalAttempts: newCumulative },
      ipAddress: ip,
      userAgent,
      status: 'FAILED',
      severity: 'CRITICAL',
    });

    dispatchNotificationEvent({
      event: NOTIFICATION_EVENTS.SECURITY_ALERT,
      entityType: 'USER',
      entityId: profileId,
      metadata: {
        targetEmail: profile.email || cleanId,
        securityMessage: `Account ${profile.email || cleanId} permanently locked after ${newCumulative} cumulative failed login attempts.`,
      },
    }).catch(() => {});

    return {
      isNowLocked: true,
      isLocked: true,
      isPermanent: true,
      offenseLevel: Math.max(newOffenseLevel, 3),
      failedAttempts: newStreak,
      cumulativeFailedAttempts: newCumulative,
      attemptsRemaining: 0,
      lockoutUntil: null,
      remainingMinutes: 0,
      remainingSeconds: 0,
      error: PERMANENT_SUSPENSION_MESSAGE,
      message: PERMANENT_SUSPENSION_MESSAGE,
    };
  }

  // Tier 1 (5 min) or Tier 2 (30 min) Temporary Suspension
  if (isLocked) {
    const durationMinutes = newOffenseLevel >= 2 || remainingMinutes > 5 ? 30 : 5;
    const msg =
      durationMinutes >= 30
        ? `Your account has been temporarily suspended for 30 minutes due to 10 cumulative incorrect login attempts.`
        : `Your account has been temporarily suspended for 5 minutes due to 5 consecutive failed login attempts.`;

    logAuditEvent({
      actorId: profileId,
      actorEmail: profile.email || cleanId,
      actorRole: profile.role?.toUpperCase() || 'USER',
      action: 'ACCOUNT_TEMPORARILY_SUSPENDED',
      targetType: 'USER',
      targetId: profileId,
      details: { offenseLevel: newOffenseLevel, durationMinutes, lockoutUntil, totalAttempts: newCumulative },
      ipAddress: ip,
      userAgent,
      status: 'FAILED',
      severity: 'CRITICAL',
    });

    return {
      isNowLocked: true,
      isLocked: true,
      isPermanent: false,
      offenseLevel: newOffenseLevel || 1,
      failedAttempts: newStreak,
      cumulativeFailedAttempts: newCumulative,
      attemptsRemaining: 0,
      lockoutUntil,
      remainingMinutes,
      remainingSeconds,
      error: msg,
      message: msg,
    };
  }

  // Under threshold: calculate remaining attempts until next tier
  let nextThreshold = 5;
  if (newCumulative >= 10) {
    nextThreshold = 20;
  } else if (newCumulative >= 5) {
    nextThreshold = 10;
  }
  const attemptsRemaining = Math.max(0, nextThreshold - newCumulative);

  return {
    isNowLocked: false,
    isLocked: false,
    isPermanent: false,
    offenseLevel: newOffenseLevel,
    failedAttempts: newStreak,
    cumulativeFailedAttempts: newCumulative,
    attemptsRemaining,
    error: `Invalid email or password. You have ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining before account suspension.`,
  };
}

/**
 * Resets the temporary lockout lock for a profile upon successful login,
 * while maintaining safety invariants.
 */
export async function resetFailedLoginAttempts(profileId: string) {
  try {
    await supabaseAdmin
      .from('profiles')
      .update({
        failed_login_attempts: 0,
        lockout_until: null,
      })
      .eq('id', profileId);
  } catch (err) {
    console.error('Error clearing lockout on profile:', err);
  }
}

/**
 * Administrative Reactivation:
 * Allows authorized Super Admin or Admin to reactivate an account,
 * resetting failed attempt counters, cumulative attempts, and progressive offense tier.
 */
export async function reactivateAccount(
  profileId: string,
  actorAdmin?: { id: string; email: string; role: string; ip?: string; userAgent?: string }
) {
  try {
    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update({
        status: 'ACTIVE',
        failed_login_attempts: 0,
        cumulative_failed_attempts: 0,
        offense_level: 0,
        lockout_until: null,
        suspension_reason: null,
        suspended_at: null,
      })
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      console.error('Error reactivating account in Supabase profiles:', error);
      return { success: false, error: error.message };
    }

    // Reset ban status in Supabase Auth
    try {
      await supabaseAdmin.auth.admin.updateUserById(profileId, { ban_duration: 'none' });
    } catch (authErr) {
      console.warn('Could not reset Supabase auth ban status:', authErr);
    }

    if (actorAdmin) {
      logAuditEvent({
        actorId: actorAdmin.id,
        actorEmail: actorAdmin.email,
        actorRole: actorAdmin.role,
        action: 'ACCOUNT_REACTIVATED',
        targetType: 'USER',
        targetId: profileId,
        details: { reason: 'Administrative account reactivation by authorized administrator' },
        ipAddress: actorAdmin.ip,
        userAgent: actorAdmin.userAgent,
        severity: 'INFO',
      });
    }

    return { success: true, profile: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

const activityThrottleMap = new Map<string, number>();

/**
 * Updates last_activity_at on a user's profile with throttling (at most once every 5 minutes)
 * to avoid excessive database writes while ensuring persistent inactivity expiration.
 */
export async function touchUserActivity(userId: string, currentLastActivity?: string | null) {
  if (!userId) return;
  const now = Date.now();
  const lastUpdated = activityThrottleMap.get(userId) || 0;
  if (now - lastUpdated < 5 * 60 * 1000) {
    return; // Throttled in-memory: updated less than 5 minutes ago
  }

  if (currentLastActivity) {
    const lastTime = new Date(currentLastActivity).getTime();
    if (now - lastTime < 5 * 60 * 1000) {
      activityThrottleMap.set(userId, lastTime);
      return; // Throttled: last activity was less than 5 minutes ago
    }
  }

  activityThrottleMap.set(userId, now);

  try {
    await supabaseAdmin
      .from('profiles')
      .update({ last_activity_at: new Date(now).toISOString() })
      .eq('id', userId);
  } catch (err) {
    console.warn('Error touching user activity timestamp:', err);
  }
}

/**
 * Saves MFA credentials for a user profile in Supabase.
 */
export async function saveMfaSecret(profileId: string, secret: string, recoveryCodes: string[] | string) {
  try {
    const codesJson = typeof recoveryCodes === 'string' ? recoveryCodes : JSON.stringify(recoveryCodes);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        mfa_enabled: true,
        mfa_secret: secret,
        recovery_codes: codesJson,
      })
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      console.error('Error saving MFA secret:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception saving MFA secret:', err);
    return false;
  }
}
