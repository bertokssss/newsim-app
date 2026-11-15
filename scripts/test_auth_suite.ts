import fs from 'fs';
import path from 'path';

// 1. Load env before loading database/auth
const rootDir = path.resolve(__dirname, '..');
function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
    if (m && m[1]) {
      const val = (m[2] || '').trim().replace(/^["']|["']$/g, '');
      if (!process.env[m[1]]) {
        process.env[m[1]] = val;
      }
    }
  }
}

loadEnv(path.join(rootDir, 'apps/management/.env.local'));
loadEnv(path.join(rootDir, '.env.local'));
loadEnv(path.join(rootDir, '.env'));

async function runTests() {
  console.log('--- STARTING NEWSIM AUTH VERIFICATION SUITE ---');
  
  const { 
    createSessionToken, 
    verifySessionToken, 
    getInactivityTimeoutMs,
    INACTIVITY_EXPIRED_MESSAGE,
    setSessionCookies,
  } = await import('../packages/auth/src/session');
  
  const {
    checkAccountLockout,
    recordFailedLogin,
    reactivateAccount,
    PERMANENT_SUSPENSION_MESSAGE,
  } = await import('../packages/auth/src/lockout');

  const { getJwtSecret } = await import('../packages/auth/src/jwt-secret');
  
  const { supabaseAdmin } = await import('../packages/database/src/supabase');
  const { NextResponse } = await import('next/server');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST 1: Role-based Inactivity Timeout Values
  console.log('\n[TEST GROUP 1: Inactivity Durations]');
  assert(getInactivityTimeoutMs('SUPER_ADMIN') === 7 * 86400 * 1000, 'Super Admin inactivity is 7 days');
  assert(getInactivityTimeoutMs('ADMIN') === 7 * 86400 * 1000, 'Admin inactivity is 7 days');
  assert(getInactivityTimeoutMs('INSTRUCTOR') === 7 * 86400 * 1000, 'Instructor inactivity is 7 days');
  assert(getInactivityTimeoutMs('TRAINEE') === 30 * 86400 * 1000, 'Trainee inactivity is 30 days');

  // TEST 2: Remember Me Cookie Lifetime
  console.log('\n[TEST GROUP 2: Remember Me Cookie Behavior]');
  const mockAdminUser = {
    id: 'test-admin-uid-1',
    email: 'admin-test@newsim.com',
    role: 'ADMIN' as const,
    firstName: 'Admin',
    lastName: 'Test',
  } as any;

  // When rememberMe is false: no maxAge (session cookie)
  const resNoRemember = NextResponse.json({ ok: true });
  setSessionCookies(resNoRemember, 'dummy-token', 'ADMIN', false);
  const adminCookieNoRemember = resNoRemember.cookies.get('session_token');
  assert(adminCookieNoRemember?.maxAge === undefined, 'Remember Me false -> session cookie (maxAge is undefined)');

  // When rememberMe is true for Admin: 7 days maxAge
  const resRememberAdmin = NextResponse.json({ ok: true });
  setSessionCookies(resRememberAdmin, 'dummy-token', 'ADMIN', true);
  const adminCookieRemember = resRememberAdmin.cookies.get('session_token');
  assert(adminCookieRemember?.maxAge === 7 * 86400, 'Remember Me true for Admin -> 7 days cookie maxAge');

  // When rememberMe is true for Trainee: 30 days maxAge
  const resRememberTrainee = NextResponse.json({ ok: true });
  setSessionCookies(resRememberTrainee, 'dummy-token', 'TRAINEE', true);
  const traineeCookieRemember = resRememberTrainee.cookies.get('session_token');
  assert(traineeCookieRemember?.maxAge === 30 * 86400, 'Remember Me true for Trainee -> 30 days cookie maxAge');

  // TEST 3: Inactivity Expiration
  console.log('\n[TEST GROUP 3: Server-side Inactivity Expiration]');
  assert(
    INACTIVITY_EXPIRED_MESSAGE === 'Your session has expired due to inactivity. Please log in again.',
    'Inactivity expiration message matches requirement exactly'
  );

  // Active Remember Me session (< 7 days)
  const { token: activeToken } = createSessionToken(mockAdminUser, '127.0.0.1', 'Mozilla/5.0', true);
  const activeVerification = verifySessionToken(activeToken);
  assert(activeVerification !== null && activeVerification.userId === mockAdminUser.id, 'Recent session is valid');

  // Inactive Remember Me session (simulated 8 days ago)
  const jwtModule = await import('jsonwebtoken');
  const jwt = ((jwtModule as any).default || jwtModule) as any;
  const JWT_SECRET = getJwtSecret();
  const eightDaysAgoMs = Date.now() - (8 * 86400 * 1000);
  const expiredPayload = {
    userId: mockAdminUser.id,
    email: mockAdminUser.email,
    role: 'ADMIN',
    userName: 'Admin Test',
    sessionId: 'sess-expired-inactivity',
    rememberMe: true,
    lastActiveAt: eightDaysAgoMs,
    inactivityTimeoutSeconds: 7 * 86400,
  };
  const inactiveToken = jwt.sign(expiredPayload, JWT_SECRET, { expiresIn: '7d' });
  const expiredVerification = verifySessionToken(inactiveToken);
  assert(expiredVerification === null, 'Session inactive for >7 days is rejected by verifySessionToken');

  // TEST 4: Progressive Brute-Force Lockout (5, 10, 20 attempts)
  console.log('\n[TEST GROUP 4: Database-backed Progressive Brute-Force Lockout]');
  const testEmail = `brute_force_test_${Date.now()}@newsim.test`;
  
  // Create test user in Supabase auth
  const { data: authUserData, error: authUserErr } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: 'Password123!Test',
    email_confirm: true,
  });

  if (authUserErr || !authUserData?.user) {
    console.error('Failed to create auth user:', authUserErr);
    return;
  }
  const testUserId = authUserData.user.id;

  // Ensure profiles record exists with initial values
  const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
    id: testUserId,
    email: testEmail,
    role: 'TRAINEE',
    status: 'ACTIVE',
    first_name: 'Lockout',
    last_name: 'Tester',
    failed_login_attempts: 0,
    cumulative_failed_attempts: 0,
    offense_level: 0,
  });

  if (upsertError) {
    console.error('Failed to create test user in profiles table:', upsertError);
    await supabaseAdmin.auth.admin.deleteUser(testUserId);
    return;
  }

  try {
    // 4.1 Check initial state
    const initialCheck = await checkAccountLockout(testEmail);
    assert(initialCheck.isLocked === false, 'Account initially has isLocked: false');

    // 4.2 Record 5 failed attempts (Tier 1: 5 minutes)
    let lastResult: any;
    for (let i = 1; i <= 5; i++) {
      lastResult = await recordFailedLogin(testEmail, { ip: '127.0.0.1', userAgent: 'test-agent' });
    }
    assert(lastResult.isLocked === true, '5th failed attempt triggers account suspension');
    assert(lastResult.offenseLevel === 1, '5th failed attempt sets offense_level = 1');
    assert(lastResult.remainingSeconds > 280 && lastResult.remainingSeconds <= 300, '5th failed attempt sets 5-minute lockout (~300s)');

    const lockedCheck1 = await checkAccountLockout(testEmail);
    assert(lockedCheck1.isLocked === true && !lockedCheck1.isPermanent, 'checkAccountLockout confirms Tier 1 temporary suspension');

    // 4.3 Simulate Tier 1 lockout expiration (set lockout_until into the past)
    await supabaseAdmin.from('profiles').update({
      lockout_until: new Date(Date.now() - 1000).toISOString(),
    }).eq('id', testUserId);

    const expiredCheck1 = await checkAccountLockout(testEmail);
    assert(expiredCheck1.isLocked === false, 'Account can attempt login after Tier 1 lockout expires');

    // Verify cumulative failed attempts & offense level are preserved!
    const { data: prof1 } = await supabaseAdmin.from('profiles').select('cumulative_failed_attempts, offense_level').eq('id', testUserId).single();
    assert(prof1?.cumulative_failed_attempts === 5, 'Cumulative failed attempts (5) preserved across lockout expiration');
    assert(prof1?.offense_level === 1, 'Offense level (1) preserved across lockout expiration');

    // 4.4 Record 5 more failed attempts (Tier 2: total 10 attempts -> 30 minutes)
    for (let i = 6; i <= 10; i++) {
      lastResult = await recordFailedLogin(testEmail, { ip: '127.0.0.1', userAgent: 'test-agent' });
    }
    assert(lastResult.isLocked === true, '10th failed attempt triggers account suspension');
    assert(lastResult.offenseLevel === 2, '10th failed attempt sets offense_level = 2');
    assert(lastResult.remainingSeconds > 1700 && lastResult.remainingSeconds <= 1800, '10th failed attempt sets 30-minute lockout (~1800s)');

    // 4.5 Simulate Tier 2 lockout expiration
    await supabaseAdmin.from('profiles').update({
      lockout_until: new Date(Date.now() - 1000).toISOString(),
    }).eq('id', testUserId);

    const expiredCheck2 = await checkAccountLockout(testEmail);
    assert(expiredCheck2.isLocked === false, 'Account can attempt login after Tier 2 lockout expires');

    // 4.6 Record 10 more failed attempts (Tier 3: total 20 attempts -> Permanent suspension)
    for (let i = 11; i <= 20; i++) {
      lastResult = await recordFailedLogin(testEmail, { ip: '127.0.0.1', userAgent: 'test-agent' });
    }
    assert(lastResult.isPermanent === true, '20th failed attempt triggers permanent suspension');
    assert(lastResult.offenseLevel === 3, '20th failed attempt sets offense_level = 3');

    assert(
      PERMANENT_SUSPENSION_MESSAGE.toLowerCase().includes('suspended') &&
        PERMANENT_SUSPENSION_MESSAGE.toLowerCase().includes('reactivate'),
      'PERMANENT_SUSPENSION_MESSAGE communicates suspension and reactivation clearly'
    );

    const lockedCheck3 = await checkAccountLockout(testEmail);
    assert(lockedCheck3.isLocked === true, 'checkAccountLockout returns isLocked: true for permanent suspension');
    assert(lockedCheck3.isPermanent === true, 'checkAccountLockout returns isPermanent: true');
    assert(lockedCheck3.error === PERMANENT_SUSPENSION_MESSAGE, 'checkAccountLockout returns PERMANENT_SUSPENSION_MESSAGE');

    // 4.7 Test Administrative Reactivation
    console.log('\n[TEST GROUP 5: Administrative Reactivation]');
    const reactivateRes = await reactivateAccount(testUserId, {
      id: 'admin-super-1',
      email: 'admin@newsim.com',
      role: 'SUPER_ADMIN',
      ip: '127.0.0.1',
      userAgent: 'admin-portal',
    });
    assert(reactivateRes.success === true, 'Admin successfully reactivated suspended account');

    const { data: reactivatedProfile } = await supabaseAdmin
      .from('profiles')
      .select('status, failed_login_attempts, cumulative_failed_attempts, offense_level, suspended_at, suspension_reason')
      .eq('id', testUserId)
      .single();

    assert(reactivatedProfile?.status === 'ACTIVE', 'Reactivated profile status is ACTIVE');
    assert(reactivatedProfile?.failed_login_attempts === 0, 'Reactivated profile failed_login_attempts reset to 0');
    assert(reactivatedProfile?.cumulative_failed_attempts === 0, 'Reactivated profile cumulative_failed_attempts reset to 0');
    assert(reactivatedProfile?.offense_level === 0, 'Reactivated profile offense_level reset to 0');
    assert(reactivatedProfile?.suspended_at === null, 'Reactivated profile suspended_at cleared');
    assert(reactivatedProfile?.suspension_reason === null, 'Reactivated profile suspension_reason cleared');

    const postReactivateCheck = await checkAccountLockout(testEmail);
    assert(postReactivateCheck.isLocked === false, 'Account is unlocked after administrative reactivation and can log in');

    // 4.8 Atomic concurrency check (5 simultaneous failed logins must hit Tier 1 cleanly with zero lost increments)
    console.log('\n[TEST GROUP 6: Concurrent Brute-Force Lockout Race Safety]');
    const burstResults = await Promise.all(
      Array.from({ length: 5 }, () => recordFailedLogin(testEmail, { ip: '127.0.0.1', userAgent: 'burst-test' }))
    );
    const { data: burstProfile } = await supabaseAdmin
      .from('profiles')
      .select('cumulative_failed_attempts, offense_level, lockout_until')
      .eq('id', testUserId)
      .single();
    assert(burstProfile?.cumulative_failed_attempts === 5, 'Concurrent 5x burst increments cumulative_failed_attempts atomically to 5');
    assert(burstProfile?.offense_level === 1 && Boolean(burstProfile?.lockout_until), 'Concurrent 5x burst triggers Tier 1 lockout atomically');
    assert(burstResults.some((r) => r.isLocked && r.offenseLevel === 1), 'At least one concurrent call reports Tier 1 lockout');

  } finally {
    // Cleanup test user
    await supabaseAdmin.from('profiles').delete().eq('id', testUserId);
    try {
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
    } catch {}
    console.log('\nCleaned up test profile and auth user from database.');
  }

  console.log(`\n========================================`);
  console.log(`SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
