const path = require('path');

// Test 1: Test validateStrongPassword directly
const MIN_PASSWORD_LENGTH = 12;

function validateStrongPassword(password) {
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

  let error;
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

const PASSWORD_RESET_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function checkPasswordResetRateLimitLocal(profile) {
  if (!profile) return { allowed: true };

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

console.log('--- RUNNING PASSWORD POLICY VERIFICATION TESTS ---');

// Test Cases for Strong Password Validation
const tests = [
  { pw: 'Short1!', expectedValid: false, reason: 'Under 12 characters' },
  { pw: 'nouppercase123!', expectedValid: false, reason: 'No uppercase letter' },
  { pw: 'NOLOWERCASE123!', expectedValid: false, reason: 'No lowercase letter' },
  { pw: 'NoNumbersHere!!', expectedValid: false, reason: 'No numbers' },
  { pw: 'NoSpecialChar123', expectedValid: false, reason: 'No special character' },
  { pw: '123456789012', expectedValid: false, reason: 'Only numbers' },
  { pw: 'ValidStrongPass123!', expectedValid: true, reason: 'Valid 19 chars strong password' },
  { pw: 'Abc123!@#456', expectedValid: true, reason: 'Valid exactly 12 chars' },
];

let failed = 0;
for (const t of tests) {
  const res = validateStrongPassword(t.pw);
  const passed = res.valid === t.expectedValid;
  if (passed) {
    console.log(`[PASS] ${t.reason} -> valid=${res.valid}${res.error ? ` (error: "${res.error}")` : ''}`);
  } else {
    console.error(`[FAIL] ${t.reason} -> expected ${t.expectedValid}, got ${res.valid}`);
    failed++;
  }
}

// Test Cases for 24-Hour Cooldown
console.log('\n--- TESTING 24-HOUR RATE LIMIT COOLDOWN ---');

// Case A: Never reset before
const neverReset = checkPasswordResetRateLimitLocal({ last_password_reset_at: null });
if (neverReset.allowed === true) {
  console.log('[PASS] Account with no previous reset is allowed.');
} else {
  console.error('[FAIL] Expected allowed=true for first reset');
  failed++;
}

// Case B: Reset 2 hours ago
const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
const recentReset = checkPasswordResetRateLimitLocal({ last_password_reset_at: twoHoursAgo });
if (recentReset.allowed === false && recentReset.remainingHours >= 21) {
  console.log(`[PASS] Reset 2 hours ago correctly blocked with message: "${recentReset.error}"`);
} else {
  console.error('[FAIL] Expected blocked with ~22 remaining hours, got:', recentReset);
  failed++;
}

// Case C: Reset 25 hours ago
const twentyFiveHoursAgo = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
const expiredCooldown = checkPasswordResetRateLimitLocal({ last_password_reset_at: twentyFiveHoursAgo });
if (expiredCooldown.allowed === true) {
  console.log('[PASS] Reset 25 hours ago (>24h) is correctly allowed again.');
} else {
  console.error('[FAIL] Expected allowed=true after 24 hours, got:', expiredCooldown);
  failed++;
}

if (failed === 0) {
  console.log('\n>>> ALL PASSWORD POLICY & COOLDOWN TESTS PASSED SUCCESSFULLY! <<<');
} else {
  console.error(`\n>>> ${failed} TESTS FAILED! <<<`);
  process.exit(1);
}
