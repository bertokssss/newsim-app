import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn, execFileSync, type ChildProcess } from 'child_process';

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

// Load trainee env first if it has JWT_SECRET, then management and root .env.local
loadEnv(path.join(rootDir, 'apps/trainee/.env.local'));
loadEnv(path.join(rootDir, 'apps/management/.env.local'));
loadEnv(path.join(rootDir, '.env.local'));
loadEnv(path.join(rootDir, '.env'));

// Ensure test harness child servers & session signer share deterministic test secrets if missing locally
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 16) {
  process.env.JWT_SECRET = 'newsim-http-verify-ephemeral-jwt-secret-2026';
}
const HTTP_TEST_WEBHOOK_SECRET =
  process.env.PAYMONGO_WEBHOOK_SECRET || `whsec_http_verify_${Date.now()}`;
process.env.PAYMONGO_WEBHOOK_SECRET = HTTP_TEST_WEBHOOK_SECRET;

interface ServerHandle {
  name: string;
  port: number;
  proc: ChildProcess;
  stopping?: boolean;
}

function killProcessTree(srv: ServerHandle) {
  srv.stopping = true;
  const proc = srv.proc;
  if (!proc.pid) return;
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      proc.kill('SIGTERM');
    }
  } catch {
    // Process already exited
  }
}

function startNextApp(appName: string, appRelDir: string, port: number): ServerHandle {
  const nextBin = path.join(rootDir, 'node_modules/next/dist/bin/next');
  const appCwd = path.join(rootDir, appRelDir);
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) childEnv[k] = v;
  }
  childEnv.NODE_ENV = 'production';
  childEnv.PORT = String(port);
  childEnv.HOSTNAME = '127.0.0.1';
  childEnv.JWT_SECRET = process.env.JWT_SECRET!;
  childEnv.PAYMONGO_WEBHOOK_SECRET = HTTP_TEST_WEBHOOK_SECRET;

  const proc = spawn(
    process.execPath,
    [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)],
    {
      cwd: appCwd,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }
  );

  const handle: ServerHandle = { name: appName, port, proc, stopping: false };
  let stderrBuf = '';
  proc.stderr?.on('data', (chunk) => {
    stderrBuf += chunk.toString();
    if (stderrBuf.length > 4000) stderrBuf = stderrBuf.slice(-4000);
  });
  proc.on('exit', (code) => {
    if (!handle.stopping && code && code !== 0) {
      console.error(`[${appName}] exited unexpectedly with code ${code}: ${stderrBuf.trim()}`);
    }
  });

  return handle;
}

async function waitForHttpReady(url: string, timeoutMs = 30000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      // Wait for socket bind
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for HTTP readiness on ${url}`);
}

interface LoadStats {
  label: string;
  concurrency: number;
  totalRequests: number;
  success200: number;
  status4xx: number;
  status5xx: number;
  networkErrors: number;
  wallMs: number;
  rps: number;
  minMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

async function runBurst(
  label: string,
  url: string,
  concurrency: number,
  headers?: Record<string, string>
): Promise<LoadStats> {
  const latencies: number[] = [];
  let success200 = 0;
  let status4xx = 0;
  let status5xx = 0;
  let networkErrors = 0;

  const wallStart = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      const t0 = performance.now();
      try {
        const res = await fetch(url, {
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(25000),
        });
        await res.arrayBuffer();
        const elapsed = performance.now() - t0;
        latencies.push(elapsed);
        if (res.status === 200) success200++;
        else if (res.status >= 400 && res.status < 500) status4xx++;
        else if (res.status >= 500) status5xx++;
      } catch {
        latencies.push(performance.now() - t0);
        networkErrors++;
      }
    })
  );
  const wallMs = performance.now() - wallStart;

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const p50Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.5));
  const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

  return {
    label,
    concurrency,
    totalRequests: concurrency,
    success200,
    status4xx,
    status5xx,
    networkErrors,
    wallMs: Number(wallMs.toFixed(1)),
    rps: Number(((concurrency / wallMs) * 1000).toFixed(1)),
    minMs: Number((sorted[0] ?? 0).toFixed(1)),
    avgMs: Number((sorted.length ? sum / sorted.length : 0).toFixed(1)),
    p50Ms: Number((sorted[p50Idx] ?? 0).toFixed(1)),
    p95Ms: Number((sorted[p95Idx] ?? 0).toFixed(1)),
    maxMs: Number((sorted[sorted.length - 1] ?? 0).toFixed(1)),
  };
}

function signPaymongo(timestampSec: number, rawBody: string, secret: string): string {
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${timestampSec}.${rawBody}`)
    .digest('hex');
  return `t=${timestampSec},te=${sig},li=`;
}

