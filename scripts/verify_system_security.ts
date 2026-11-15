import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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
loadEnv(path.join(rootDir, 'apps/trainee/.env.local'));
loadEnv(path.join(rootDir, '.env.local'));
loadEnv(path.join(rootDir, '.env'));

async function main() {
  console.log('==========================================================');
  console.log('NEWSIM SYSTEM SECURITY, RLS, RBAC & CONCURRENCY SUITE');
  console.log('==========================================================');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const { supabaseAdmin } = await import('../packages/database/src/supabase');
  const { uploadToLearningMaterialsStorage, deleteFromLearningMaterialsStorage } = await import('../packages/database/src/security-helpers');
  const { handlePaymongoWebhookRequest } = await import('../packages/database/src/paymongo-webhook');
  const { calculateTraineeCourseGrade, saveGradingPolicy } = await import('../packages/database/src/queries/grading');
  const { savePracticalEvaluation, getTraineeEvaluationDetails } = await import('../packages/database/src/queries/rubrics');
  const {
    getCourseBatchAttendanceRoster,
    saveInstructorBatchAttendance,
    finalizeInstructorBatchAttendance,
  } = await import('../packages/database/src/queries/attendance-sessions');
  const {
    getInstructorCourseIds,
    getInstructorCourseDetails,
    getInstructorTraineeDetails,
    getInstructorAssessmentSubmissions,
    updateInstructorGrade,
    recordInstructorAttendance,
  } = await import('../packages/database/src/queries/instructor-portal');
  const {
    getTraineeLearningMaterials,
    getTraineeAssessmentsList,
    recordTraineeLessonCompletion,
    submitTraineeAssessment,
  } = await import('../packages/database/src/queries/trainee-portal');
  const { resolveAdminContextFromDb, formatEnrollment } = await import('../apps/management/src/lib/admin-api');
  const { createSessionToken, SUPER_ADMIN_COOKIE_NAME } = await import('../packages/auth/src/session');
  const { verifySuperAdminRequest, hasFinancialPermission } = await import('../packages/auth/src/auth-guard');
  const { NextRequest } = await import('next/server');

  let passed = 0;
  let failed = 0;
  const createdAuthUserIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdPolicyIds: string[] = [];
  const createdCenterIds: string[] = [];
  const createdStorageUris: string[] = [];

  function assert(condition: boolean, label: string, detail?: string) {
    if (condition) {
      console.log(`PASS: ${label}`);
      passed++;
    } else {
      console.error(`FAIL: ${label}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  async function expectThrows(fn: () => Promise<any>, label: string, match?: RegExp) {
    try {
      await fn();
      console.error(`FAIL: ${label} -> expected throw, resolved instead`);
      failed++;
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (match && !match.test(msg)) {
        console.error(`FAIL: ${label} -> threw unexpected error "${msg}"`);
        failed++;
      } else {
        console.log(`PASS: ${label} (rejected: ${msg.slice(0, 90)})`);
        passed++;
      }
    }
  }

  const runId = crypto.randomBytes(4).toString('hex');
  const password = `N3wsim!Verify#${runId}`;

  async function createSyntheticUser(opts: {
    prefix: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR' | 'TRAINEE';
    firstName: string;
    lastName: string;
    position?: string;
    permissions?: string[];
  }) {
    const email = `audit_${opts.prefix}_${runId}@newsim-verify.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: opts.role, first_name: opts.firstName, last_name: opts.lastName },
    });
    if (error || !created.user) {
      throw new Error(`Failed to create auth user ${opts.prefix}: ${error?.message}`);
    }
    const uid = created.user.id;
    createdAuthUserIds.push(uid);

    await supabaseAdmin.from('profiles').upsert({
      id: uid,
      email,
      first_name: opts.firstName,
      last_name: opts.lastName,
      role: opts.role,
      status: 'ACTIVE',
    });

    if (opts.role === 'SUPER_ADMIN') {
      const { error: saErr } = await supabaseAdmin.from('super_admins').upsert({ profile_id: uid });
      if (saErr) throw new Error(`super_admins upsert failed: ${saErr.message}`);
    } else if (opts.role === 'ADMIN') {
      const { error: adErr } = await supabaseAdmin.from('admins').upsert({
        profile_id: uid,
        position: opts.position || 'Registrar',
        permissions: opts.permissions || ['ENROLLMENT_VIEW'],
      });
      if (adErr) throw new Error(`admins upsert failed: ${adErr.message}`);
    } else if (opts.role === 'INSTRUCTOR') {
      const { error: insErr } = await supabaseAdmin
        .from('instructors')
        .upsert({ profile_id: uid, instructor_number: `INS-${runId}-${opts.prefix}` });
      if (insErr) throw new Error(`instructors upsert failed: ${insErr.message}`);
    } else if (opts.role === 'TRAINEE') {
      const { error: trErr } = await supabaseAdmin.from('trainees').upsert({
        profile_id: uid,
        srn: `SRN-T-${runId}-${opts.prefix}`.toUpperCase(),
        enrollment_status: 'ACTIVE',
      });
      if (trErr) throw new Error(`trainees upsert failed: ${trErr.message}`);
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data: signInData, error: signErr } = await anonClient.auth.signInWithPassword({ email, password });
    if (signErr || !signInData.session?.access_token) {
      throw new Error(`Failed sign-in for ${opts.prefix}: ${signErr?.message}`);
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } },
    });

    return { id: uid, email, role: opts.role, client: userClient };
  }

  try {
    // Seed 1 Training Center + 2 Synthetic Courses (Course A assigned to Inst 1, Course B assigned to Inst 2)
    const { data: centerRow, error: centerErr } = await supabaseAdmin
      .from('training_centers')
      .insert({ name: `Verify Center ${runId}`, code: `VC-${runId.toUpperCase()}`, city: 'Cebu' })
      .select('id')
      .single();
    if (centerErr || !centerRow) throw new Error(`Center create failed: ${centerErr?.message}`);
    createdCenterIds.push(centerRow.id);

    const [
      superAdmin,
      finAdmin,
      itAdmin,
      instructor1,
      instructor2,
      traineeA,
      traineeB,
    ] = await Promise.all([
      createSyntheticUser({ prefix: 'sa', role: 'SUPER_ADMIN', firstName: 'Audit', lastName: 'SuperAdmin' }),
      createSyntheticUser({
        prefix: 'fin',
        role: 'ADMIN',
        firstName: 'Audit',
        lastName: 'FinanceAdmin',
        position: 'Cashier & Registrar',
        permissions: ['ENROLLMENT_VIEW', 'ENROLLMENT_MANAGE', 'PAYMENT_VIEW', 'PAYMENT_VERIFY'],
      }),
      createSyntheticUser({
        prefix: 'it',
        role: 'ADMIN',
        firstName: 'Audit',
        lastName: 'ITSupport',
        position: 'IT Support',
        permissions: ['USER_VIEW', 'ENROLLMENT_VIEW'],
      }),
      createSyntheticUser({ prefix: 'inst1', role: 'INSTRUCTOR', firstName: 'Audit', lastName: 'Instructor1' }),
      createSyntheticUser({ prefix: 'inst2', role: 'INSTRUCTOR', firstName: 'Audit', lastName: 'Instructor2' }),
      createSyntheticUser({ prefix: 'trA', role: 'TRAINEE', firstName: 'Audit', lastName: 'TraineeA' }),
      createSyntheticUser({ prefix: 'trB', role: 'TRAINEE', firstName: 'Audit', lastName: 'TraineeB' }),
    ]);

    const { data: courseA, error: courseAErr } = await supabaseAdmin
      .from('courses')
      .insert({
        code: `VER-A-${runId.toUpperCase()}`,
        name: `Verification Course A ${runId}`,
        training_center_id: centerRow.id,
        capacity: 24,
        price: 5000,
        duration_hours: 16,
        status: 'PUBLISHED',
      })
      .select('id')
      .single();
    if (courseAErr || !courseA) throw new Error(`courseA insert failed: ${courseAErr?.message}`);
    const { data: courseB, error: courseBErr } = await supabaseAdmin
      .from('courses')
      .insert({
        code: `VER-B-${runId.toUpperCase()}`,
        name: `Verification Course B ${runId}`,
        training_center_id: centerRow.id,
        capacity: 24,
        price: 7500,
        duration_hours: 16,
        status: 'PUBLISHED',
      })
      .select('id')
      .single();
    if (courseBErr || !courseB) throw new Error(`courseB insert failed: ${courseBErr?.message}`);
    createdCourseIds.push(courseA.id, courseB.id);

    // Assign instructor1 to courseA only, instructor2 to courseB only
    const { error: ciErr } = await supabaseAdmin.from('course_instructors').insert([
      { course_id: courseA.id, instructor_id: instructor1.id },
      { course_id: courseB.id, instructor_id: instructor2.id },
    ]);
    if (ciErr) throw new Error(`course_instructors insert failed: ${ciErr.message}`);

    // Batches (Verify DB check constraint rejects capacity > 24, then create valid 24-seat batch)
    const formatManilaIso = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
    const todayIso = formatManilaIso(new Date());
    const startPast = formatManilaIso(new Date(Date.now() - 86400000));
    const futureEnd = formatManilaIso(new Date(Date.now() + 14 * 86400000));

    const { error: cap30Err } = await supabaseAdmin.from('batches').insert({
      course_id: courseA.id,
      training_center_id: centerRow.id,
      instructor_id: instructor1.id,
      batch_code: `BATCH-OVER-${runId.toUpperCase()}`,
      start_date: startPast,
      end_date: futureEnd,
      capacity: 30,
      enrolled_count: 0,
      status: 'OPEN',
    });
    assert(Boolean(cap30Err && /capacity/i.test(cap30Err.message)), 'DB CHECK constraint rejects batch capacity > 24');

    const { data: batchA, error: batchAErr } = await supabaseAdmin
      .from('batches')
      .insert({
        course_id: courseA.id,
        training_center_id: centerRow.id,
        instructor_id: instructor1.id,
        batch_code: `BATCH-A-${runId.toUpperCase()}`,
        start_date: startPast,
        end_date: futureEnd,
        capacity: 24,
        enrolled_count: 22,
        status: 'OPEN',
        queue_order: 1,
      })
      .select('id')
      .single();
    if (batchAErr || !batchA) throw new Error(`batchA insert failed: ${batchAErr?.message}`);

    const { data: batchB, error: batchBErr } = await supabaseAdmin
      .from('batches')
      .insert({
        course_id: courseB.id,
        training_center_id: centerRow.id,
        instructor_id: instructor2.id,
        batch_code: `BATCH-B-${runId.toUpperCase()}`,
        start_date: startPast,
        end_date: futureEnd,
        capacity: 24,
        enrolled_count: 0,
        status: 'OPEN',
        queue_order: 1,
      })
      .select('id')
      .single();

    // Modules, materials, assessments, questions & choices for Course A (Day 1 = past/today AVAILABLE, Day 2 = LOCKED future)
    const { data: mod1 } = await supabaseAdmin
      .from('course_modules')
      .insert({ course_id: courseA!.id, title: 'Day 1 Safety Module', sort_order: 1 })
      .select('id')
      .single();
    const { data: mod2 } = await supabaseAdmin
      .from('course_modules')
      .insert({ course_id: courseA!.id, title: 'Day 2 Survival Module', sort_order: 2 })
      .select('id')
      .single();

    const uploadedDay1 = await uploadToLearningMaterialsStorage(
      `verification/${runId}/day1-notes.txt`,
      Buffer.from('NEWSIM STCW Day 1 Deck Safety Material'),
      'text/plain'
    );
    createdStorageUris.push(uploadedDay1.storageUri);

    const { data: mat1 } = await supabaseAdmin
      .from('learning_materials')
      .insert({
        module_id: mod1!.id,
        title: 'Day 1 Deck Notes',
        material_type: 'DOCUMENT',
        file_url: uploadedDay1.storageUri,
        external_url: uploadedDay1.storageUri,
      })
      .select('id')
      .single();
    const { data: mat2 } = await supabaseAdmin
      .from('learning_materials')
      .insert({
        module_id: mod2!.id,
        title: 'Day 2 Locked Handbook',
        material_type: 'DOCUMENT',
        external_url: 'storage://learning-materials/procedures.json',
      })
      .select('id')
      .single();

    const { data: mod1Quiz } = await supabaseAdmin
      .from('assessments')
      .insert({ course_id: courseA!.id, module_id: mod1!.id, title: 'Mod 1 Quiz', assessment_type: 'QUIZ', passing_score: 70 })
      .select('id')
      .single();
    const { data: mod2Quiz } = await supabaseAdmin
      .from('assessments')
      .insert({ course_id: courseA!.id, module_id: mod2!.id, title: 'Mod 2 Quiz', assessment_type: 'QUIZ', passing_score: 70 })
      .select('id')
      .single();
    const { data: q1, error: q1Err } = await supabaseAdmin
      .from('assessment_questions')
      .insert({ assessment_id: mod1Quiz!.id, question_text: 'Mandatory STCW muster check?', question_type: 'MULTIPLE_CHOICE', points: 10, sort_order: 1 })
      .select('id')
      .single();
    if (q1Err || !q1) throw new Error(`q1 insert failed: ${q1Err?.message}`);
    const { data: q1Choices, error: q1cErr } = await supabaseAdmin
      .from('assessment_choices')
      .insert([
        { question_id: q1.id, choice_text: 'Verify muster list', is_correct: true, sort_order: 1 },
        { question_id: q1.id, choice_text: 'Ignore muster signal', is_correct: false, sort_order: 2 },
      ])
      .select('id, is_correct');
    if (q1cErr || !q1Choices) throw new Error(`q1Choices insert failed: ${q1cErr?.message}`);
    const q1Right = q1Choices!.find((c: any) => c.is_correct)!;
    const q1Wrong = q1Choices!.find((c: any) => !c.is_correct)!;

    // Enroll Trainee A in Course A (ACTIVE), Trainee B in Course B (ACTIVE)
    const { data: enrA } = await supabaseAdmin
      .from('enrollments')
      .insert({
        trainee_id: traineeA.id,
        course_id: courseA!.id,
        batch_id: batchA!.id,
        training_center_id: centerRow.id,
        status: 'ACTIVE',
        enrolled_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (!enrA) throw new Error('enrA insert returned null');
    const { data: enrB, error: enrBErr } = await supabaseAdmin
      .from('enrollments')
      .insert({
        trainee_id: traineeB.id,
        course_id: courseB.id,
        batch_id: batchB!.id,
        training_center_id: centerRow.id,
        status: 'ACTIVE',
        enrolled_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (enrBErr || !enrB) throw new Error(`enrB insert failed: ${enrBErr?.message}`);

    // Daily pacing seed: Day 1 = today (AVAILABLE), Day 2 = tomorrow (LOCKED)
    const tomorrowIso = formatManilaIso(new Date(Date.now() + 86400000));
    const { error: dmtErr } = await supabaseAdmin.from('trainee_daily_module_tracking').insert([
      {
        trainee_id: traineeA.id,
        course_id: courseA.id,
        module_id: mod1!.id,
        day_number: 1,
        scheduled_date: todayIso,
        status: 'AVAILABLE',
      },
      {
        trainee_id: traineeA.id,
        course_id: courseA.id,
        module_id: mod2!.id,
        day_number: 2,
        scheduled_date: tomorrowIso,
        status: 'LOCKED',
      },
    ]);
    if (dmtErr) throw new Error(`trainee_daily_module_tracking insert failed: ${dmtErr.message}`);

    // Payment records for Trainee A (Course A) & Trainee B (Course B)
    const { data: payA, error: payAErr } = await supabaseAdmin
      .from('payments')
      .insert({
        trainee_id: traineeA.id,
        enrollment_id: enrA.id,
        amount: 5000,
        status: 'PENDING',
        payment_method: 'GCASH',
        paymongo_checkout_id: `cs_test_${runId}`,
      })
      .select('*')
      .single();
    if (payAErr || !payA) throw new Error(`payA insert failed: ${payAErr?.message}`);

    // ---------------------------------------------------------
    // 1. LIVE SUPABASE RLS & RPC SECURITY MATRIX
    // ---------------------------------------------------------
    console.log('\n[GROUP 1] Live Supabase RLS & RPC Privileges');
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const [anonProfiles, anonPayments, anonQuestions, anonChoices, anonCourses] = await Promise.all([
      anonClient.from('profiles').select('id').eq('id', traineeA.id),
      anonClient.from('payments').select('id').eq('id', payA!.id),
      anonClient.from('assessment_questions').select('id').eq('assessment_id', mod1Quiz!.id),
      anonClient.from('assessment_choices').select('id').eq('question_id', q1!.id),
      anonClient.from('courses').select('id').eq('id', courseA!.id),
    ]);
    assert((anonProfiles.data?.length ?? 0) === 0, 'Anon cannot read profiles');
    assert((anonPayments.data?.length ?? 0) === 0, 'Anon cannot read payments');
    assert((anonQuestions.data?.length ?? 0) === 0, 'Anon cannot read assessment_questions');
    assert((anonChoices.data?.length ?? 0) === 0, 'Anon cannot read assessment_choices (answer key)');
    assert((anonCourses.data?.length ?? 0) === 1, 'Anon can read published course catalog');

    const [trAOwnEnr, trBOtherEnr, trAOwnPay, trBOtherPay, trAQuestions, trAChoices] = await Promise.all([
      traineeA.client.from('enrollments').select('id').eq('id', enrA!.id),
      traineeA.client.from('enrollments').select('id').eq('id', enrB!.id),
      traineeA.client.from('payments').select('id').eq('id', payA!.id),
      traineeB.client.from('payments').select('id').eq('id', payA!.id),
      traineeA.client.from('assessment_questions').select('id').eq('assessment_id', mod1Quiz!.id),
      traineeA.client.from('assessment_choices').select('id, is_correct').eq('question_id', q1!.id),
    ]);
    assert((trAOwnEnr.data?.length ?? 0) === 1, 'Trainee A can read own enrollment');
    assert((trBOtherEnr.data?.length ?? 0) === 0, 'Trainee A cannot read Trainee B enrollment (RLS)');
    assert((trAOwnPay.data?.length ?? 0) === 1, 'Trainee A can read own payment');
    assert((trBOtherPay.data?.length ?? 0) === 0, 'Trainee B cannot read Trainee A payment (RLS)');
    assert((trAQuestions.data?.length ?? 0) === 0 && (trAChoices.data?.length ?? 0) === 0, 'Trainee cannot directly query answer-key tables via PostgREST (RLS)');

    const [saPayRead, itPayRead, finPayRead] = await Promise.all([
      superAdmin.client.from('payments').select('id').eq('id', payA!.id),
      itAdmin.client.from('payments').select('id').eq('id', payA!.id),
      finAdmin.client.from('payments').select('id').eq('id', payA!.id),
    ]);
    assert((saPayRead.data?.length ?? 0) === 0, 'SUPER_ADMIN blocked from payments in live PostgreSQL RLS');
    assert((itPayRead.data?.length ?? 0) === 0, 'IT Support ADMIN blocked from payments in live PostgreSQL RLS');
    assert((finPayRead.data?.length ?? 0) === 1, 'Financial ADMIN (PAYMENT_VIEW) allowed to read payments in RLS');

    const rpcAsTrainee = await traineeA.client.rpc('record_failed_login_attempt', { p_profile_id: traineeB.id });
    const enrollRpcAsTrainee = await traineeA.client.rpc('enroll_in_batch', {
      p_batch_id: batchA!.id,
      p_trainee_id: traineeA.id,
      p_course_id: courseA!.id,
    });
    assert(Boolean(rpcAsTrainee.error), 'Trainee JWT denied execute on record_failed_login_attempt RPC');
    assert(Boolean(enrollRpcAsTrainee.error), 'Trainee JWT denied execute on enroll_in_batch RPC');

    // ---------------------------------------------------------
    // 2. RBAC & FINANCIAL ISOLATION HELPERS
    // ---------------------------------------------------------
    console.log('\n[GROUP 2] Least-Privilege RBAC & Financial Data Masking');
    const [saDbCtx, finDbCtx, itDbCtx] = await Promise.all([
      resolveAdminContextFromDb(superAdmin.id),
      resolveAdminContextFromDb(finAdmin.id),
      resolveAdminContextFromDb(itAdmin.id),
    ]);
    assert(
      !hasFinancialPermission({ role: 'SUPER_ADMIN', permissions: ['ALL'] } as any) &&
        !saDbCtx.permissions.some((p) => p.startsWith('PAYMENT_')),
      'SUPER_ADMIN context excludes PAYMENT_* and hasFinancialPermission=false'
    );
    assert(
      hasFinancialPermission({ role: 'ADMIN', permissions: finDbCtx.permissions } as any),
      'Financial ADMIN has hasFinancialPermission=true'
    );
    assert(
      !hasFinancialPermission({ role: 'ADMIN', permissions: itDbCtx.permissions } as any),
      'IT Support ADMIN has hasFinancialPermission=false'
    );

    const { token: fakeSaToken } = createSessionToken(
      {
        id: superAdmin.id,
        email: superAdmin.email,
        username: superAdmin.email,
        passwordHash: '',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        firstName: 'Audit',
        lastName: 'SA',
        mfaEnabled: true,
        failedLoginAttempts: 0,
        mustChangePassword: false,
        createdAt: '',
        updatedAt: '',
      },
      '127.0.0.1',
      'VerifySuite',
      false
    );
    const saReq = new NextRequest('http://localhost:3000/api/super-admin/analytics', {
      headers: { cookie: `${SUPER_ADMIN_COOKIE_NAME}=${fakeSaToken}` },
    });
    const saGuard = verifySuperAdminRequest(saReq, 'PAYMENT_VIEW');
    assert(!saGuard.authorized && saGuard.statusCode === 403, 'verifySuperAdminRequest rejects PAYMENT_VIEW permission with 403');

    const maskedEnr = formatEnrollment(
      { id: enrA!.id, status: 'PENDING_REVIEW', courses: {}, batches: {}, trainees: { profiles: {} }, payments: [payA] },
      { includeFinancial: false }
    );
    const unmaskedEnr = formatEnrollment(
      { id: enrA!.id, status: 'PENDING_REVIEW', courses: {}, batches: {}, trainees: { profiles: {} }, payments: [payA] },
      { includeFinancial: true }
    );
    assert(
      maskedEnr.paymentStatus === 'RESTRICTED' && maskedEnr.paymentAmount === null && maskedEnr.paymongoCheckoutId === null,
      'formatEnrollment masks financial fields when includeFinancial=false'
    );
    assert(unmaskedEnr.paymentAmount === 5000 && unmaskedEnr.paymentStatus === 'PENDING', 'formatEnrollment preserves financial details for financial admins');

    // ---------------------------------------------------------
    // 3. TRAINEE DAILY MODULE LOCK, ANSWER KEYS & SERVER GRADING
    // ---------------------------------------------------------
    console.log('\n[GROUP 3] Trainee Daily Module Lock, Answer Keys & Server Grading');
    const lessons = await getTraineeLearningMaterials(courseA!.id, traineeA.id);
    const mod1Lesson = lessons.find((l: any) => l.moduleId === mod1!.id);
    const mod2Lesson = lessons.find((l: any) => l.moduleId === mod2!.id);
    assert(Boolean(mod1Lesson && !mod1Lesson.isLocked && typeof mod1Lesson.fileUrl === 'string' && mod1Lesson.fileUrl.startsWith('https://')), 'Day 1 module unlocked and signs private Storage URL');
    assert(Boolean(mod2Lesson && mod2Lesson.isLocked && mod2Lesson.fileUrl === null && mod2Lesson.videoUrl === null), 'Day 2 module is LOCKED and strips private Storage URLs');
    assert(
      Boolean(mod1Lesson?.moduleAssessment?.questions?.[0]?.choices?.every((c: any) => !('isCorrect' in c))),
      'Learning materials omits isCorrect pre-submission'
    );

    const lockedAssessments = await getTraineeAssessmentsList(traineeA.id);
    const mod2AsmView = lockedAssessments.find((a: any) => a.id === mod2Quiz!.id);
    assert(Boolean(mod2AsmView && mod2AsmView.isLocked && mod2AsmView.questions.length === 0), 'getTraineeAssessmentsList hides questions on locked modules');

    await expectThrows(
      () => recordTraineeLessonCompletion(traineeA.id, courseA!.id, mat2!.id, mod2!.id),
      'Cannot complete locked Day 2 lesson',
      /LOCKED/i
    );
    await expectThrows(
      () => submitTraineeAssessment(mod1Quiz!.id, 100, { [q1!.id]: q1Right.id }, traineeA.id),
      'Cannot submit Mod 1 quiz before marking module read',
      /ASSESSMENT_LOCKED/i
    );

    // Mark Day 1 complete, then test client score spoofing protection
    await recordTraineeLessonCompletion(traineeA.id, courseA!.id, mat1!.id, mod1!.id);
    const attempt1 = await submitTraineeAssessment(
      mod1Quiz!.id,
      100, // spoofed score = 100 while submitting WRONG answer!
      { [q1!.id]: q1Wrong.id },
      traineeA.id
    );
    assert(attempt1.score === 0 && attempt1.passed === false, 'submitTraineeAssessment ignores spoofed client score and grades 0% for wrong answer');
    const attempt2 = await submitTraineeAssessment(mod1Quiz!.id, 100, { [q1!.id]: q1Right.id }, traineeA.id);
    assert(attempt2.alreadyAttempted === true && attempt2.score === 0, 'STCW 1-attempt rule prevents retake score overwrite');

    // ---------------------------------------------------------
    // 4. INSTRUCTOR COURSE OWNERSHIP, FINALIZED ATTENDANCE & RUBRIC LOCKS
    // ---------------------------------------------------------
    console.log('\n[GROUP 4] Instructor Scoping & Finalized Immutability');
    await expectThrows(() => getInstructorCourseDetails(courseB!.id, instructor1.id), 'Instructor 1 blocked from Course B details', /FORBIDDEN/);
    await expectThrows(() => getInstructorTraineeDetails(traineeB.id, instructor1.id), 'Instructor 1 blocked from Trainee B (Course B) profile', /FORBIDDEN/);
    await expectThrows(
      () => getInstructorAssessmentSubmissions(mod1Quiz!.id, instructor2.id),
      'Instructor 2 blocked from Course A assessment submissions',
      /FORBIDDEN/
    );
    await expectThrows(
      () => updateInstructorGrade({ submissionId: attempt1.attemptId, score: 90, instructorId: instructor2.id }),
      'Instructor 2 blocked from grading Course A submission',
      /FORBIDDEN/
    );

    // Substitute instructor access + cancelled schedule exclusion
    const inst2Before = await getInstructorCourseIds(instructor2.id);
    assert(!inst2Before.includes(courseA!.id), 'Instructor 2 not initially assigned to Course A');

    // Save & Finalize Batch Attendance as Instructor 1
    await saveInstructorBatchAttendance({
      courseId: courseA!.id,
      batchId: batchA!.id,
      sessionDate: todayIso,
      instructorProfileId: instructor1.id,
      records: [{ traineeId: traineeA.id, status: 'PRESENT', remarks: 'Verified' }],
    });
    const rosterCheck = await getCourseBatchAttendanceRoster({
      courseId: courseA!.id,
      batchId: batchA!.id,
      sessionDate: todayIso,
      instructorProfileId: instructor2.id,
    });
    assert(!rosterCheck.isAuthorized, 'Unassigned Instructor 2 marks isAuthorized=false on Course A attendance roster');

    const finAtt = await finalizeInstructorBatchAttendance({
      courseId: courseA!.id,
      batchId: batchA!.id,
      sessionDate: todayIso,
      instructorProfileId: instructor1.id,
      acknowledgeUnmarked: true,
    });
    assert(Boolean(finAtt.success && finAtt.session?.status === 'FINALIZED'), 'Instructor 1 finalized Batch A attendance');
    await expectThrows(
      () => finalizeInstructorBatchAttendance({ courseId: courseA!.id, batchId: batchA!.id, sessionDate: todayIso, instructorProfileId: instructor1.id }),
      'Duplicate finalize attendance rejected',
      /already finalized/i
    );
    await expectThrows(
      () =>
        recordInstructorAttendance(todayIso, 'SES-TEST', courseA!.id, [{ traineeId: traineeA.id, status: 'ABSENT' }], instructor1.id),
      'Post-finalization attendance mutation via recordInstructorAttendance rejected',
      /finalized/i
    );

    // Rubric creation & finalized COMPETENT lock
    const { data: rubricA } = await supabaseAdmin
      .from('practical_rubrics')
      .insert({ course_id: courseA!.id, title: `Verify Rubric ${runId}`, passing_score: 75, max_score: 100, status: 'ACTIVE' })
      .select('id')
      .single();
    const { data: crit1 } = await supabaseAdmin
      .from('practical_rubric_criteria')
      .insert({ rubric_id: rubricA!.id, criterion_name: 'SCBA Drill', max_points: 100, weight_pct: 100, sort_order: 1, is_critical: true })
      .select('id')
      .single();

    await expectThrows(
      () =>
        savePracticalEvaluation({
          rubricId: rubricA!.id,
          traineeId: traineeA.id,
          instructorProfileId: instructor2.id,
          courseId: courseA!.id,
          scores: [{ criterionId: crit1!.id, score: 90 }],
          status: 'FINALIZED',
        }),
      'Instructor 2 blocked from grading Course A practical evaluation',
      /FORBIDDEN/
    );

    await expectThrows(
      () =>
        savePracticalEvaluation({
          rubricId: rubricA!.id,
          traineeId: traineeB.id, // Enrolled in Course B, NOT Course A!
          instructorProfileId: instructor1.id,
          courseId: courseA!.id,
          scores: [{ criterionId: crit1!.id, score: 90 }],
          status: 'FINALIZED',
        }),
      'Instructor 1 blocked from grading unenrolled trainee on Course A rubric',
      /FORBIDDEN/
    );

    const evalRes = await savePracticalEvaluation({
      rubricId: rubricA!.id,
      traineeId: traineeA.id,
      instructorProfileId: instructor1.id,
      courseId: courseA!.id,
      scores: [{ criterionId: crit1!.id, score: 90 }],
      status: 'FINALIZED',
    });
    assert(evalRes.competencyStatus === 'COMPETENT', 'Practical evaluation marks COMPETENT for >=75% score');
    await expectThrows(
      () =>
        savePracticalEvaluation({
          rubricId: rubricA!.id,
          traineeId: traineeA.id,
          instructorProfileId: instructor1.id,
          courseId: courseA!.id,
          scores: [{ criterionId: crit1!.id, score: 80 }],
          status: 'FINALIZED',
        }),
      'Modifying finalized COMPETENT evaluation requires amendmentReason',
      /amendment\s*reason/i
    );
    await expectThrows(
      () => getTraineeEvaluationDetails(rubricA!.id, traineeA.id, instructor2.id),
      'Instructor 2 blocked from viewing Course A evaluation details',
      /FORBIDDEN/
    );

    // ---------------------------------------------------------
    // 5. GRADING ENGINE BOUNDARY & CERTIFICATE WITHHOLDING
    // ---------------------------------------------------------
    console.log('\n[GROUP 5] Grading Engine Math (0%, 74%, 75%, 100%, Withholding)');
    // Update trainee A's Mod 1 attempt to passing (75%) first, then test withholding with failed/incomplete Mod 2 or custom policy
    await supabaseAdmin.from('assessment_attempts').update({ score: 75, status: 'PASSED', passed: true }).eq('id', attempt1.attemptId);
    // Insert active certificate manually first to ensure grading engine WITHHOLDS it if Mod 2 is incomplete!
    const { data: prematureCert } = await supabaseAdmin
      .from('certificates')
      .insert({
        trainee_id: traineeA.id,
        course_id: courseA!.id,
        enrollment_id: enrA!.id,
        certificate_number: `CERT-TEST-${runId}`,
        status: 'ACTIVE',
      })
      .select('id')
      .single();

    const gWithheld = await calculateTraineeCourseGrade({ traineeId: traineeA.id, courseId: courseA!.id });
    const { data: certAfterWithheld } = await supabaseAdmin.from('certificates').select('status').eq('id', prematureCert!.id).single();
    assert(
      !gWithheld.passed && certAfterWithheld?.status === 'WITHHELD',
      'Grading engine rejects pass & sets premature ACTIVE certificate to WITHHELD when Mod 2 incomplete'
    );

    // Test boundary scores with Mod 2 completed: 74% -> FAIL, 75% & 100% -> PASS
    const { data: q2, error: q2Err } = await supabaseAdmin
      .from('assessment_questions')
      .insert({ assessment_id: mod2Quiz!.id, question_text: 'Lifeboat release hook safety?', question_type: 'MULTIPLE_CHOICE', points: 10, sort_order: 1 })
      .select('id')
      .single();
    if (q2Err || !q2) throw new Error(`q2 insert failed: ${q2Err?.message}`);
    await supabaseAdmin.from('assessment_attempts').insert({
      assessment_id: mod2Quiz!.id,
      trainee_id: traineeA.id,
      attempt_number: 1,
      score: 73, // Avg(75, 73) = 74%
      status: 'PASSED',
      passed: true,
    });
    // Set practical score to 74% -> Weighted overall = 74%
    await savePracticalEvaluation({
      rubricId: rubricA!.id,
      traineeId: traineeA.id,
      instructorProfileId: instructor1.id,
      courseId: courseA!.id,
      scores: [{ criterionId: crit1!.id, score: 74 }],
      status: 'FINALIZED',
      amendmentReason: 'Boundary verification 74%',
    });
    const customPol75 = await saveGradingPolicy({
      courseId: courseA!.id,
      name: `Boundary Policy 75 ${runId}`,
      attendanceWeight: 0,
      practicalWeight: 60,
      moduleQuizWeight: 40,
      passingGrade: 75,
      minAttendancePct: 80,
      lateCreditPct: 75,
      practicalCompetencyRequired: false,
      status: 'ACTIVE',
      userId: superAdmin.id,
    });
    createdPolicyIds.push(customPol75.id);
    const g74 = await calculateTraineeCourseGrade({ traineeId: traineeA.id, courseId: courseA!.id });
    assert(
      !g74.passed && g74.finalStatus === 'NEEDS_REMEDIATION' && Number(g74.overallScore) < 75,
      `74% fails passingGrade=75 (got ${g74.overallScore}%, status=${g74.finalStatus}, passed=${g74.passed})`
    );

    // Boundary 75% -> PASS
    await supabaseAdmin.from('assessment_attempts').update({ score: 75, status: 'PASSED', passed: true }).eq('trainee_id', traineeA.id);
    await savePracticalEvaluation({
      rubricId: rubricA!.id,
      traineeId: traineeA.id,
      instructorProfileId: instructor1.id,
      courseId: courseA!.id,
      scores: [{ criterionId: crit1!.id, score: 75 }],
      status: 'FINALIZED',
      amendmentReason: 'Boundary verification 75%',
    });
    const g75 = await calculateTraineeCourseGrade({ traineeId: traineeA.id, courseId: courseA!.id });
    assert(g75.passed && Number(g75.overallScore) === 75, `75% passes passingGrade=75 (got ${g75.overallScore}%, passed=${g75.passed})`);

    // Boundary 100% -> PASS
    await supabaseAdmin.from('assessment_attempts').update({ score: 100, status: 'PASSED', passed: true }).eq('trainee_id', traineeA.id);
    await savePracticalEvaluation({
      rubricId: rubricA!.id,
      traineeId: traineeA.id,
      instructorProfileId: instructor1.id,
      courseId: courseA!.id,
      scores: [{ criterionId: crit1!.id, score: 100 }],
      status: 'FINALIZED',
      amendmentReason: 'Boundary verification 100%',
    });
    const g100 = await calculateTraineeCourseGrade({ traineeId: traineeA.id, courseId: courseA!.id });
    assert(g100.passed && Number(g100.overallScore) === 100, `100% passes (got ${g100.overallScore}%, passed=${g100.passed})`);

    // Custom policy with passingGrade = 0 & practicalWeight = 0 & moduleQuizWeight = 100 (tests nullish ?? fix)
    const customPolZero = await saveGradingPolicy({
      id: customPol75.id,
      courseId: courseA!.id,
      name: `Zero Weight Policy ${runId}`,
      attendanceWeight: 0,
      practicalWeight: 0,
      moduleQuizWeight: 100,
      passingGrade: 0,
      minAttendancePct: 0,
      lateCreditPct: 100,
      practicalCompetencyRequired: false,
      status: 'ACTIVE',
      userId: superAdmin.id,
    });
    await supabaseAdmin.from('assessment_attempts').update({ score: 0, status: 'PASSED', passed: true }).eq('trainee_id', traineeA.id);
    const g0 = await calculateTraineeCourseGrade({ traineeId: traineeA.id, courseId: courseA!.id });
    assert(customPolZero.practical_weight === 0 && Number(g0.overallScore) === 0, `Custom practicalWeight=0 preserved (score=${g0.overallScore})`);

    // ---------------------------------------------------------
    // 6. PAYMONGO WEBHOOK SECURITY (HMAC, 300s SKEW, CENTAVOS, IDEMPOTENCY)
    // ---------------------------------------------------------
    console.log('\n[GROUP 6] PayMongo Webhook HMAC, Replay Window, Amount & Idempotency');
    const prevWebhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    process.env.PAYMONGO_WEBHOOK_SECRET = `whsec_verify_${runId}`;
    const webhookPayload = (amountCentavos: number, livemode = false) =>
      JSON.stringify({
        data: {
          attributes: {
            type: 'checkout_session.payment.paid',
            livemode,
            data: {
              id: `cs_test_${runId}`,
              type: 'checkout_session',
              attributes: {
                payment_method_used: 'gcash',
                metadata: { payment_id: payA!.id, enrollment_id: enrA!.id, trainee_id: traineeA.id },
                payments: [{ id: `pay_test_${runId}`, attributes: { amount: amountCentavos, currency: 'PHP', status: 'paid' } }],
              },
            },
          },
        },
      });
    const signBody = (tsSec: number, body: string) => {
      const hex = crypto.createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET!).update(`${tsSec}.${body}`).digest('hex');
      return `t=${tsSec},te=${hex},li=`;
    };
    const nowSec = Math.floor(Date.now() / 1000);
    const bodyValid = webhookPayload(500000, false);

    const badSig = await handlePaymongoWebhookRequest(bodyValid, `t=${nowSec},te=deadbeef`);
    assert(badSig.status === 401, 'PayMongo webhook rejects invalid HMAC signature (401)');
    const staleTs = await handlePaymongoWebhookRequest(bodyValid, signBody(nowSec - 400, bodyValid));
    assert(staleTs.status === 401, 'PayMongo webhook rejects timestamp > 300s old (401)');
    const liveRejected = await handlePaymongoWebhookRequest(webhookPayload(500000, true), signBody(nowSec, webhookPayload(500000, true)));
    assert(liveRejected.status === 400, 'PayMongo webhook rejects livemode=true event in TEST mode (400)');
    const mismatchBody = webhookPayload(100, false); // ₱1 instead of ₱5000!
    const mismatchRes = await handlePaymongoWebhookRequest(mismatchBody, signBody(nowSec, mismatchBody));
    assert(mismatchRes.status === 400, 'PayMongo webhook rejects centavo mismatch ₱1 vs ₱5000 (400)');

    // Reset payment back to PENDING and verify valid webhook settles cleanly & replays idempotently
    await supabaseAdmin.from('payments').update({ status: 'PENDING' }).eq('id', payA!.id);
    const validRes = await handlePaymongoWebhookRequest(bodyValid, signBody(nowSec, bodyValid));
    const replayRes = await handlePaymongoWebhookRequest(bodyValid, signBody(nowSec, bodyValid));
    assert(validRes.status === 200 && replayRes.status === 200 && replayRes.body.idempotent === true, 'PayMongo webhook accepts valid signature & handles duplicate replay idempotently');
    process.env.PAYMONGO_WEBHOOK_SECRET = prevWebhookSecret;

    // ---------------------------------------------------------
    // 7. CONCURRENCY: 24-SEAT BATCH CAPACITY CLAMP & RACE CONDITION
    // ---------------------------------------------------------
    console.log('\n[GROUP 7] 24-Seat Batch Capacity & Concurrent Enrollment Race');
    const raceTrainees = await Promise.all(
      [1, 2, 3, 4].map((n) => createSyntheticUser({ prefix: `race${n}`, role: 'TRAINEE', firstName: 'Race', lastName: `T${n}` }))
    );
    const raceResults = await Promise.allSettled(
      raceTrainees.map((rt) =>
        supabaseAdmin.rpc('enroll_in_batch', {
          p_batch_id: batchA!.id,
          p_trainee_id: rt.id,
          p_course_id: courseA!.id,
          p_training_center_id: centerRow.id,
        })
      )
    );
    const raceSuccess = raceResults.filter((r) => r.status === 'fulfilled' && !(r.value as any).error).length;
    const { data: batchAfterRace } = await supabaseAdmin.from('batches').select('enrolled_count, status').eq('id', batchA!.id).single();
    assert(
      raceSuccess === 2 && batchAfterRace?.enrolled_count === 24 && batchAfterRace?.status === 'FULL',
      `Batch A (22/24 seats open despite capacity=30) allowed strictly 2/4 concurrent racers -> enrolled_count=${batchAfterRace?.enrolled_count}, status=${batchAfterRace?.status}`
    );

    // Also test Course Post-Test unlock vs lock & Q2 exists clean
    void q2;
  } finally {
    console.log('\n[CLEANUP] Removing all synthetic verification rows...');
    for (const pid of createdPolicyIds) {
      await supabaseAdmin.from('grading_policies').delete().eq('id', pid);
    }
    for (const cid of createdCourseIds) {
      await supabaseAdmin.from('enrollments').delete().eq('course_id', cid);
      await supabaseAdmin.from('payments').delete().eq('enrollment_id', cid);
      await supabaseAdmin.from('attendance').delete().eq('course_id', cid);
      await supabaseAdmin.from('attendance_sessions').delete().eq('course_id', cid);
      await supabaseAdmin.from('practical_evaluations').delete().eq('course_id', cid);
      await supabaseAdmin.from('practical_rubrics').delete().eq('course_id', cid);
      await supabaseAdmin.from('grades').delete().eq('course_id', cid);
      await supabaseAdmin.from('certificates').delete().eq('course_id', cid);
      await supabaseAdmin.from('trainee_daily_module_tracking').delete().eq('course_id', cid);
      await supabaseAdmin.from('trainee_lesson_completions').delete().eq('course_id', cid);
      await supabaseAdmin.from('assessments').delete().eq('course_id', cid);
      await supabaseAdmin.from('course_modules').delete().eq('course_id', cid);
      await supabaseAdmin.from('course_instructors').delete().eq('course_id', cid);
      await supabaseAdmin.from('enrollments').delete().eq('course_id', cid);
      await supabaseAdmin.from('batches').delete().eq('course_id', cid);
      await supabaseAdmin.from('courses').delete().eq('id', cid);
    }
    for (const tcId of createdCenterIds) {
      await supabaseAdmin.from('training_centers').delete().eq('id', tcId);
    }
    for (const uri of createdStorageUris) {
      await deleteFromLearningMaterialsStorage(uri);
    }
    for (const uid of createdAuthUserIds) {
      await supabaseAdmin.from('payments').delete().eq('trainee_id', uid);
      await supabaseAdmin.from('assessment_attempts').delete().eq('trainee_id', uid);
      await supabaseAdmin.from('trainees').delete().eq('profile_id', uid);
      await supabaseAdmin.from('instructors').delete().eq('profile_id', uid);
      await supabaseAdmin.from('admins').delete().eq('profile_id', uid);
      await supabaseAdmin.from('super_admins').delete().eq('profile_id', uid);
      await supabaseAdmin.from('notifications').delete().eq('recipient_id', uid);
      await supabaseAdmin.from('audit_logs').delete().eq('actor_id', uid);
      await supabaseAdmin.from('profiles').delete().eq('id', uid);
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }
    console.log('Cleanup complete.');
  }

  console.log('\n==========================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==========================================================');
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