async function main() {
  console.log('--- STARTING NEWSIM LIVE HTTP SECURITY & LOAD VERIFICATION ---');

  const { supabaseAdmin } = await import('../packages/database/src/supabase');
  const { createSessionToken } = await import('../packages/auth/src/session');

  const PORTS = {
    management: 3010,
    instructor: 3011,
    trainee: 3012,
  };

  const runId = `httptest_${Date.now()}`;
  const createdAuthIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdCenterIds: string[] = [];
  const servers: ServerHandle[] = [];

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`PASS: ${label}`);
      passed++;
    } else {
      console.error(`FAIL: ${label}`);
      failed++;
    }
  }

  async function createSyntheticUser(opts: {
    prefix: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR' | 'TRAINEE';
    firstName: string;
    lastName: string;
    permissions?: string[];
    position?: string;
    isMaster?: boolean;
  }) {
    const email = `${runId}_${opts.prefix}@newsim.test`;
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'HttpVerify#2026!Strong',
      email_confirm: true,
    });
    if (authErr || !authData?.user) {
      throw new Error(`createUser failed for ${opts.prefix}: ${authErr?.message}`);
    }
    const id = authData.user.id;
    createdAuthIds.push(id);

    const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
      id,
      email,
      role: opts.role,
      status: 'ACTIVE',
      first_name: opts.firstName,
      last_name: opts.lastName,
    });
    if (profErr) throw new Error(`profile upsert failed: ${profErr.message}`);

    if (opts.role === 'SUPER_ADMIN') {
      await supabaseAdmin.from('super_admins').insert({
        profile_id: id,
        is_master_admin: Boolean(opts.isMaster),
      });
    } else if (opts.role === 'ADMIN') {
      await supabaseAdmin.from('admins').insert({
        profile_id: id,
        position: opts.position || 'STAFF',
        permissions: opts.permissions || [],
      });
    } else if (opts.role === 'INSTRUCTOR') {
      await supabaseAdmin.from('instructors').insert({
        profile_id: id,
        instructor_number: `EMP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`,
        specialization: 'STCW Navigation',
      });
    } else if (opts.role === 'TRAINEE') {
      await supabaseAdmin.from('trainees').insert({
        profile_id: id,
        trainee_number: `TRN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`,
      });
    }

    const tokenRes = createSessionToken(
      {
        id,
        email,
        role: opts.role,
        firstName: opts.firstName,
        lastName: opts.lastName,
        permissions: opts.permissions,
        position: opts.position,
        status: 'ACTIVE',
      } as any,
      '127.0.0.1',
      'NewsimHttpVerify/1.0',
      false
    );

    return { id, email, token: tokenRes.token };
  }

  try {
    // 0. Pre-cleanup any leftover synthetic records from previous interrupted runs
    const { data: oldProfs } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', 'httptest_%');
    for (const p of oldProfs || []) {
      await supabaseAdmin.from('payments').delete().eq('trainee_id', p.id);
      await supabaseAdmin.from('enrollments').delete().eq('trainee_id', p.id);
      await supabaseAdmin.from('trainees').delete().eq('profile_id', p.id);
      await supabaseAdmin.from('instructors').delete().eq('profile_id', p.id);
      await supabaseAdmin.from('admins').delete().eq('profile_id', p.id);
      await supabaseAdmin.from('super_admins').delete().eq('profile_id', p.id);
      await supabaseAdmin.from('notifications').delete().eq('recipient_id', p.id);
      await supabaseAdmin.from('audit_logs').delete().eq('actor_id', p.id);
      await supabaseAdmin.from('profiles').delete().eq('id', p.id);
      await supabaseAdmin.auth.admin.deleteUser(p.id);
    }
    const { data: oldCourses } = await supabaseAdmin
      .from('courses')
      .select('id')
      .ilike('name', '%httptest_%');
    for (const c of oldCourses || []) {
      await supabaseAdmin.from('enrollments').delete().eq('course_id', c.id);
      await supabaseAdmin.from('course_instructors').delete().eq('course_id', c.id);
      await supabaseAdmin.from('batches').delete().eq('course_id', c.id);
      await supabaseAdmin.from('courses').delete().eq('id', c.id);
    }
    const { data: oldCenters } = await supabaseAdmin
      .from('training_centers')
      .select('id')
      .ilike('name', '%httptest_%');
    for (const tc of oldCenters || []) {
      await supabaseAdmin.from('training_centers').delete().eq('id', tc.id);
    }

    // 1. Start all 3 Next.js production servers
    console.log('\n[STEP 1] Starting built Next.js production servers...');
    servers.push(startNextApp('management', 'apps/management', PORTS.management));
    servers.push(startNextApp('instructor', 'apps/instructor', PORTS.instructor));
    servers.push(startNextApp('trainee', 'apps/trainee', PORTS.trainee));

    await Promise.all([
      waitForHttpReady(`http://127.0.0.1:${PORTS.management}/login`),
      waitForHttpReady(`http://127.0.0.1:${PORTS.instructor}/login`),
      waitForHttpReady(`http://127.0.0.1:${PORTS.trainee}/login`),
    ]);
    console.log('All 3 production Next.js servers are listening.');

    // 2. Security headers & static guards
    console.log('\n[STEP 2] HTTP Security Headers & Public/Debug Routes');
    for (const [name, port] of Object.entries(PORTS)) {
      const res = await fetch(`http://127.0.0.1:${port}/login`);
      const headers = res.headers;
      assert(res.status === 200, `${name} GET /login returns 200`);
      assert(headers.get('x-content-type-options') === 'nosniff', `${name} sets X-Content-Type-Options: nosniff`);
      assert(headers.get('x-frame-options') === 'SAMEORIGIN', `${name} sets X-Frame-Options: SAMEORIGIN`);
      assert(headers.get('referrer-policy') === 'strict-origin-when-cross-origin', `${name} sets Referrer-Policy`);
      assert((headers.get('permissions-policy') || '').includes('camera=(self)'), `${name} sets Permissions-Policy`);
      assert(headers.get('x-dns-prefetch-control') === 'off', `${name} sets X-DNS-Prefetch-Control: off`);
      const csp = headers.get('content-security-policy') || '';
      assert(csp.includes("default-src 'self'") && csp.includes("object-src 'none'"), `${name} sets Content-Security-Policy`);
      assert(headers.get('x-powered-by') === null, `${name} hides X-Powered-By header`);
    }

    const debugRes = await fetch(`http://127.0.0.1:${PORTS.management}/debug`, { redirect: 'manual' });
    assert(
      (debugRes.status === 307 || debugRes.status === 302) &&
        (debugRes.headers.get('location') || '').includes('/login'),
      `management /debug unauthenticated redirects to /login (got ${debugRes.status})`
    );

    // 3. Unauthenticated redirect & 401 checks
    console.log('\n[STEP 3] Unauthenticated Access Control');
    const unauthPageChecks = [
      { name: 'management /admin/dashboard', url: `http://127.0.0.1:${PORTS.management}/admin/dashboard` },
      { name: 'instructor /dashboard', url: `http://127.0.0.1:${PORTS.instructor}/dashboard` },
      { name: 'trainee /dashboard', url: `http://127.0.0.1:${PORTS.trainee}/dashboard` },
    ];
    for (const check of unauthPageChecks) {
      const res = await fetch(check.url, { redirect: 'manual' });
      const loc = res.headers.get('location') || '';
      assert((res.status === 307 || res.status === 302) && loc.includes('/login'), `${check.name} unauth redirects to /login (status=${res.status})`);
    }

    const unauthApiChecks = [
      `http://127.0.0.1:${PORTS.management}/api/super-admin/audit-logs`,
      `http://127.0.0.1:${PORTS.management}/api/admin/payments`,
      `http://127.0.0.1:${PORTS.management}/api/admin/reports?type=PAYMENTS`,
      `http://127.0.0.1:${PORTS.management}/api/admin/courses`,
      `http://127.0.0.1:${PORTS.instructor}/api/instructor/my-courses`,
      `http://127.0.0.1:${PORTS.trainee}/api/trainee/dashboard`,
      `http://127.0.0.1:${PORTS.trainee}/api/trainee/assessments`,
    ];
    for (const url of unauthApiChecks) {
      const res = await fetch(url);
      assert(res.status === 401, `Unauthenticated GET ${new URL(url).pathname} returns 401 (got ${res.status})`);
    }

    // 4. Seed synthetic users & real DB objects for RBAC & Webhook HTTP checks
    console.log('\n[STEP 4] Authenticated Cross-Portal RBAC & Financial Least-Privilege HTTP Checks');
    const superAdmin = await createSyntheticUser({
      prefix: 'sa',
      role: 'SUPER_ADMIN',
      firstName: 'Http',
      lastName: 'SuperAdmin',
      isMaster: false,
    });
    const itAdmin = await createSyntheticUser({
      prefix: 'it_admin',
      role: 'ADMIN',
      firstName: 'Http',
      lastName: 'ITSupport',
      position: 'IT_SUPPORT',
      permissions: ['COURSE_VIEW', 'USER_VIEW'],
    });
    const finAdmin = await createSyntheticUser({
      prefix: 'fin_admin',
      role: 'ADMIN',
      firstName: 'Http',
      lastName: 'Finance',
      position: 'FINANCE_OFFICER',
      permissions: ['PAYMENT_VIEW', 'PAYMENT_VERIFY', 'FINANCIAL_REPORTS', 'ENROLLMENT_VIEW', 'COURSE_VIEW'],
    });
    const instructor1 = await createSyntheticUser({
      prefix: 'inst1',
      role: 'INSTRUCTOR',
      firstName: 'Http',
      lastName: 'InstructorOne',
    });
    const instructor2 = await createSyntheticUser({
      prefix: 'inst2',
      role: 'INSTRUCTOR',
      firstName: 'Http',
      lastName: 'InstructorTwo',
    });
    const traineeA = await createSyntheticUser({
      prefix: 'trainee_a',
      role: 'TRAINEE',
      firstName: 'Http',
      lastName: 'TraineeA',
    });

    const { data: centerRow, error: centerErr } = await supabaseAdmin
      .from('training_centers')
      .insert({
        name: `NEWSIM HTTP Test Site ${runId}`,
        code: `HTTP_${Date.now().toString().slice(-6)}`,
        address: 'Cebu Practical Site',
      })
      .select('id')
      .single();
    if (centerErr || !centerRow) throw new Error(`training_center insert failed: ${centerErr?.message}`);
    createdCenterIds.push(centerRow.id);

    const { data: courseA, error: courseErr } = await supabaseAdmin
      .from('courses')
      .insert({
        name: `HTTP Security Verification Course ${runId}`,
        code: `HTTP-${Date.now().toString().slice(-5)}`,
        description: 'Temporary HTTP RBAC verification course',
        category: 'STCW Basic Training',
        duration_hours: 40,
        price: 5000,
        status: 'PUBLISHED',
      })
      .select('id')
      .single();
    if (courseErr || !courseA) throw new Error(`course insert failed: ${courseErr?.message}`);
    createdCourseIds.push(courseA.id);

    await supabaseAdmin.from('course_instructors').insert({
      course_id: courseA.id,
      instructor_id: instructor1.id,
      is_primary: true,
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const nextMonthStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const { data: batchA, error: batchErr } = await supabaseAdmin
      .from('batches')
      .insert({
        course_id: courseA.id,
        training_center_id: centerRow.id,
        instructor_id: instructor1.id,
        batch_code: `HTTP-B-${Date.now().toString().slice(-5)}`,
        start_date: todayStr,
        end_date: nextMonthStr,
        capacity: 24,
        enrolled_count: 1,
        status: 'OPEN',
        queue_order: 1,
      })
      .select('id')
      .single();
    if (batchErr || !batchA) throw new Error(`batch insert failed: ${batchErr?.message}`);

    const { data: enrollA, error: enrollErr } = await supabaseAdmin
      .from('enrollments')
      .insert({
        trainee_id: traineeA.id,
        course_id: courseA.id,
        batch_id: batchA.id,
        training_center_id: centerRow.id,
        status: 'PAYMENT_PENDING',
      })
      .select('id')
      .single();
    if (enrollErr || !enrollA) throw new Error(`enrollment insert failed: ${enrollErr?.message}`);

    const { data: payA, error: payErr } = await supabaseAdmin
      .from('payments')
      .insert({
        trainee_id: traineeA.id,
        enrollment_id: enrollA.id,
        amount: 5000,
        payment_method: 'GCASH',
        payment_environment: 'TEST',
        status: 'PENDING',
        paymongo_checkout_id: `cs_http_${runId}`,
      })
      .select('id')
      .single();
    if (payErr || !payA) throw new Error(`payment insert failed: ${payErr?.message}`);

    const superCookie = `super_admin_session_token=${superAdmin.token}`;
    const itCookie = `admin_session_token=${itAdmin.token}`;
    const finCookie = `admin_session_token=${finAdmin.token}`;
    const inst1Cookie = `instructor_session_token=${instructor1.token}`;
    const inst2Cookie = `instructor_session_token=${instructor2.token}`;
    const traineeCookie = `trainee_session_token=${traineeA.token}; session_token=${traineeA.token}`;

    // Cross-portal cookie isolation (401) & cross-role Bearer JWT rejection (403)
    const traineeCookieToSuperAdmin = await fetch(`http://127.0.0.1:${PORTS.management}/api/super-admin/audit-logs`, {
      headers: { Cookie: traineeCookie },
    });
    assert(
      traineeCookieToSuperAdmin.status === 401,
      `Portal cookie isolation ignores foreign cookie on /api/super-admin/audit-logs (401, got ${traineeCookieToSuperAdmin.status})`
    );

    const traineeToSuperAdmin = await fetch(`http://127.0.0.1:${PORTS.management}/api/super-admin/audit-logs`, {
      headers: { Authorization: `Bearer ${traineeA.token}` },
    });
    assert(
      traineeToSuperAdmin.status === 403,
      `Trainee Bearer JWT rejected from /api/super-admin/audit-logs (403, got ${traineeToSuperAdmin.status})`
    );

    const traineeCookieToAdmin = await fetch(`http://127.0.0.1:${PORTS.management}/api/admin/courses`, {
      headers: { Cookie: `session_token=${traineeA.token}` },
    });
    assert(
      traineeCookieToAdmin.status === 401,
      `Portal cookie isolation ignores generic session_token on /api/admin/courses (401, got ${traineeCookieToAdmin.status})`
    );

    const traineeToAdmin = await fetch(`http://127.0.0.1:${PORTS.management}/api/admin/courses`, {
      headers: { Authorization: `Bearer ${traineeA.token}` },
    });
    assert(
      traineeToAdmin.status === 403,
      `Trainee Bearer JWT rejected from /api/admin/courses (403, got ${traineeToAdmin.status})`
    );

    const traineeCookieToInstructor = await fetch(`http://127.0.0.1:${PORTS.instructor}/api/instructor/my-courses`, {
      headers: { Cookie: `session_token=${traineeA.token}` },
    });
    assert(
      traineeCookieToInstructor.status === 401,
      `Portal cookie isolation ignores generic session_token on /api/instructor/my-courses (401, got ${traineeCookieToInstructor.status})`
    );

    const traineeToInstructor = await fetch(`http://127.0.0.1:${PORTS.instructor}/api/instructor/my-courses`, {
      headers: { Authorization: `Bearer ${traineeA.token}` },
    });
    assert(
      traineeToInstructor.status === 403,
      `Trainee Bearer JWT rejected from /api/instructor/my-courses (403, got ${traineeToInstructor.status})`
    );

    const saDebugRes = await fetch(`http://127.0.0.1:${PORTS.management}/debug`, {
      headers: { Cookie: superCookie },
      redirect: 'manual',
    });
    assert(saDebugRes.status === 404, `management /debug authenticated returns 404 (notFound, got ${saDebugRes.status})`);

    // Super Admin RBAC + financial exclusion
    const saAuditRes = await fetch(`http://127.0.0.1:${PORTS.management}/api/super-admin/audit-logs?limit=5`, {
      headers: { Cookie: superCookie },
    });
    assert(saAuditRes.status === 200, `SUPER_ADMIN accesses /api/super-admin/audit-logs (200, got ${saAuditRes.status})`);

    const saPayRes = await fetch(`http://127.0.0.1:${PORTS.management}/api/admin/payments`, {
      headers: { Cookie: superCookie },
    });
    assert(saPayRes.status === 403, `SUPER_ADMIN blocked from /api/admin/payments (403, got ${saPayRes.status})`);

    const saPayReportRes = await fetch(`http://127.0.0.1:${PORTS.management}/api/admin/reports?type=PAYMENTS`, {
      headers: { Cookie: superCookie },
    });
    assert(saPayReportRes.status === 403, `SUPER_ADMIN blocked from /api/admin/reports?type=PAYMENTS (403, got ${saPayReportRes.status})`);

    const saEnrollRes = await fetch(`http://127.0.0.1:${PORTS.management}/api/admin/enrollments?limit=50`, {
      headers: { Cookie: superCookie },
    });
    const saEnrollBody: any = await saEnrollRes.json();
    const saTargetEnroll = (saEnrollBody?.enrollments || saEnrollBody?.data || []).find((e: any) => e.id === enrollA.id);
    assert(
      saEnrollRes.status === 200 && saTargetEnroll?.paymentStatus === 'RESTRICTED' && saTargetEnroll?.amount == null,
      `SUPER_ADMIN sees paymentStatus=RESTRICTED on /api/admin/enrollments`
    );

    // IT Support Admin financial exclusion
    const itPayRes = await fetch(`http://127.0.0.1:${PORTS.management}/api/admin/payments`, {
      headers: { Cookie: itCookie },
    });
    assert(itPayRes.status === 403, `IT Support ADMIN blocked from /api/admin/payments (403, got ${itPayRes.status})`);

    const itPayReportRes = await fetch(`http://127.0.0.1:${PORTS.management}/api/admin/reports?type=PAYMENTS`, {
      headers: { Cookie: itCookie },
    });
    assert(itPayReportRes.status === 403, `IT Support ADMIN blocked from /api/admin/reports?type=PAYMENTS (403, got ${itPayReportRes.status})`);

    const itEnrollRes = await fetch(`http://127.0.0.1:${PORTS.management}/api/admin/enrollments?limit=50`, {
      headers: { Cookie: itCookie },
    });
    const itEnrollBody: any = await itEnrollRes.json();
    const itTargetEnroll = (itEnrollBody?.enrollments || itEnrollBody?.data || []).find((e: any) => e.id === enrollA.id);
    assert(
      itEnrollRes.status === 200 && itTargetEnroll?.paymentStatus === 'RESTRICTED' && itTargetEnroll?.amount == null,
      `IT Support ADMIN sees paymentStatus=RESTRICTED on /api/admin/enrollments`
    );

    // Financial Admin authorized access
    const finPayRes = await fetch(`http://127.0.0.1:${PORTS.management}/api/admin/payments`, {
      headers: { Cookie: finCookie },
    });
    const finPayBody: any = await finPayRes.json();
    const finSawPayment = (finPayBody?.payments || finPayBody?.data || []).some((p: any) => p.id === payA.id);
    assert(finPayRes.status === 200 && finSawPayment, `Financial ADMIN accesses /api/admin/payments & sees test payment (200)`);

    const finReportRes = await fetch(`http://127.0.0.1:${PORTS.management}/api/admin/reports?type=PAYMENTS`, {
      headers: { Cookie: finCookie },
    });
    assert(finReportRes.status === 200, `Financial ADMIN accesses /api/admin/reports?type=PAYMENTS (200, got ${finReportRes.status})`);

    // Instructor course assignment scoping
    const inst1CourseRes = await fetch(`http://127.0.0.1:${PORTS.instructor}/api/instructor/my-courses/${courseA.id}`, {
      headers: { Cookie: inst1Cookie },
    });
    assert(inst1CourseRes.status === 200, `Assigned Instructor accesses /api/instructor/my-courses/[id] (200, got ${inst1CourseRes.status})`);

    const inst2CourseRes = await fetch(`http://127.0.0.1:${PORTS.instructor}/api/instructor/my-courses/${courseA.id}`, {
      headers: { Cookie: inst2Cookie },
    });
    assert(inst2CourseRes.status === 403, `Unassigned Instructor blocked from /api/instructor/my-courses/[id] (403, got ${inst2CourseRes.status})`);

    // Trainee portal authenticated routes
    const trDashRes = await fetch(`http://127.0.0.1:${PORTS.trainee}/api/trainee/dashboard`, {
      headers: { Cookie: traineeCookie },
    });
    assert(trDashRes.status === 200, `Trainee accesses /api/trainee/dashboard (200, got ${trDashRes.status})`);

    const trAssessRes = await fetch(`http://127.0.0.1:${PORTS.trainee}/api/trainee/assessments`, {
      headers: { Cookie: traineeCookie },
    });
    assert(trAssessRes.status === 200, `Trainee accesses /api/trainee/assessments (200, got ${trAssessRes.status})`);

    // 5. Live HTTP PayMongo Webhook endpoint verification (:3012/api/webhooks/paymongo)
    console.log('\n[STEP 5] Live HTTP PayMongo Webhook Verification');
    const webhookUrl = `http://127.0.0.1:${PORTS.trainee}/api/webhooks/paymongo`;
    const makeWebhookBody = (amountCentavos: number, livemode = false) =>
      JSON.stringify({
        data: {
          attributes: {
            type: 'checkout_session.payment.paid',
            livemode,
            data: {
              id: `cs_http_${runId}`,
              type: 'checkout_session',
              attributes: {
                metadata: { payment_id: payA.id, enrollment_id: enrollA.id },
                payments: [
                  {
                    id: `pay_http_${runId}`,
                    attributes: {
                      amount: amountCentavos,
                      currency: 'PHP',
                      source: { type: 'gcash' },
                    },
                  },
                ],
              },
            },
          },
        },
      });

    const nowSec = Math.floor(Date.now() / 1000);
    const validBody = makeWebhookBody(500000, false);

    const badSigRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'paymongo-signature': `t=${nowSec},te=deadbeef,li=` },
      body: validBody,
    });
    assert(badSigRes.status === 401, `HTTP PayMongo webhook rejects forged HMAC signature (401, got ${badSigRes.status})`);

    const staleRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paymongo-signature': signPaymongo(nowSec - 600, validBody, HTTP_TEST_WEBHOOK_SECRET),
      },
      body: validBody,
    });
    assert(staleRes.status === 401, `HTTP PayMongo webhook rejects >300s replay timestamp (401, got ${staleRes.status})`);

    const liveModeBody = makeWebhookBody(500000, true);
    const liveModeRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paymongo-signature': signPaymongo(nowSec, liveModeBody, HTTP_TEST_WEBHOOK_SECRET),
      },
      body: liveModeBody,
    });
    assert(liveModeRes.status === 400, `HTTP PayMongo webhook rejects livemode=true in TEST mode (400, got ${liveModeRes.status})`);

    const mismatchBody = makeWebhookBody(100, false);
    const mismatchRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paymongo-signature': signPaymongo(nowSec, mismatchBody, HTTP_TEST_WEBHOOK_SECRET),
      },
      body: mismatchBody,
    });
    assert(mismatchRes.status === 400, `HTTP PayMongo webhook rejects centavo mismatch 100 vs 500000 (400, got ${mismatchRes.status})`);

    // Reset payment back to PENDING after intentional mismatch marked FAILED, then test valid webhook & idempotency
    await supabaseAdmin.from('payments').update({ status: 'PENDING' }).eq('id', payA.id);
    const validSig = signPaymongo(nowSec, validBody, HTTP_TEST_WEBHOOK_SECRET);
    const okWebhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'paymongo-signature': validSig },
      body: validBody,
    });
    const replayWebhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'paymongo-signature': validSig },
      body: validBody,
    });
    const replayJson: any = await replayWebhookRes.json();
    const { data: settledPay } = await supabaseAdmin
      .from('payments')
      .select('status, payment_environment')
      .eq('id', payA.id)
      .single();
    assert(
      okWebhookRes.status === 200 &&
        replayWebhookRes.status === 200 &&
        replayJson?.idempotent === true &&
        settledPay?.status === 'PAID' &&
        settledPay?.payment_environment === 'TEST',
      `HTTP PayMongo webhook settles test payment (PAID/TEST) and handles replay idempotently`
    );

    // 6. Concurrent HTTP Load Tests (10, 25, 50, 100 concurrency)
    console.log('\n[STEP 6] Concurrent HTTP Load Tests (10, 25, 50, 100)');
    // Warm up each portal before timing
    await runBurst('warmup-trainee-login', `http://127.0.0.1:${PORTS.trainee}/login`, 5);
    await runBurst('warmup-mgmt-courses', `http://127.0.0.1:${PORTS.management}/api/admin/courses`, 5, {
      Cookie: finCookie,
    });
    await runBurst('warmup-inst-courses', `http://127.0.0.1:${PORTS.instructor}/api/instructor/my-courses`, 5, {
      Cookie: inst1Cookie,
    });
    await runBurst('warmup-trainee-assess', `http://127.0.0.1:${PORTS.trainee}/api/trainee/assessments`, 5, {
      Cookie: traineeCookie,
    });
    await runBurst('warmup-trainee-dash', `http://127.0.0.1:${PORTS.trainee}/api/trainee/dashboard`, 3, {
      Cookie: traineeCookie,
    });

    const targets = [
      {
        label: 'Trainee GET /login (SSR/Static)',
        url: `http://127.0.0.1:${PORTS.trainee}/login`,
        headers: undefined as Record<string, string> | undefined,
        levels: [10, 25, 50, 100],
      },
      {
        label: 'Management GET /api/admin/courses (Auth + DB)',
        url: `http://127.0.0.1:${PORTS.management}/api/admin/courses`,
        headers: { Cookie: finCookie },
        levels: [10, 25, 50, 100],
      },
      {
        label: 'Instructor GET /api/instructor/my-courses (Auth + DB)',
        url: `http://127.0.0.1:${PORTS.instructor}/api/instructor/my-courses`,
        headers: { Cookie: inst1Cookie },
        levels: [10, 25, 50, 100],
      },
      {
        label: 'Trainee GET /api/trainee/assessments (Auth + DB)',
        url: `http://127.0.0.1:${PORTS.trainee}/api/trainee/assessments`,
        headers: { Cookie: traineeCookie },
        levels: [10, 25, 50, 100],
      },
      {
        label: 'Trainee GET /api/trainee/dashboard (Heavy Aggregate)',
        url: `http://127.0.0.1:${PORTS.trainee}/api/trainee/dashboard`,
        headers: { Cookie: traineeCookie },
        levels: [10, 25],
      },
    ];

    const allLoadResults: LoadStats[] = [];
    for (const target of targets) {
      for (const concurrency of target.levels) {
        const stats = await runBurst(target.label, target.url, concurrency, target.headers);
        allLoadResults.push(stats);
        console.log(
          `LOAD | ${stats.label} | N=${stats.concurrency} | 200=${stats.success200}/${stats.totalRequests} | 5xx=${stats.status5xx} | netErr=${stats.networkErrors} | wall=${stats.wallMs}ms | rps=${stats.rps} | min=${stats.minMs}ms avg=${stats.avgMs}ms p50=${stats.p50Ms}ms p95=${stats.p95Ms}ms max=${stats.maxMs}ms`
        );
        assert(
          stats.success200 === stats.totalRequests && stats.status5xx === 0 && stats.networkErrors === 0,
          `${target.label} concurrency=${concurrency} completed 100% 200 OK with 0 5xx / 0 network errors`
        );
      }
    }
  } finally {
    console.log('\n[CLEANUP] Stopping child Next.js servers & deleting synthetic HTTP test rows...');
    for (const srv of servers) {
      killProcessTree(srv);
    }
    for (const cid of createdCourseIds) {
      await supabaseAdmin.from('payments').delete().eq('trainee_id', createdAuthIds[createdAuthIds.length - 1] || '');
      await supabaseAdmin.from('enrollments').delete().eq('course_id', cid);
      await supabaseAdmin.from('course_instructors').delete().eq('course_id', cid);
      await supabaseAdmin.from('batches').delete().eq('course_id', cid);
      await supabaseAdmin.from('courses').delete().eq('id', cid);
    }
    for (const tcId of createdCenterIds) {
      await supabaseAdmin.from('training_centers').delete().eq('id', tcId);
    }
    for (const uid of createdAuthIds) {
      await supabaseAdmin.from('payments').delete().eq('trainee_id', uid);
      await supabaseAdmin.from('enrollments').delete().eq('trainee_id', uid);
      await supabaseAdmin.from('trainees').delete().eq('profile_id', uid);
      await supabaseAdmin.from('instructors').delete().eq('profile_id', uid);
      await supabaseAdmin.from('admins').delete().eq('profile_id', uid);
      await supabaseAdmin.from('super_admins').delete().eq('profile_id', uid);
      await supabaseAdmin.from('notifications').delete().eq('recipient_id', uid);
      await supabaseAdmin.from('audit_logs').delete().eq('actor_id', uid);
      await supabaseAdmin.from('profiles').delete().eq('id', uid);
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }
    console.log('HTTP test cleanup complete.');
  }

  console.log('\n==========================================================');
  console.log(`HTTP & LOAD SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==========================================================');
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal HTTP verification error:', err);
  process.exit(1);
});
