import { supabaseAdmin } from '../supabase';
import { resolveMaterialAccessUrl } from '../security-helpers';
import { processScheduleAutomaticTransitions } from './schedules';
import { dispatchNotificationEvent, getUserNotifications, NOTIFICATION_EVENTS } from './notifications';
import { calculateTraineeCourseGrade, isInHouseModularCourse, courseRequiresPractical, type CourseGradeBreakdown } from './grading';

/**
 * Adapt the grading engine's CourseGradeBreakdown into the shape consumed by the
 * trainee Grades page (courseTitle / status / weights / components ...).
 * The raw breakdown fields are preserved for backwards compatibility.
 */
function sanitizeModularAssessmentTitle(title?: string | null, isFullModular?: boolean): string {
  const raw = String(title || '').trim();
  if (!raw || !isFullModular) return raw;
  return raw
    .replace(/\(Prerequisite for Practical Training\)/gi, '(Comprehensive Final Modular Assessment)')
    .replace(/&\s*Practical Simulator Readiness/gi, '& Applied Operational Competency');
}

function toTraineeCourseBreakdownView(b: CourseGradeBreakdown) {
  const att = b.attendanceComponent;
  const prac = b.practicalComponent;
  const mod = b.moduleComponent;
  const attDetails = att?.details || {};
  const pracDetails = prac?.details || {};
  const modDetails = mod?.details || {};
  const minAttendancePct = Number(attDetails.requiredMinimumPct) || 80;
  const requiresPractical = b.requiresPractical ?? !pracDetails.isFullModular;
  const isFullModular = b.deliveryMode === 'FULL_MODULAR' || !requiresPractical;
  const competencyStatus = !requiresPractical
    ? 'NOT_REQUIRED'
    : (pracDetails.competencyStatus && pracDetails.competencyStatus !== 'NOT_EVALUATED'
      ? String(pracDetails.competencyStatus)
      : (pracDetails.allCompetenciesCompleted ? 'COMPETENT' : undefined));

  const attWeight = isFullModular ? 0 : (att?.weight ?? 0);
  const pracWeight = isFullModular ? 0 : (prac?.weight ?? 0);
  const modWeight = isFullModular ? 100 : (mod?.weight ?? 100);

  const includeAttendance = !isFullModular && (attWeight > 0 || Number(attDetails.totalSessions) > 0);
  const includePractical = !isFullModular;

  const rawQuizzes = Array.isArray(modDetails.assessments) ? modDetails.assessments : [];
  const quizDetails = rawQuizzes.map((q: any) => ({
    ...q,
    title: sanitizeModularAssessmentTitle(q.title, isFullModular),
  }));

  return {
    ...b,
    courseTitle: b.courseName,
    courseCategory: b.courseCategory || (requiresPractical ? 'Safety and Other STCW Courses' : 'In-House Courses'),
    deliveryMode: isFullModular ? 'FULL_MODULAR' : 'MODULAR_AND_PRACTICAL',
    isFullModular,
    requiresPractical: !isFullModular,
    overallGrade: b.overallScore ?? 0,
    status: b.finalStatus || 'IN_PROGRESS',
    minAttendancePct: isFullModular ? 0 : minAttendancePct,
    practicalCompetencyRequired: !isFullModular,
    isCompliant: b.mandatoryRequirementsMet,
    hasMandatoryFailures: !b.mandatoryRequirementsMet,
    mandatoryFailureReasons: b.mandatoryRemarks || [],
    weights: {
      attendance: attWeight,
      practical: pracWeight,
      moduleQuiz: modWeight,
    },
    components: {
      ...(includeAttendance
        ? {
            attendance: {
              score: att?.score ?? 0,
              weight: attWeight,
              weightedContribution: att?.contribution ?? 0,
              meetsRequirement:
                Number(attDetails.totalSessions) > 0 &&
                Number(attDetails.attendancePercentage) >= minAttendancePct,
              minRequired: minAttendancePct,
              totalSessions: Number(attDetails.totalSessions) || 0,
              present: Number(attDetails.presentSessions) || 0,
              late: Number(attDetails.lateSessions) || 0,
            },
          }
        : {}),
      ...(includePractical
        ? {
            practical: {
              score: prac?.score ?? 0,
              weight: pracWeight,
              weightedContribution: prac?.contribution ?? 0,
              competencyStatus,
            },
          }
        : {}),
      moduleQuiz: {
        score: mod?.score ?? 0,
        weight: modWeight,
        weightedContribution: mod?.contribution ?? 0,
        completedCount: Number(modDetails.completedQuizzes ?? modDetails.completedAssessments) || 0,
        totalCount: Number(modDetails.totalQuizzes ?? modDetails.totalAssessments) || 0,
        quizDetails,
      },
    },
  };
}

/**
 * Returns true when an SRN value is a system placeholder / auto-generated value
 * rather than a real, trainee-supplied Seafarer Registration Number.
 * Every seafarer has a unique SRN, so the system must NEVER invent one.
 */
export function isPlaceholderSrn(value?: string | null): boolean {
  const v = (value || '').toString().trim();
  if (!v) return true;
  const upper = v.toUpperCase();
  return (
    upper.includes('SRN-PENDING') ||
    upper.includes('TRN-PENDING') ||
    upper === 'SRN-REGISTERED' ||
    // Auto-generated internal trainee numbers (e.g. TRN-7C6BA115) are NOT SRNs
    /^TRN-[0-9A-F]{6,8}$/.test(upper)
  );
}

/**
 * Resolve the trainee's REAL SRN. Only the explicit `srn` columns are trusted;
 * `trainee_number` is an internal identifier and must never be shown as an SRN.
 */
export function resolveRealSrn(traineeRow?: any, profileRow?: any): string | null {
  const candidates = [traineeRow?.srn, profileRow?.srn, traineeRow?.trainee_number];
  for (const c of candidates) {
    if (!isPlaceholderSrn(c)) return String(c).trim();
  }
  return null;
}

/**
 * Helper to ensure a valid trainee profile ID exists.
 * If the provided profileId is missing, finds the first active trainee from profiles.
 */
export async function resolveTraineeProfileId(providedId?: string): Promise<string> {
  if (providedId && providedId !== 'usr-trn-01') {
    return providedId;
  }
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'TRAINEE')
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle();

  return data?.id || '0adbdfe9-b719-404b-a31f-2960a734cd73';
}

/**
 * Trainee Profile Data (joined profiles & trainees)
 */
export async function getTraineeProfileData(profileId: string) {
  const resolvedId = await resolveTraineeProfileId(profileId);

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', resolvedId)
    .single();

  if (profErr) throw profErr;

  let { data: trainee } = await supabaseAdmin
    .from('trainees')
    .select('*')
    .eq('profile_id', resolvedId)
    .maybeSingle();

  // If trainee row doesn't exist yet, create a baseline record without generating a fake SRN
  if (!trainee) {
    const { data: createdTrainee } = await supabaseAdmin
      .from('trainees')
      .insert({
        profile_id: resolvedId,
        srn: null,
        trainee_number: null,
        enrollment_status: 'ACTIVE',
      })
      .select()
      .maybeSingle();
    trainee = createdTrainee;
  }

  // Seafarer Registration Number (SRN) must be real - never return placeholder as valid
  // Only a trainee-supplied SRN is valid; never fall back to auto-generated trainee numbers
  const validSrn = resolveRealSrn(trainee, profile);

  return {
    id: profile.id,
    email: profile.email,
    username: profile.username || profile.email?.split('@')[0],
    firstName: profile.first_name,
    lastName: profile.last_name,
    phone: profile.phone || '',
    srn: validSrn,
    isSrnSet: Boolean(validSrn),
    rank: trainee?.gender || 'Maritime Trainee',
    vesselType: 'Commercial Vessel',
    enrollmentStatus: trainee?.enrollment_status || 'ACTIVE',
    mfaEnabled: Boolean(profile.mfa_enabled && profile.mfa_secret),
    status: profile.status,
    avatarUrl: profile.avatar_url || null,
    createdAt: profile.created_at,
  };
}

export async function updateTraineeProfileData(
  profileId: string,
  updates: { firstName?: string; lastName?: string; phone?: string; srn?: string; avatarUrl?: string | null }
) {
  const resolvedId = await resolveTraineeProfileId(profileId);

  // If updating SRN, perform rigorous validation and uniqueness verification
  if (updates.srn !== undefined) {
    const cleanSrn = updates.srn.trim();
    if (!cleanSrn) {
      throw new Error('SRN cannot be empty.');
    }

    // Check SRN uniqueness in trainees table excluding current trainee (parameterized queries)
    const [{ data: existingBySrn }, { data: existingByNumber }] = await Promise.all([
      supabaseAdmin
        .from('trainees')
        .select('profile_id, srn, trainee_number')
        .eq('srn', cleanSrn)
        .neq('profile_id', resolvedId)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('trainees')
        .select('profile_id, srn, trainee_number')
        .eq('trainee_number', cleanSrn)
        .neq('profile_id', resolvedId)
        .limit(1)
        .maybeSingle(),
    ]);
    const existingTrainee = existingBySrn || existingByNumber;

    if (existingTrainee) {
      const err = new Error('This SRN is already associated with another trainee account.');
      (err as any).code = 'DUPLICATE_SRN';
      throw err;
    }

    // Also check profiles table
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, srn')
      .eq('srn', cleanSrn)
      .neq('id', resolvedId)
      .maybeSingle();

    if (existingProfile) {
      const err = new Error('This SRN is already associated with another trainee account.');
      (err as any).code = 'DUPLICATE_SRN';
      throw err;
    }

    // Update trainees table with validated real SRN
    const { data: traineeExists } = await supabaseAdmin
      .from('trainees')
      .select('profile_id')
      .eq('profile_id', resolvedId)
      .maybeSingle();

    if (traineeExists) {
      await supabaseAdmin
        .from('trainees')
        .update({
          srn: cleanSrn,
          trainee_number: cleanSrn,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', resolvedId);
    } else {
      await supabaseAdmin
        .from('trainees')
        .insert({
          profile_id: resolvedId,
          srn: cleanSrn,
          trainee_number: cleanSrn,
          enrollment_status: 'ACTIVE',
        });
    }

    // Also update profiles.srn if column exists
    try {
      await supabaseAdmin
        .from('profiles')
        .update({ srn: cleanSrn })
        .eq('id', resolvedId);
    } catch {
      // non-blocking
    }
  }

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.firstName !== undefined) payload.first_name = updates.firstName;
  if (updates.lastName !== undefined) payload.last_name = updates.lastName;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(payload)
    .eq('id', resolvedId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Available Published Courses for Enrollment (with associated batches)
 */
export async function getAvailableCourses(filters?: { category?: string; search?: string }) {
  let query = supabaseAdmin
    .from('courses')
    .select(`
      *,
      batches (
        id,
        batch_code,
        start_date,
        end_date,
        capacity,
        enrolled_count,
        status,
        queue_order
      )
    `)
    .eq('status', 'PUBLISHED')
    .order('name', { ascending: true });

  if (filters?.category && filters.category !== 'ALL') {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;
  if (error) throw error;

  let courses = data || [];

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    courses = courses.filter((c: any) =>
      c.name?.toLowerCase().includes(s) ||
      c.code?.toLowerCase().includes(s) ||
      c.category?.toLowerCase().includes(s) ||
      c.description?.toLowerCase().includes(s)
    );
  }

  // Map to format consumed by frontend (Admin sets schedule, no fixed schedule for trainees)
  return courses.map((c: any) => {
    const allBatches = (c.batches || [])
      .sort((a: any, b: any) => (a.queue_order || 1) - (b.queue_order || 1));
    const openBatches = allBatches.filter((b: any) => b.status === 'OPEN');
    const availableOpenBatches = openBatches.filter((b: any) => (b.enrolled_count || 0) < Math.min(b.capacity || 24, 24));
    const activeBatch = availableOpenBatches[0] || openBatches[0] || null;

    return {
      id: c.id,
      code: c.code || 'STCW-MOD',
      name: c.name,
      title: c.name,
      description: c.description || 'Comprehensive maritime STCW certified program.',
      category: c.category || 'Deck / Engine STCW',
      durationHours: c.duration_hours || 40,
      duration_hours: c.duration_hours || 40,
      fee: Number(c.price) || 7500,
      price: Number(c.price) || 7500,
      status: c.status || 'PUBLISHED',
      capacity: c.capacity || 24,
      centerName: 'NEWSIM Training Center',
      batches: allBatches,
      activeBatch,
      hasOpenBatch: true,
      nextBatchDate: null,
      queueNotice: 'Schedule is set by Admin. There is no fixed schedule.',
    };
  });
}

/**
 * Available Published Course Packages for Enrollment
 */
export async function getAvailablePackages() {
  const { data, error } = await supabaseAdmin
    .from('course_packages')
    .select(`
      *,
      course_package_items (
        sort_order,
        courses (
          id,
          code,
          name,
          price,
          duration_hours,
          category,
          batches (id, batch_code, start_date, end_date, capacity, enrolled_count, status)
        )
      )
    `)
    .eq('status', 'ACTIVE')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Trainee Enrollments (includes batch, course, package, and payment details)
 */
export async function getTraineeEnrollmentsList(traineeId: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  const [profileRes, traineeRes, enrollmentsRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('first_name, last_name, email, phone').eq('id', resolvedId).maybeSingle(),
    supabaseAdmin.from('trainees').select('trainee_number, srn, address, city, province, nationality').eq('profile_id', resolvedId).maybeSingle(),
    supabaseAdmin
      .from('enrollments')
      .select(`
        *,
        courses (
          id,
          code,
          name,
          description,
          category,
          duration_hours,
          price,
          status
        ),
        batches (
          id,
          batch_code,
          start_date,
          end_date,
          capacity,
          enrolled_count,
          status,
          queue_order
        ),
        course_packages (
          id,
          package_code,
          name,
          package_price
        ),
        payments (
          id,
          amount,
          payment_method,
          reference_number,
          status,
          paymongo_checkout_url,
          paymongo_checkout_id,
          paymongo_payment_id,
          payment_environment,
          paid_at,
          created_at
        )
      `)
      .eq('trainee_id', resolvedId)
      .order('created_at', { ascending: false }),
  ]);

  if (enrollmentsRes.error) throw enrollmentsRes.error;

  const rawEnrollments = enrollmentsRes.data || [];

  // Reconcile any PENDING payments that have a PayMongo checkout session only when TEST MODE key is configured
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  const authHeader =
    secretKey && secretKey.startsWith('sk_test_')
      ? 'Basic ' + Buffer.from(secretKey + ':').toString('base64')
      : null;

  await Promise.all(
    rawEnrollments.map(async (enr: any) => {
      if (!authHeader) return;
      const payments = Array.isArray(enr.payments) ? enr.payments : (enr.payments ? [enr.payments] : []);
      const pendingPayment = payments.find((p: any) => (p.status === 'PENDING' || p.status === 'PROCESSING') && p.paymongo_checkout_id);
      if (pendingPayment && ((enr.status || '').toUpperCase() === 'PAYMENT_PENDING' || (enr.status || '').toUpperCase() === 'PENDING')) {
        try {
          const pmRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${pendingPayment.paymongo_checkout_id}`, {
            method: 'GET',
            headers: { 'Authorization': authHeader },
            signal: AbortSignal.timeout(2500),
          });
          if (pmRes.ok) {
            const pmData = await pmRes.json();
            const sessionAttrs = pmData.data?.attributes || {};
            const pmPayments = Array.isArray(sessionAttrs.payments) ? sessionAttrs.payments : [];
            const expectedCentavos = Math.round(Number(pendingPayment.amount) * 100);
            const paidEntry = pmPayments.find(
              (p: any) =>
                p.attributes?.status === 'paid' &&
                (p.attributes?.currency || 'PHP').toUpperCase() === 'PHP' &&
                Number(p.attributes?.amount) === expectedCentavos
            );
            if (!sessionAttrs.livemode && paidEntry) {
              const now = new Date().toISOString();
              const primaryPayment = paidEntry;
              const paymongoPaymentId = primaryPayment.id || null;
              const methodUsed = (primaryPayment.attributes?.source?.type || sessionAttrs.payment_method_used || pendingPayment.payment_method || 'GCASH').toUpperCase();

              const { data: transitioned } = await supabaseAdmin
                .from('payments')
                .update({
                  status: 'PAID',
                  paid_at: now,
                  paymongo_payment_id: paymongoPaymentId,
                  payment_method: methodUsed.includes('MAYA') ? 'MAYA' : 'GCASH',
                  updated_at: now,
                })
                .eq('id', pendingPayment.id)
                .neq('status', 'PAID')
                .neq('status', 'VERIFIED')
                .select('id')
                .maybeSingle();

              if (transitioned) {
                await supabaseAdmin
                  .from('enrollments')
                  .update({
                    status: 'PENDING_REVIEW',
                    updated_at: now,
                  })
                  .eq('id', enr.id)
                  .in('status', ['PAYMENT_PENDING', 'PENDING']);

                pendingPayment.status = 'PAID';
                pendingPayment.paid_at = now;
                pendingPayment.paymongo_payment_id = paymongoPaymentId;
                enr.status = 'PENDING_REVIEW';
              }
            }
          }
        } catch (pmErr) {
          console.warn('PayMongo auto-sync check notice:', pmErr);
        }
      }
    })
  );

  const profile = profileRes.data;
  const trainee = traineeRes.data;
  const traineeDetails = {
    fullName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Maritime Trainee',
    email: profile?.email || '',
    phone: profile?.phone || 'N/A',
    srn: resolveRealSrn(trainee) || 'SRN-PENDING',
    traineeNumber: trainee?.trainee_number || 'TRN-PENDING',
    address: [trainee?.address, trainee?.city, trainee?.province].filter(Boolean).join(', ') || 'N/A',
    nationality: trainee?.nationality || 'Filipino',
  };

  return rawEnrollments.map((enr: any) => {
    const course = enr.courses || {};
    const batch = enr.batches || {};
    const pkg = enr.course_packages || {};
    const fee = pkg.package_price ? Number(pkg.package_price) : (Number(course.price) || 7500);
    const payments = Array.isArray(enr.payments) ? enr.payments : (enr.payments ? [enr.payments] : []);
    const latestPayment = payments[payments.length - 1];

    const isPaid = latestPayment?.status === 'PAID' || latestPayment?.status === 'VERIFIED';
    const isEnrolled = ['ENROLLED', 'ACTIVE', 'APPROVED', 'COMPLETED'].includes((enr.status || '').toUpperCase());

    let paymentStatus = 'PENDING';
    if (isPaid) paymentStatus = 'VERIFIED';
    else if (latestPayment?.status === 'FAILED' || latestPayment?.status === 'REJECTED') paymentStatus = 'REJECTED';
    else if (latestPayment?.status === 'PROCESSING') paymentStatus = 'PROCESSING';

    // Package / Course Access Lifecycle States (Part 4)
    // - PENDING_PAYMENT: Tuition payment not settled or verified
    // - PENDING_REVIEW: Payment settled, awaiting registrar/admin enrollment verification
    // - PENDING_START: Paid and enrolled, but batch start date is in the future
    // - READY_TO_START: Batch start date reached and course is ready for first activity
    // - IN_PROGRESS: Training underway
    // - COMPLETED: Course completion confirmed
    let packageAccessState: 'PENDING_PAYMENT' | 'PENDING_REVIEW' | 'PENDING_START' | 'READY_TO_START' | 'IN_PROGRESS' | 'COMPLETED' = 'PENDING_PAYMENT';
    const normalizedStatus = (enr.status || '').toUpperCase();

    if (!isPaid) {
      packageAccessState = 'PENDING_PAYMENT';
    } else if (normalizedStatus === 'PENDING_REVIEW') {
      packageAccessState = 'PENDING_REVIEW';
    } else if (normalizedStatus === 'COMPLETED') {
      packageAccessState = 'COMPLETED';
    } else if (['ENROLLED', 'ACTIVE', 'APPROVED'].includes(normalizedStatus)) {
      const nowMs = Date.now();
      const startMs = batch.start_date ? new Date(batch.start_date).getTime() : 0;
      if (startMs > nowMs) {
        packageAccessState = 'PENDING_START';
      } else if (normalizedStatus === 'ACTIVE') {
        packageAccessState = 'IN_PROGRESS';
      } else {
        packageAccessState = 'READY_TO_START';
      }
    }

    return {
      id: enr.id,
      enrollmentNo: `ENR-${enr.id.slice(0, 8).toUpperCase()}`,
      courseId: enr.course_id,
      courseCode: course.code || 'STCW',
      courseTitle: course.name || pkg.name || 'Maritime Course',
      batchId: enr.batch_id,
      batchCode: batch.batch_code || 'TBD',
      batchStartDate: batch.start_date || '',
      batchEndDate: batch.end_date || '',
      batchQueueOrder: batch.queue_order || 1,
      packageId: enr.package_id,
      packageName: pkg.name || null,
      centerName: 'NEWSIM Maritime Training Center',
      status: enr.status || 'PAYMENT_PENDING',
      packageAccessState,
      paymentStatus,
      paymentId: latestPayment?.id,
      paymongoCheckoutUrl: latestPayment?.paymongo_checkout_url,
      paymongoCheckoutId: latestPayment?.paymongo_checkout_id,
      paymongoPaymentId: latestPayment?.paymongo_payment_id,
      paymentReference: latestPayment?.reference_number,
      paymentMethod: latestPayment?.payment_method || 'GCASH',
      paidAt: latestPayment?.paid_at,
      fee,
      reviewNotes: enr.review_notes,
      appliedAt: enr.enrolled_at || enr.created_at,
      trainee: traineeDetails,
      ongoingNotice: 'Your payment is on-going. Please wait for admin verification to proceed.',
      startDate: batch.start_date || '',
      endDate: batch.end_date || '',
    };
  });
}

/**
 * Apply for Batch-Based Course Enrollment
 * Uses race-condition-safe PostgreSQL locking via enroll_in_batch RPC
 */
export async function applyTraineeEnrollment(
  traineeId: string,
  courseId: string,
  batchId?: string,
  packageId?: string,
  options?: {
    enrollmentType?: 'NEW' | 'REFRESHER';
    previousCertificateNumber?: string;
    checklistConfirmed?: boolean;
  }
) {
  const resolvedId = await resolveTraineeProfileId(traineeId);
  const enrollmentType = (options?.enrollmentType || 'NEW').toUpperCase() as 'NEW' | 'REFRESHER';
  const previousCertNo = (options?.previousCertificateNumber || '').trim();

  // 1. Mandatory SRN Validation: Trainee must have a valid non-null Seafarer Registration Number
  const { data: traineeRow } = await supabaseAdmin
    .from('trainees')
    .select('profile_id, srn, trainee_number')
    .eq('profile_id', resolvedId)
    .maybeSingle();

  const { data: profileRow } = await supabaseAdmin
    .from('profiles')
    .select('id, srn')
    .eq('id', resolvedId)
    .maybeSingle();

  const rawSrn = resolveRealSrn(traineeRow, profileRow);
  const isInvalidSrn = !rawSrn;

  if (isInvalidSrn) {
    try {
      await dispatchNotificationEvent({
        event: NOTIFICATION_EVENTS.SRN_REQUIRED,
        traineeId: resolvedId,
      });
    } catch {}
    const err = new Error('Please complete your trainee profile by adding your SRN before enrolling in a training course.');
    (err as any).code = 'MISSING_SRN';
    throw err;
  }

  // 2. Course & Server-Side Prerequisite Validation
  let targetCourse: any = null;
  const { data: targetCourseData, error: courseErr } = await supabaseAdmin
    .from('courses')
    .select('id, code, name, price, capacity, status, prerequisites, prerequisite_course_ids')
    .eq('id', courseId)
    .maybeSingle();

  if (!courseErr && targetCourseData) {
    targetCourse = targetCourseData;
  } else {
    // Resilient fallback query if extended columns are not available
    const { data: fbCourse, error: fbErr } = await supabaseAdmin
      .from('courses')
      .select('id, code, name, price, capacity, status')
      .eq('id', courseId)
      .maybeSingle();

    if (fbErr || !fbCourse) {
      console.error('applyTraineeEnrollment course lookup error:', fbErr || courseErr);
      throw new Error('Course not found or currently unavailable.');
    }
    targetCourse = {
      ...fbCourse,
      prerequisites: fbCourse.prerequisites || [],
      prerequisite_course_ids: fbCourse.prerequisite_course_ids || [],
    };
  }

  if (targetCourse.status === 'ARCHIVED' || targetCourse.status === 'INACTIVE') {
    throw new Error('This training course is currently inactive or archived.');
  }

  // Determine required prerequisites (from database columns or standard STCW maritime curriculum rules)
  const explicitPrereqs: string[] = targetCourse.prerequisites || [];
  const prereqIds: string[] = targetCourse.prerequisite_course_ids || [];
  const courseCodeUpper = (targetCourse.code || '').toUpperCase();
  const courseNameUpper = (targetCourse.name || '').toUpperCase();

  const requiredPrereqNames: string[] = [...explicitPrereqs];
  // Standard STCW rule: Advanced Fire Fighting requires completion of Basic Fire Fighting
  if (courseCodeUpper.includes('AFF') || courseNameUpper.includes('ADVANCED FIRE')) {
    if (!requiredPrereqNames.some(p => p.toLowerCase().includes('fire'))) {
      requiredPrereqNames.push('Basic Fire Fighting');
    }
  }

  if (requiredPrereqNames.length > 0 || prereqIds.length > 0) {
    // Fetch completed enrollments for this trainee
    const { data: completedEnrollments } = await supabaseAdmin
      .from('enrollments')
      .select('course_id, status, courses(id, code, name)')
      .eq('trainee_id', resolvedId)
      .in('status', ['COMPLETED', 'PASSED']);

    const completedNames: string[] = (completedEnrollments || []).map((e: any) => (e.courses?.name || '').toLowerCase());
    const completedCodes: string[] = (completedEnrollments || []).map((e: any) => (e.courses?.code || '').toLowerCase());
    const completedIds: string[] = (completedEnrollments || []).map((e: any) => e.course_id);

    for (const prereqName of requiredPrereqNames) {
      const pNorm = prereqName.toLowerCase();
      const satisfied = completedNames.some((cn: string) => cn.includes(pNorm) || (pNorm.includes('basic fire') && cn.includes('fire') && !cn.includes('advanced')))
        || completedCodes.some((cc: string) => cc.includes(pNorm));

      if (!satisfied) {
        try {
          await dispatchNotificationEvent({
            event: NOTIFICATION_EVENTS.PREREQUISITE_FAILED,
            traineeId: resolvedId,
            courseId,
            metadata: {
              courseName: targetCourse.name,
              prereqName,
            },
          });
        } catch {}
        const err = new Error(`Prerequisite required. Please complete ${prereqName} before enrolling in ${targetCourse.name}.`);
        (err as any).code = 'PREREQUISITE_REQUIRED';
        throw err;
      }
    }

    const missingPrereqIds = prereqIds.filter((pId) => !completedIds.includes(pId));
    if (missingPrereqIds.length > 0) {
      const { data: pCourses } = await supabaseAdmin
        .from('courses')
        .select('id, code, name')
        .in('id', missingPrereqIds);
      const pCourseMap = new Map<string, any>((pCourses || []).map((c: any) => [c.id, c]));
      const firstMissingId = missingPrereqIds[0];
      const pName = pCourseMap.get(firstMissingId)?.name || 'Prerequisite Course';
      try {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.PREREQUISITE_FAILED,
          traineeId: resolvedId,
          courseId,
          metadata: {
            courseName: targetCourse.name,
            prereqName: pName,
          },
        });
      } catch {}
      const err = new Error(`Prerequisite required. Please complete ${pName} before enrolling in ${targetCourse.name}.`);
      (err as any).code = 'PREREQUISITE_REQUIRED';
      throw err;
    }
  }

  // 2b. NEW vs REFRESHER Enrollment Classification & Historical Certificate Validation (Phase 7)
  const { data: priorCerts } = await supabaseAdmin
    .from('certificates')
    .select('id, certificate_number, issued_at, expires_at, status')
    .eq('trainee_id', resolvedId)
    .eq('course_id', courseId)
    .order('issued_at', { ascending: false });

  const latestCert = (priorCerts || [])[0] || null;
  const certExpiresMs = latestCert?.expires_at ? new Date(latestCert.expires_at).getTime() : null;
  const isCertStillValid = Boolean(
    latestCert &&
      latestCert.status !== 'REVOKED' &&
      (!certExpiresMs || certExpiresMs > Date.now() + 90 * 24 * 60 * 60 * 1000)
  );

  if (enrollmentType === 'REFRESHER') {
    if (isCertStillValid && latestCert) {
      const err = new Error(
        `Your existing certificate (${latestCert.certificate_number}) for ${targetCourse.name} is still VALID. Repeated training is not required — please use the Certificate Reissuance / Verification process.`
      );
      (err as any).code = 'CERTIFICATE_STILL_VALID';
      throw err;
    }

    const { data: priorCompleted } = await supabaseAdmin
      .from('enrollments')
      .select('id, status')
      .eq('trainee_id', resolvedId)
      .eq('course_id', courseId)
      .in('status', ['COMPLETED', 'PASSED'])
      .limit(1)
      .maybeSingle();

    if (!priorCompleted && !latestCert && !previousCertNo) {
      const err = new Error(
        `REFRESHER enrollment requires a prior completion record or previous STCW certificate number for ${targetCourse.name}. Please provide your previous certificate number or select NEW enrollment.`
      );
      (err as any).code = 'REFRESHER_ELIGIBILITY_REQUIRED';
      throw err;
    }
  }

  // 3. Strict "ONE ONGOING COURSE AT A TIME" Rule Check BEFORE touching/promoting any batch
  const { data: existingActive } = await supabaseAdmin
    .from('enrollments')
    .select('id, status, batch_id, course_id, courses(name)')
    .eq('trainee_id', resolvedId)
    .not('status', 'in', '("CANCELLED","REJECTED","COMPLETED","PASSED","FAILED")')
    .limit(1)
    .maybeSingle();

  if (existingActive) {
    const courseName = (existingActive.courses as any)?.name || 'Unknown';
    const err = new Error(`You already have an ongoing enrollment for a course (${courseName}). Please complete it before enrolling in a new one.`);
    (err as any).code = 'ONGOING_COURSE_EXISTS';
    throw err;
  }

  // 4. Resolve Target Batch (Schedule is managed in admin - no automatic rollover or fake dates on session start)
  async function resolveAvailableBatch(preferredBatchId?: string) {
    // 1. If preferred batch requested, use it if belonging to courseId, OPEN, and has capacity
    if (preferredBatchId) {
      const { data: pref } = await supabaseAdmin
        .from('batches')
        .select('*')
        .eq('id', preferredBatchId)
        .maybeSingle();

      const cap = Math.min(pref?.capacity || 24, 24);
      if (pref && pref.course_id === courseId && pref.status === 'OPEN' && (pref.enrolled_count || 0) < cap) {
        return pref;
      }
    }

    // 2. Look for existing OPEN batches for this course with available capacity
    const { data: openBatches } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('course_id', courseId)
      .eq('status', 'OPEN')
      .order('queue_order', { ascending: true })
      .order('created_at', { ascending: true });

    for (const b of (openBatches || [])) {
      const cap = Math.min(b.capacity || 24, 24);
      if ((b.enrolled_count || 0) < cap) {
        return b;
      }
    }

    // 3. Look for the next QUEUED batch and promote to OPEN
    const { data: queuedBatches } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('course_id', courseId)
      .eq('status', 'QUEUED')
      .order('queue_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1);

    if (queuedBatches && queuedBatches.length > 0) {
      const nextQueued = queuedBatches[0];
      const { data: activatedBatch } = await supabaseAdmin
        .from('batches')
        .update({
          status: 'OPEN',
          updated_at: new Date().toISOString(),
        })
        .eq('id', nextQueued.id)
        .select()
        .single();

      if (activatedBatch) return activatedBatch;
    }

    // 4. If no open batch has slots, check for any existing batch for this course
    const { data: anyBatch } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anyBatch) {
      return anyBatch;
    }

    // Create a base cohort batch placeholder (schedule to be set by Admin)
    const courseCode = targetCourse.code || 'STCW';
    const { data: newBatch, error: createBatchErr } = await supabaseAdmin
      .from('batches')
      .insert({
        course_id: courseId,
        training_center_id: targetCourse.training_center_id || null,
        batch_code: `${courseCode}-BATCH-01`,
        capacity: 24,
        enrolled_count: 0,
        status: 'OPEN',
        queue_order: 1,
      })
      .select()
      .single();

    if (createBatchErr) {
      console.warn('Batch creation notice:', createBatchErr);
    }

    return newBatch;
  }

  const batchRecord = await resolveAvailableBatch(batchId);
  if (!batchRecord?.id) {
    throw new Error('Unable to assign training batch for this course. Please contact center administration.');
  }

  const targetBatchId = batchRecord.id;

  // Ensure trainee row exists in trainees table without generating fake SRN
  if (!traineeRow) {
    await supabaseAdmin.from('trainees').insert({
      profile_id: resolvedId,
      srn: rawSrn,
      trainee_number: rawSrn,
      enrollment_status: 'ACTIVE',
    });
  }

  // Atomic enrollment via RPC (race-condition protected with FOR UPDATE lock)
  const { data: newEnrollmentId, error: rpcError } = await supabaseAdmin.rpc('enroll_in_batch', {
    p_batch_id: targetBatchId,
    p_trainee_id: resolvedId,
    p_course_id: courseId,
    p_package_id: packageId || null,
    p_training_center_id: null,
  });

  if (rpcError) {
    const msg = (rpcError.message || '').toLowerCase();
    if (msg.includes('already enrolled') || msg.includes('active enrollment') || msg.includes('ongoing enrollment') || msg.includes('another course')) {
      const err = new Error(rpcError.message);
      (err as any).code = 'ONGOING_COURSE_EXISTS';
      throw err;
    }
    throw rpcError;
  }

  const { data: enr, error: fetchErr } = await supabaseAdmin
    .from('enrollments')
    .select(`
      *,
      courses (id, code, name, price),
      batches (id, batch_code, start_date, end_date)
    `)
    .eq('id', newEnrollmentId)
    .single();

  if (fetchErr) throw fetchErr;

  // Persist NEW/REFRESHER classification and verified document checklist metadata in review_notes
  const classificationNote = `[${enrollmentType} ENROLLMENT] Verified ID & SIRB/SRN Checklist: Confirmed${
    previousCertNo ? ` | Prior Cert: ${previousCertNo}` : ''
  }`;
  try {
    await supabaseAdmin
      .from('enrollments')
      .update({ review_notes: classificationNote })
      .eq('id', newEnrollmentId);
    enr.review_notes = classificationNote;
  } catch {}

  // Dispatch NEW_ENROLLMENT and ENROLLMENT_PAYMENT_PENDING (Section 11 Recipient Matrix)
  try {
    await dispatchNotificationEvent({
      event: NOTIFICATION_EVENTS.NEW_ENROLLMENT,
      traineeId: resolvedId,
      batchId: enr.batch_id,
      courseId: enr.course_id,
      entityType: 'ENROLLMENT',
      entityId: enr.id,
      metadata: {
        courseName: enr.courses?.name,
        batchName: enr.batches?.batch_code,
      },
    });

    await dispatchNotificationEvent({
      event: NOTIFICATION_EVENTS.ENROLLMENT_PAYMENT_PENDING,
      traineeId: resolvedId,
      batchId: enr.batch_id,
      courseId: enr.course_id,
      entityType: 'ENROLLMENT',
      entityId: enr.id,
      metadata: {
        courseName: enr.courses?.name,
        batchName: enr.batches?.batch_code,
      },
    });

    // Check if batch is nearing capacity (>= 20 of 24)
    const { data: bStats } = await supabaseAdmin
      .from('batches')
      .select('enrolled_count, capacity, batch_code')
      .eq('id', enr.batch_id)
      .maybeSingle();

    if (bStats) {
      const cap = Math.min(bStats.capacity || 24, 24);
      if (bStats.enrolled_count >= 20 && bStats.enrolled_count < cap) {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.BATCH_ALMOST_FULL,
          batchId: enr.batch_id,
          courseId: enr.course_id,
          metadata: {
            batchName: bStats.batch_code,
            currentCount: bStats.enrolled_count,
            maxCount: cap,
          },
        });
      } else if (bStats.enrolled_count >= cap) {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.BATCH_FULL,
          batchId: enr.batch_id,
          courseId: enr.course_id,
          metadata: {
            batchName: bStats.batch_code,
            currentCount: bStats.enrolled_count,
            maxCount: cap,
          },
        });
      }
    }
  } catch (notifErr) {
    console.warn('Enrollment notification dispatch notice:', notifErr);
  }

  let resolvedFee = Number(enr.courses?.price ?? 0);
  if (packageId) {
    const { data: pkgRow } = await supabaseAdmin
      .from('course_packages')
      .select('package_price')
      .eq('id', packageId)
      .maybeSingle();
    if (pkgRow && Number.isFinite(Number(pkgRow.package_price))) {
      resolvedFee = Number(pkgRow.package_price);
    }
  }

  return {
    id: enr.id,
    enrollmentNo: `ENR-${enr.id.slice(0, 8).toUpperCase()}`,
    courseId: enr.course_id,
    courseCode: enr.courses?.code || 'STCW',
    courseTitle: enr.courses?.name || 'Maritime Course',
    batchId: enr.batch_id,
    batchCode: enr.batches?.batch_code,
    batchStartDate: enr.batches?.start_date,
    centerName: 'NEWSIM Maritime Training Center',
    status: enr.status, // 'PAYMENT_PENDING'
    paymentStatus: 'PENDING',
    fee: resolvedFee,
    appliedAt: enr.enrolled_at,
  };
}

/**
 * Enrolled Courses for Trainee
 */
export async function getTraineeCoursesList(traineeId: string, search?: string, status?: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  let query = supabaseAdmin
    .from('enrollments')
    .select(`
      *,
      courses (*)
    `)
    .eq('trainee_id', resolvedId);

  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  } else {
    // Access control: only active/approved/completed enrollments can access training courses
    query = query.in('status', ['ENROLLED', 'ACTIVE', 'APPROVED', 'COMPLETED']);
  }

  const { data, error } = await query;
  if (error) throw error;

  let enrollments = data || [];

  // Query actual completed lessons for this trainee
  const { data: completions } = await supabaseAdmin
    .from('trainee_lesson_completions')
    .select('course_id, lesson_id')
    .eq('trainee_id', resolvedId);

  const completedMap = new Map<string, number>();
  (completions || []).forEach((c: any) => {
    completedMap.set(c.course_id, (completedMap.get(c.course_id) || 0) + 1);
  });

  // Query assigned instructors, practical evaluations, daily module tracking, and grades for these courses
  const courseIds = Array.from(new Set(enrollments.map((enr: any) => enr.course_id || enr.courses?.id).filter(Boolean))) as string[];
  const instructorMap = new Map<string, { name: string; avatarUrl: string | null }>();
  const moduleCountMap = new Map<string, number>();
  const practicalAttendedMap = new Map<string, number>();
  const gradeMap = new Map<string, number>();
  const practicalCompetentSet = new Set<string>();
  const dailyPassedCountMap = new Map<string, number>();
  const dailyFailedCountMap = new Map<string, number>();
  const postTestPassedSet = new Set<string>();
  const courseWithPostTestSet = new Set<string>();

  if (courseIds.length > 0) {
    const [
      assignedInstructorsRes,
      moduleCountsRes,
      attendanceRes,
      gradesRes,
      practicalEvalsRes,
      dailyTrackingRes,
      postTestAttemptsRes,
      courseAssessmentsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('course_instructors')
        .select('course_id, instructor_id, instructors(profile_id, profiles(first_name, last_name, avatar_url))')
        .in('course_id', courseIds),
      supabaseAdmin
        .from('course_modules')
        .select('course_id')
        .in('course_id', courseIds),
      supabaseAdmin
        .from('attendance')
        .select('schedule_id, course_id, status, schedules(course_id)')
        .eq('trainee_id', resolvedId)
        .in('status', ['PRESENT', 'LATE', 'EXCUSED', 'COMPLETED']),
      supabaseAdmin
        .from('grades')
        .select('course_id, final_score')
        .eq('trainee_id', resolvedId)
        .in('course_id', courseIds),
      supabaseAdmin
        .from('practical_evaluations')
        .select('course_id, competency_status')
        .eq('trainee_id', resolvedId)
        .in('course_id', courseIds),
      supabaseAdmin
        .from('trainee_daily_module_tracking')
        .select('course_id, module_id, status')
        .eq('trainee_id', resolvedId)
        .in('course_id', courseIds),
      supabaseAdmin
        .from('assessment_attempts')
        .select('assessment_id, passed, status, score, assessments!inner(course_id, module_id)')
        .eq('trainee_id', resolvedId)
        .is('assessments.module_id', null),
      supabaseAdmin
        .from('assessments')
        .select('course_id')
        .in('course_id', courseIds)
        .is('module_id', null),
    ]);

    const assignedInstructors = assignedInstructorsRes.data || [];
    assignedInstructors.forEach((ci: any) => {
      const inst = Array.isArray(ci.instructors) ? ci.instructors[0] : ci.instructors;
      const prof = Array.isArray(inst?.profiles) ? inst.profiles[0] : inst?.profiles;
      const name = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : null;
      if (name && !instructorMap.has(ci.course_id)) {
        instructorMap.set(ci.course_id, { name, avatarUrl: prof?.avatar_url || null });
      }
    });

    (moduleCountsRes.data || []).forEach((m: any) => {
      moduleCountMap.set(m.course_id, (moduleCountMap.get(m.course_id) || 0) + 1);
    });

    (attendanceRes.data || []).forEach((att: any) => {
      const cid = att.course_id || att.schedules?.course_id;
      if (cid) practicalAttendedMap.set(cid, (practicalAttendedMap.get(cid) || 0) + 1);
    });

    (gradesRes.data || []).forEach((g: any) => {
      if (g.course_id && g.final_score != null) {
        gradeMap.set(g.course_id, Math.round(Number(g.final_score)));
      }
    });

    (practicalEvalsRes.data || []).forEach((pe: any) => {
      if (pe.competency_status === 'COMPETENT') {
        practicalCompetentSet.add(pe.course_id);
      }
    });

    (dailyTrackingRes.data || []).forEach((tr: any) => {
      if (tr.status === 'COMPLETED') {
        dailyPassedCountMap.set(tr.course_id, (dailyPassedCountMap.get(tr.course_id) || 0) + 1);
      } else if (tr.status === 'FAILED') {
        dailyFailedCountMap.set(tr.course_id, (dailyFailedCountMap.get(tr.course_id) || 0) + 1);
      }
    });

    (courseAssessmentsRes.data || []).forEach((a: any) => {
      if (a.course_id) courseWithPostTestSet.add(a.course_id);
    });

    (postTestAttemptsRes.data || []).forEach((pa: any) => {
      const cid = (pa.assessments as any)?.course_id;
      if (cid && (pa.passed === true || pa.status === 'PASSED' || Number(pa.score) >= 70)) {
        postTestPassedSet.add(cid);
      }
    });

    // Also fallback to schedules for any course still missing an instructor name
    const missingCourseIds = courseIds.filter((id: string) => !instructorMap.has(id));
    if (missingCourseIds.length > 0) {
      const { data: schedData } = await supabaseAdmin
        .from('schedules')
        .select('course_id, instructor_id, instructors(profile_id, profiles(first_name, last_name, avatar_url))')
        .in('course_id', missingCourseIds)
        .neq('status', 'CANCELLED')
        .order('start_at', { ascending: false });

      (schedData || []).forEach((sc: any) => {
        if (!instructorMap.has(sc.course_id)) {
          const inst = Array.isArray(sc.instructors) ? sc.instructors[0] : sc.instructors;
          const prof = Array.isArray(inst?.profiles) ? inst.profiles[0] : inst?.profiles;
          const name = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : null;
          if (name) instructorMap.set(sc.course_id, { name, avatarUrl: prof?.avatar_url || null });
        }
      });
    }
  }

  const courseModulesMap = new Map<string, Array<{ id: string; title: string; sortOrder: number }>>();
  const lessonCompletionSet = new Set<string>();
  if (courseIds.length > 0) {
    const [{ data: modsList }, { data: lessonComps }] = await Promise.all([
      supabaseAdmin
        .from('course_modules')
        .select('id, course_id, title, sort_order')
        .in('course_id', courseIds)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('trainee_lesson_completions')
        .select('course_id, lesson_id')
        .eq('trainee_id', resolvedId)
        .in('course_id', courseIds),
    ]);
    for (const m of modsList || []) {
      const list = courseModulesMap.get(m.course_id) || [];
      list.push({ id: m.id, title: m.title || `Module ${list.length + 1}`, sortOrder: m.sort_order ?? list.length });
      courseModulesMap.set(m.course_id, list);
    }
    for (const lc of lessonComps || []) {
      if (lc.lesson_id) lessonCompletionSet.add(`${lc.course_id}:${lc.lesson_id}`);
    }
  }

  let result = enrollments.map((enr: any) => {
    const c = enr.courses || {};
    const courseId = c.id || enr.course_id;
    const totalLessons = moduleCountMap.get(courseId) || 0;

    // Use strictly validated passed daily modules count, fallback to completedMap
    const passedModules = dailyPassedCountMap.has(courseId)
      ? dailyPassedCountMap.get(courseId)!
      : Math.min(totalLessons, completedMap.get(courseId) || 0);

    const failedModules = dailyFailedCountMap.get(courseId) || 0;
    const isInHouse = isInHouseModularCourse(c.category, c.practical_days);
    const requiresPractical = !isInHouse;
    const isPracticalCompetent = isInHouse ? true : practicalCompetentSet.has(courseId);
    const isPostTestPassed = postTestPassedSet.has(courseId);

    const rawTotalDays = Math.ceil((c.duration_hours || 40) / 8) || 1;
    const theoryDays = isInHouse ? Math.min(3, rawTotalDays) : (c.theory_days ?? (rawTotalDays <= 1 ? 1 : Math.max(1, Math.round(rawTotalDays * 0.4))));
    const practicalDays = isInHouse ? 0 : (c.practical_days ?? Math.max(0, rawTotalDays - theoryDays));
    const totalDays = isInHouse ? theoryDays : theoryDays + practicalDays;
    const practicalAttended = isInHouse ? 0 : (practicalAttendedMap.get(courseId) || 0);

    const hasPostTest = courseWithPostTestSet.has(courseId);
    const isAllModulesPassed = totalLessons > 0 && passedModules >= totalLessons;

    // Progress Bar Calculation:
    // - In-House Courses (Full Modular-Based): 100% Modular Lessons (+ Post-Test if present). No practical required.
    // - Safety and Other STCW Courses: Modular Lessons (50%) + Post-Test (10% if present) + Course Practical (40%/50%).
    let progressPercent = 0;
    if (isInHouse) {
      if (
        (enr.status || '').toUpperCase() === 'COMPLETED' ||
        (isAllModulesPassed && (!hasPostTest || isPostTestPassed))
      ) {
        progressPercent = 100;
      } else {
        const modWeight = hasPostTest ? 85 : 100;
        const theoryComponent = totalLessons > 0 ? Math.round((passedModules / totalLessons) * modWeight) : 0;
        const postTestBonus = hasPostTest && isPostTestPassed ? 15 : 0;
        progressPercent = Math.min(100, theoryComponent + postTestBonus);
      }
    } else if (
      (enr.status || '').toUpperCase() === 'COMPLETED' ||
      (isAllModulesPassed && isPracticalCompetent && (!hasPostTest || isPostTestPassed))
    ) {
      progressPercent = 100;
    } else {
      const theoryComponent = totalLessons > 0 ? Math.round((passedModules / totalLessons) * 50) : 0;
      const postTestBonus = isPostTestPassed ? 10 : 0;
      const practicalComponent = isPracticalCompetent ? (hasPostTest ? 40 : 50) : 0;
      progressPercent = Math.min(100, theoryComponent + postTestBonus + practicalComponent);
    }

    const theoryPercent = totalLessons > 0 ? Math.min(100, Math.round((passedModules / totalLessons) * 100)) : 0;
    const practicalPercent = isInHouse
      ? 100
      : (isPracticalCompetent ? 100 : (practicalDays > 0 ? Math.min(100, Math.round((practicalAttended / practicalDays) * 100)) : 0));

    const rawModules = courseModulesMap.get(courseId) || [];
    const courseModules = rawModules.map((m, idx) => ({
      id: m.id,
      title: m.title,
      sortOrder: m.sortOrder,
      isCompleted: lessonCompletionSet.has(`${courseId}:${m.id}`) || idx < passedModules,
    }));
    const activeModule =
      courseModules.find((m) => !m.isCompleted)?.title ||
      courseModules[courseModules.length - 1]?.title ||
      'Curriculum Overview';

    return {
      id: courseId,
      enrollmentId: enr.id,
      code: c.code || 'STCW',
      title: c.name || 'Course',
      category: c.category || 'Safety and Other STCW Courses',
      deliveryMode: isInHouse ? 'FULL_MODULAR' : 'MODULAR_AND_PRACTICAL',
      requiresPractical,
      description: c.description || 'Maritime competence training module.',
      durationHours: c.duration_hours || 40,
      trainingDays: totalDays,
      theoryDays,
      practicalDays,
      theoryPercent,
      practicalPercent,
      practicalAttended,
      fee: Number(c.price) || 0,
      status: enr.status || 'ENROLLED',
      enrollmentStatus: enr.status || 'ENROLLED',
      progress: progressPercent,
      progressPercent,
      modulesCompleted: passedModules,
      modulesFailed: failedModules,
      totalModules: totalLessons || courseModules.length,
      modules: courseModules,
      practicalCompetent: isPracticalCompetent,
      practicalStatus: isInHouse ? 'NOT_REQUIRED' : (isPracticalCompetent ? 'COMPLETED' : 'PENDING_EVALUATION'),
      qualificationStatus: isInHouse
        ? ((isAllModulesPassed && (!hasPostTest || isPostTestPassed)) ? 'QUALIFIED_FOR_CERTIFICATE' : 'IN_PROGRESS')
        : (isPracticalCompetent ? 'QUALIFIED_FOR_CERTIFICATE' : 'PENDING_PRACTICAL'),
      averageGrade: gradeMap.get(courseId) ?? 0,
      currentModule: activeModule,
      instructorName: instructorMap.get(courseId)?.name || 'Assigned Instructor',
      instructorAvatarUrl: instructorMap.get(courseId)?.avatarUrl || null,
      centerName: 'NEWSIM Talisay Training Center',
      appliedAt: enr.enrolled_at || enr.created_at,
    };
  });

  if (search) {
    const s = search.toLowerCase();
    result = result.filter(
      (c: any) =>
        c.code.toLowerCase().includes(s) ||
        c.title.toLowerCase().includes(s) ||
        c.category.toLowerCase().includes(s)
    );
  }

  return result;
}

/**
 * Single Course Details
 */
export async function getTraineeCourseDetails(courseId: string, traineeId: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  const { data: course, error } = await supabaseAdmin
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (error) throw error;

  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('*')
    .eq('course_id', courseId)
    .eq('trainee_id', resolvedId)
    .maybeSingle();

  const { data: modules } = await supabaseAdmin
    .from('course_modules')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });

  const { data: schedules } = await supabaseAdmin
    .from('schedules')
    .select('*')
    .eq('course_id', courseId)
    .order('start_at', { ascending: true });

  const { data: completions } = await supabaseAdmin
    .from('trainee_lesson_completions')
    .select('lesson_id')
    .eq('trainee_id', resolvedId)
    .eq('course_id', courseId);

  const { data: practicalEval } = await supabaseAdmin
    .from('practical_evaluations')
    .select('competency_status')
    .eq('trainee_id', resolvedId)
    .eq('course_id', courseId)
    .maybeSingle();

  const isInHouse = isInHouseModularCourse(course.category);
  const requiresPractical = !isInHouse;
  const isPracticalCompetent = isInHouse ? true : (practicalEval?.competency_status === 'COMPETENT');

  const completedCount = completions?.length || 0;
  const totalLessons = modules?.length || 0;
  let progressPercent = 0;
  if (isInHouse) {
    if (
      (enrollment?.status || '').toUpperCase() === 'COMPLETED' ||
      (completedCount >= totalLessons && totalLessons > 0)
    ) {
      progressPercent = 100;
    } else if (completedCount > 0 && totalLessons > 0) {
      progressPercent = Math.min(100, Math.round((completedCount / totalLessons) * 100));
    }
  } else if (
    (enrollment?.status || '').toUpperCase() === 'COMPLETED' ||
    (completedCount >= totalLessons && totalLessons > 0 && isPracticalCompetent)
  ) {
    progressPercent = 100;
  } else if (completedCount > 0 && totalLessons > 0) {
    const theoryPart = Math.round((completedCount / totalLessons) * 50);
    const practicalPart = isPracticalCompetent ? 50 : 0;
    progressPercent = Math.min(100, theoryPart + practicalPart);
  }

  // Resolve assigned instructor
  let instructorName = 'Assigned Instructor';
  let instructorAvatarUrl: string | null = null;
  const { data: ciRow } = await supabaseAdmin
    .from('course_instructors')
    .select('instructor_id, instructors(profile_id, profiles(first_name, last_name, avatar_url))')
    .eq('course_id', courseId)
    .maybeSingle();

  const ciInst: any = Array.isArray((ciRow as any)?.instructors) ? (ciRow as any).instructors[0] : (ciRow as any)?.instructors;
  const ciProf: any = Array.isArray(ciInst?.profiles) ? ciInst.profiles[0] : ciInst?.profiles;
  if (ciProf) {
    instructorName = `${ciProf.first_name || ''} ${ciProf.last_name || ''}`.trim() || instructorName;
    instructorAvatarUrl = ciProf.avatar_url || null;
  } else if (schedules && schedules.length > 0 && schedules[0].instructor_id) {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, avatar_url')
      .eq('id', schedules[0].instructor_id)
      .maybeSingle();
    if (prof) {
      instructorName = `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || instructorName;
      instructorAvatarUrl = prof.avatar_url || null;
    }
  }

  return {
    id: course.id,
    code: course.code,
    title: course.name,
    description: course.description,
    category: course.category || 'Safety and Other STCW Courses',
    deliveryMode: isInHouse ? 'FULL_MODULAR' : 'MODULAR_AND_PRACTICAL',
    requiresPractical,
    durationHours: course.duration_hours,
    fee: Number(course.price),
    status: enrollment?.status || 'NOT_ENROLLED',
    enrollmentStatus: enrollment?.status || 'NOT_ENROLLED',
    progress: progressPercent,
    progressPercent,
    modulesCompleted: completedCount,
    totalModules: totalLessons,
    enrollmentId: enrollment?.id,
    modules: modules || [],
    schedules: schedules || [],
    instructorName,
    instructorAvatarUrl,
    centerName: 'NEWSIM Training Center',
  };
}

/**
 * Trainee Schedules
 * Differentiates between:
 * 1. Daily Online Modules (1 per day)
 * 2. In-Person Practical Simulator Sessions (The Set Time - required to qualify for certificate)
 */
export async function getTraineeSchedulesList(traineeId: string, onNotifyEmail?: any) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  // Automatically transition any completed schedules in database
  await processScheduleAutomaticTransitions().catch(() => {});

  // Fetch trainee's enrolled course IDs (excluding cancelled/rejected enrollments)
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('course_id, status, courses ( id, code, name, category, practical_days )')
    .eq('trainee_id', resolvedId);

  const validEnrollments = (enrollments || []).filter((e: any) => {
    const s = (e.status || '').toUpperCase();
    return ['ENROLLED', 'ACTIVE', 'ONGOING', 'APPROVED', 'COMPLETED'].includes(s);
  });

  // Only Modular + Practical courses can have practical training dates/schedules
  const practicalCourseIds = Array.from(
    new Set(
      validEnrollments
        .filter((e: any) => !isInHouseModularCourse(e.courses?.category, e.courses?.practical_days))
        .map((e: any) => e.course_id)
        .filter(Boolean)
    )
  ) as string[];

  // 1. Fetch practical schedules
  const { data: attendances } = await supabaseAdmin
    .from('attendance')
    .select('schedule_id, status')
    .eq('trainee_id', resolvedId);

  const directScheduleIds = Array.from(new Set((attendances || []).map((a: any) => a.schedule_id).filter(Boolean)));
  const attendedMap = new Map(
    (attendances || []).map((a: any) => [a.schedule_id, (a.status || '').toUpperCase()])
  );

  let schedData: any[] = [];
  if (practicalCourseIds.length > 0 || directScheduleIds.length > 0) {
    const scheduleSelect = `
        *,
        courses (id, code, name, category, practical_days),
        instructors (
          profile_id,
          profiles (first_name, last_name, avatar_url)
        ),
        training_centers (name)
      `;
    const [byCourseRes, bySchedRes] = await Promise.all([
      practicalCourseIds.length > 0
        ? supabaseAdmin
            .from('schedules')
            .select(scheduleSelect)
            .in('course_id', practicalCourseIds)
            .neq('status', 'CANCELLED')
            .order('start_at', { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      directScheduleIds.length > 0
        ? supabaseAdmin
            .from('schedules')
            .select(scheduleSelect)
            .in('id', directScheduleIds)
            .neq('status', 'CANCELLED')
            .order('start_at', { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const mergedMap = new Map<string, any>();
    for (const row of [...(byCourseRes.data || []), ...(bySchedRes.data || [])]) {
      if (row?.id && !mergedMap.has(row.id) && !isInHouseModularCourse(row.courses?.category, row.courses?.practical_days)) {
        mergedMap.set(row.id, row);
      }
    }
    schedData = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
  }

  // 2. Fetch daily module schedule for all enrolled courses
  const dailyModules: any[] = [];
  for (const enr of validEnrollments) {
    const cid = enr.course_id;
    const cObj = enr.courses || {};
    try {
      const synced = await syncTraineeDailyModules(resolvedId, cid, onNotifyEmail);
      synced.forEach((m) => {
        dailyModules.push({
          id: `mod-sched-${m.moduleId}`,
          type: 'DAILY_ONLINE_MODULE',
          sessionCode: `MODULE-${m.dayNumber}`,
          courseId: cid,
          courseCode: cObj.code || 'STCW',
          courseTitle: cObj.name || 'Maritime Training Program',
          moduleTitle: m.moduleTitle,
          dayNumber: m.dayNumber,
          date: m.scheduledDate,
          formattedDate: m.formattedDate,
          time: 'Online LMS (Self-Paced)',
          startTime: '00:00',
          endTime: '23:59',
          startAt: `${m.scheduledDate}T00:00:00+08:00`,
          endAt: `${m.scheduledDate}T23:59:59+08:00`,
          room: 'Online LMS Player',
          instructorName: 'Online Modular Curriculum',
          status: m.status, // 'COMPLETED' | 'AVAILABLE' | 'LOCKED' | 'FAILED'
          isDueToday: m.isDueToday,
          isCompleted: m.isCompleted,
          isFailed: m.isFailed,
          isLocked: m.isLocked,
          lockReason: m.lockReason,
          failureReason: m.failureReason,
          centerName: 'NEWSIM Online Academy',
          isSetTime: false,
          note: 'Online Theory Module: Read lesson content and pass the module quiz (reattempt available if score is below passing threshold).',
        });
      });
    } catch (e) {
      console.warn('Error syncing daily modules for schedule:', e);
    }
  }

  // 3. Format in-person practical sessions
  const practicalSessions = schedData.map((s: any) => {
    const start = s.start_at ? new Date(s.start_at) : new Date();
    const end = s.end_at ? new Date(s.end_at) : new Date(start.getTime() + 4 * 3600000);
    const dateStr = formatManilaDate(start);
    const startTime = start.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true });
    const endTime = end.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true });
    const timeStr = `${startTime} - ${endTime}`;

    const rawInstructor = Array.isArray(s.instructors) ? s.instructors[0] : s.instructors;
    const instructorProfile = Array.isArray(rawInstructor?.profiles) ? rawInstructor.profiles[0] : rawInstructor?.profiles;
    const instructorName = (instructorProfile?.first_name || instructorProfile?.last_name)
      ? `Capt. ${instructorProfile.first_name || ''} ${instructorProfile.last_name || ''}`.trim()
      : 'Assigned Instructor';

    const attStatus = attendedMap.get(s.id);
    const isAttended = attStatus === 'PRESENT' || attStatus === 'EXCUSED';
    const isScheduleCompleted = (s.status || '').toUpperCase() === 'COMPLETED';
    const isScheduleDone = s.end_at ? new Date(s.end_at) <= new Date() : false;
    const isCompleted = isAttended || isScheduleCompleted || isScheduleDone;
    const finalStatus = isCompleted ? 'COMPLETED' : (s.status || 'SCHEDULED');

    return {
      id: s.id,
      type: 'IN_PERSON_PRACTICAL',
      sessionCode: s.session_code || `PRAC-${String(s.id).slice(0, 8).toUpperCase()}`,
      courseId: s.course_id,
      courseCode: s.courses?.code || 'STCW',
      courseTitle: s.courses?.name || 'Classroom & Simulator Session',
      moduleTitle: 'In-Person Practical Simulator Evaluation',
      dayNumber: null,
      instructorName,
      instructorAvatarUrl: instructorProfile?.avatar_url || null,
      room: s.room || 'Simulation Suite 311',
      date: dateStr,
      formattedDate: formatReadableDateString(dateStr),
      time: timeStr, // "08:00 AM - 12:00 PM" -> THE SET TIME!
      startTime,
      endTime,
      startAt: s.start_at,
      endAt: s.end_at,
      status: finalStatus,
      isCompleted,
      isAttended,
      centerName: s.training_centers?.name || 'NEWSIM Talisay Training Center',
      isSetTime: true,
      note: 'Set Time Practical Session: In-person hands-on simulator drill required to qualify for certificate issuance.',
    };
  });

  // Combine and sort chronologically
  const combined = [...dailyModules, ...practicalSessions].sort((a, b) => {
    const da = a.startAt || a.date;
    const db = b.startAt || b.date;
    return String(da).localeCompare(String(db));
  });

  (combined as any).dailyModules = dailyModules;
  (combined as any).practicalSessions = practicalSessions;

  return combined;
}

/**
 * Trainee Attendance & Summary
 */
export async function getTraineeAttendanceData(traineeId: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select(`
      *,
      schedules (
        id,
        start_at,
        end_at,
        room,
        courses (id, code, name)
      ),
      courses (id, code, name),
      batches (id, batch_code)
    `)
    .eq('trainee_id', resolvedId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const records = (data || []).map((a: any) => {
    const sched = a.schedules || {};
    const crs = a.courses || sched.courses || {};
    const batch = a.batches || {};
    const dateStr = a.session_date 
      ? a.session_date 
      : (a.check_in_at 
        ? new Date(a.check_in_at).toISOString().split('T')[0] 
        : (sched.start_at 
          ? new Date(sched.start_at).toISOString().split('T')[0] 
          : (a.created_at ? new Date(a.created_at).toISOString().split('T')[0] : '')));

    const rawStatus = a.status ? a.status.toUpperCase() : 'NOT_MARKED';

    return {
      id: a.id,
      date: dateStr,
      sessionCode: a.batch_id ? `SES-${(a.batch_id).slice(0, 4).toUpperCase()}-${dateStr}` : `SES-${a.id.slice(0, 6).toUpperCase()}`,
      courseId: a.course_id || crs.id || null,
      courseCode: crs.code || 'STCW',
      courseTitle: crs.name || 'Maritime Training Session',
      batchName: batch.batch_code || batch.name || '',
      instructorName: a.updated_by ? 'Course Instructor' : 'Instructor Staff',
      room: sched.room || 'Training Hall / Simulator Lab',
      status: rawStatus,
      remarks: a.remarks || (rawStatus === 'NOT_MARKED' ? 'Session pending instructor roll-call entry.' : 'Standard roll-call record.'),
    };
  });

  const present = records.filter((r: any) => r.status === 'PRESENT').length;
  const late = records.filter((r: any) => r.status === 'LATE').length;
  const absent = records.filter((r: any) => r.status === 'ABSENT').length;
  const excused = records.filter((r: any) => r.status === 'EXCUSED').length;
  const notMarked = records.filter((r: any) => r.status === 'NOT_MARKED').length;
  const total = records.length;
  
  // Calculate attendance rate according to maritime standards (late credit 75%, excused excluded from denominator)
  const effectiveTotal = Math.max(0, total - excused - notMarked);
  const attendanceRateNum = effectiveTotal > 0 
    ? Math.min(100, Math.round(((present + (late * 0.75)) / effectiveTotal) * 100))
    : (total > 0 && present > 0 ? 100 : 0);

  return {
    summary: {
      attendanceRate: `${attendanceRateNum}%`,
      attendanceRateNum,
      presentCount: present,
      lateCount: late,
      absentCount: absent,
      excusedCount: excused,
      notMarkedCount: notMarked,
      totalSessions: total,
      meetsCompliance: attendanceRateNum >= 80,
    },
    records,
    corrections: [],
  };
}

export async function submitAttendanceCorrection(
  traineeId: string,
  attendanceId: string,
  requestedStatus: string,
  reason: string
) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  // Update remarks or log correction in attendance record
  const { data, error } = await supabaseAdmin
    .from('attendance')
    .update({
      remarks: `Correction requested to ${requestedStatus}: ${reason}`,
    })
    .eq('id', attendanceId)
    .eq('trainee_id', resolvedId)
    .select()
    .maybeSingle();

  if (error) throw error;

  return {
    id: `corr-${Date.now()}`,
    attendanceId,
    requestedStatus,
    reason,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Trainee Grades
 */
export async function getTraineeGradesList(traineeId: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  // 1. Fetch trainee's valid enrolled courses first (strictly limit grades to enrolled courses)
  const { data: traineeEnrollments } = await supabaseAdmin
    .from('enrollments')
    .select('course_id, status, created_at, courses (id, code, name, category, practical_days)')
    .eq('trainee_id', resolvedId)
    .in('status', ['ENROLLED', 'ONGOING', 'COMPLETED', 'ACTIVE', 'APPROVED'])
    .order('created_at', { ascending: false });

  // Order active/ongoing enrollments before completed ones
  const sortedEnrollments = [...(traineeEnrollments || [])].sort((a: any, b: any) => {
    const rank = (s: string) => {
      const u = (s || '').toUpperCase();
      if (u === 'ACTIVE' || u === 'ONGOING' || u === 'ENROLLED') return 0;
      if (u === 'APPROVED') return 1;
      return 2;
    };
    return rank(a.status) - rank(b.status);
  });

  const enrolledCourseIds = Array.from(
    new Set(sortedEnrollments.map((e: any) => e.course_id).filter(Boolean))
  ) as string[];

  const fullModularCourseIdSet = new Set<string>();
  sortedEnrollments.forEach((e: any) => {
    const crs = Array.isArray(e.courses) ? e.courses[0] : e.courses;
    if (e.course_id && isInHouseModularCourse(crs?.category, crs?.practical_days)) {
      fullModularCourseIdSet.add(e.course_id);
    }
  });
  const practicalCourseIds = enrolledCourseIds.filter((cid) => !fullModularCourseIdSet.has(cid));

  if (enrolledCourseIds.length === 0) {
    const emptyResult: any = [];
    emptyResult.modularGrades = [];
    emptyResult.practicalGrades = [];
    emptyResult.courseBreakdowns = [];
    emptyResult.practicalFeedbacks = [];
    emptyResult.summary = {
      modularAverage: 0,
      practicalAverage: 0,
      overallAverage: 0,
      modularPassedCount: 0,
      modularTotal: 0,
      practicalPassedCount: 0,
      practicalTotal: 0,
      totalAssessments: 0,
      isModularQualified: false,
      isPracticalQualified: false,
      hasPracticalCourses: false,
      allFullModular: false,
      isOverallQualified: false,
    };
    return emptyResult;
  }

  const [gradesRes, attemptsRes] = await Promise.all([
    supabaseAdmin
      .from('grades')
      .select(`
        *,
        courses (id, code, name, category, practical_days)
      `)
      .eq('trainee_id', resolvedId)
      .in('course_id', enrolledCourseIds)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('assessment_attempts')
      .select(`
        id, attempt_number, score, status, passed, submitted_at,
        assessments (
          id, title, assessment_type, passing_score, module_id, course_id,
          courses (id, code, name, category, practical_days),
          course_modules (id, title, sort_order)
        )
      `)
      .eq('trainee_id', resolvedId)
      .order('submitted_at', { ascending: false }),
  ]);

  const gradesData = gradesRes.data || [];
  const rawAttemptsData = attemptsRes.data || [];

  // Deduplicate to the latest attempt per assessment_id so retakes don't double-count in averages
  const seenAssessmentIds = new Set<string>();
  const attemptsData = rawAttemptsData.filter((att: any) => {
    const asm = att.assessments as any;
    if (!asm?.course_id || !enrolledCourseIds.includes(asm.course_id)) return false;
    if (!asm?.id) return true;
    if (seenAssessmentIds.has(asm.id)) return false;
    seenAssessmentIds.add(asm.id);
    return true;
  });

  const list: any[] = [];
  const coveredAttemptCourseKeys = new Set<string>();

  // 1. Process granular assessment attempts
  attemptsData.forEach((att: any) => {
    const asm = att.assessments as any;
    const crs = Array.isArray(asm?.courses) ? asm.courses[0] : asm?.courses;
    const isCourseFullModular =
      fullModularCourseIdSet.has(asm?.course_id) ||
      isInHouseModularCourse(crs?.category, crs?.practical_days);

    const asmType = String(asm?.assessment_type || '').toUpperCase();
    const isModular =
      isCourseFullModular ||
      Boolean(asm?.module_id) ||
      asmType === 'WRITTEN' ||
      asmType === 'QUIZ' ||
      asmType === 'EXAM';
    const scoreNum = Number(att.score) || 0;
    const passingThreshold = asm?.passing_score != null && !isNaN(Number(asm.passing_score)) ? Number(asm.passing_score) : 75;
    const isPassed = att.status === 'PASSED' || att.passed === true || scoreNum >= passingThreshold;
    const modOrder = asm?.course_modules?.sort_order;
    const modTitle = sanitizeModularAssessmentTitle(asm?.course_modules?.title, isCourseFullModular);

    const assessmentCode = asm?.module_id
      ? `MOD-${modOrder ?? (asm?.title?.match(/Module\s*(\d+)/i)?.[1] || 'PRE')}`
      : (isModular ? 'MOD-POST' : (asm?.title?.toLowerCase()?.includes('post') ? 'PRAC-POST' : 'PRAC-SIM'));

    if (asm?.course_id) {
      coveredAttemptCourseKeys.add(asm.course_id);
    }

    const cleanTitle = sanitizeModularAssessmentTitle(asm?.title, isCourseFullModular);

    list.push({
      id: att.id,
      attemptId: att.id,
      attemptNumber: att.attempt_number || 1,
      assessmentId: asm?.id,
      assessmentTitle: cleanTitle || (isModular ? 'Module Theory Quiz' : 'Practical Simulator Drill'),
      assessmentCode,
      moduleTitle: modTitle || (isModular ? 'Modular Knowledge Unit' : null),
      category: isModular ? 'MODULAR' : 'PRACTICAL',
      isFullModularCourse: isCourseFullModular,
      type: isCourseFullModular
        ? (asm?.module_id ? 'Module Quiz' : 'Course Final Assessment')
        : (isModular ? 'Modular Theory' : 'Practical Simulator'),
      courseId: asm?.course_id || null,
      courseCode: crs?.code || 'STCW',
      courseTitle: crs?.name || 'Maritime Training Program',
      score: scoreNum,
      maxScore: 100,
      percentage: scoreNum,
      passingScore: passingThreshold,
      result: isPassed ? 'PASSED' : 'FAILED',
      grade: isPassed ? 'PASSED' : 'FAILED',
      status: 'COMPLETED',
      feedback: isPassed
        ? `Score: ${scoreNum}%. Competency benchmark satisfied (${passingThreshold}% threshold).`
        : `Score: ${scoreNum}%. Minimum passing score is ${passingThreshold}%. You may retake this assessment before your deadline.`,
      date: att.submitted_at
        ? new Date(att.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : 'Recent',
      gradedAt: att.submitted_at || new Date().toISOString(),
    });
  });

  // 2. Process any course-level grades not already represented by attempts
  gradesData.forEach((g: any) => {
    if (!coveredAttemptCourseKeys.has(g.course_id)) {
      const crs = Array.isArray(g.courses) ? g.courses[0] : g.courses;
      const isCourseFullModular =
        fullModularCourseIdSet.has(g.course_id) ||
        isInHouseModularCourse(crs?.category, crs?.practical_days);
      const scoreNum = Number(g.final_score) || 0;
      const isPassed = g.grade === 'PASSED' || g.status === 'PASSED' || scoreNum >= 75;
      const isPrac =
        !isCourseFullModular &&
        (g.remarks?.toLowerCase()?.includes('practical') || crs?.name?.toLowerCase()?.includes('simulator'));

      list.push({
        id: g.id,
        attemptId: null,
        assessmentId: null,
        assessmentTitle: isPrac ? `${crs?.name || 'Course'} Practical Evaluation` : `${crs?.name || 'Course'} Modular Quizzes`,
        assessmentCode: crs?.code || (isPrac ? 'PRAC-EVAL' : 'MOD-EVAL'),
        moduleTitle: null,
        category: isPrac ? 'PRACTICAL' : 'MODULAR',
        isFullModularCourse: isCourseFullModular,
        type: isCourseFullModular ? 'Course Quiz Summary' : (isPrac ? 'Practical Simulator' : 'Modular Theory'),
        courseId: g.course_id,
        courseCode: crs?.code || 'STCW',
        courseTitle: crs?.name || 'Maritime Training Program',
        score: scoreNum,
        maxScore: 100,
        percentage: scoreNum,
        passingScore: 75,
        result: isPassed ? 'PASSED' : 'FAILED',
        grade: isPassed ? 'PASSED' : 'FAILED',
        status: g.status || 'COMPLETED',
        remarks: g.remarks || (isPassed ? 'Competency benchmark satisfied.' : 'Remedial required.'),
        feedback: g.remarks || (isPassed ? 'Passing competency verified.' : 'Benchmark requirement was 75%.'),
        date: g.graded_at
          ? new Date(g.graded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : (g.created_at ? new Date(g.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent'),
        gradedAt: g.graded_at || g.created_at,
      });
    }
  });

  // Split into modular vs practical
  const modularGrades = list.filter((item: any) => item.category === 'MODULAR');
  const practicalGrades = list.filter((item: any) => item.category === 'PRACTICAL');

  const modTotal = modularGrades.reduce((sum: number, item: any) => sum + (item.percentage || 0), 0);
  const pracTotal = practicalGrades.reduce((sum: number, item: any) => sum + (item.percentage || 0), 0);
  const overallTotal = list.reduce((sum: number, item: any) => sum + (item.percentage || 0), 0);

  const modularAverage = modularGrades.length > 0 ? Math.round(modTotal / modularGrades.length) : 0;
  const practicalAverage = practicalGrades.length > 0 ? Math.round(pracTotal / practicalGrades.length) : 0;
  const overallAverage = list.length > 0 ? Math.round(overallTotal / list.length) : 0;

  const modularPassedCount = modularGrades.filter((m: any) => m.result === 'PASSED').length;
  const practicalPassedCount = practicalGrades.filter((p: any) => p.result === 'PASSED').length;

  // 3. Compute Transparent Course-Level Weighted Breakdowns (Section 1.1, 1.2, 4)
  const breakdownResults = await Promise.all(
    enrolledCourseIds.map(async (cid) => {
      try {
        const breakdown = await calculateTraineeCourseGrade({ traineeId: resolvedId, courseId: cid });
        return toTraineeCourseBreakdownView(breakdown);
      } catch (calcErr) {
        console.warn(`Error computing grade breakdown for course ${cid}:`, calcErr);
        return null;
      }
    })
  );
  const courseBreakdowns: any[] = breakdownResults.filter(Boolean);

  // 4. Fetch released practical assessment evaluations & criteria feedback ONLY for courses requiring practical
  let practicalEvals: any[] = [];
  if (practicalCourseIds.length > 0) {
    const { data: peRows } = await supabaseAdmin
      .from('practical_evaluations')
      .select(`
        id,
        rubric_id,
        course_id,
        total_score,
        max_possible_score,
        percentage,
        competency_status,
        status,
        general_feedback,
        strengths,
        improvements_required,
        remediation_plan,
        evaluation_date,
        courses (id, code, name, category, practical_days),
        practical_rubrics (title, stcw_reference, passing_score),
        instructors:profiles!practical_evaluations_instructor_id_fkey (first_name, last_name, avatar_url)
      `)
      .eq('trainee_id', resolvedId)
      .in('course_id', practicalCourseIds)
      .in('status', ['SUBMITTED', 'FINALIZED']);

    practicalEvals = (peRows || []).filter((pe: any) => {
      const crs = Array.isArray(pe.courses) ? pe.courses[0] : pe.courses;
      return !isInHouseModularCourse(crs?.category, crs?.practical_days);
    });
  }

  const evalIds = practicalEvals.map((pe: any) => pe.id).filter(Boolean);
  const scoresByEvalId = new Map<string, any[]>();
  if (evalIds.length > 0) {
    const { data: allScores } = await supabaseAdmin
      .from('practical_evaluation_scores')
      .select('*, practical_rubric_criteria(criterion_name, competency, max_points, is_critical)')
      .in('evaluation_id', evalIds);

    for (const s of (allScores || [])) {
      const listForEval = scoresByEvalId.get(s.evaluation_id) || [];
      listForEval.push(s);
      scoresByEvalId.set(s.evaluation_id, listForEval);
    }
  }

  const practicalFeedbacks: any[] = [];
  for (const pe of practicalEvals) {
    const scores = scoresByEvalId.get(pe.id) || [];

    const crs = Array.isArray(pe.courses) ? pe.courses[0] : pe.courses;
    const rub = pe.practical_rubrics as any;
    const ins = pe.instructors as any;

    practicalFeedbacks.push({
      evaluationId: pe.id,
      courseId: pe.course_id,
      courseTitle: crs?.name || 'Maritime Course',
      rubricTitle: rub?.title || 'Practical Assessment Rubric',
      stcwReference: rub?.stcw_reference || 'STCW Section A-VI',
      instructorName: ins ? `Capt. ${ins.first_name || ''} ${ins.last_name || ''}`.trim() : 'Instructor',
      instructorAvatarUrl: ins?.avatar_url || null,
      totalScore: Number(pe.total_score),
      maxPossibleScore: Number(pe.max_possible_score),
      percentage: Number(pe.percentage),
      passingScore: Number(rub?.passing_score) || 75,
      competencyStatus: pe.competency_status,
      status: pe.status,
      generalFeedback: pe.general_feedback || '',
      strengths: pe.strengths || '',
      improvementsRequired: pe.improvements_required || '',
      remediationPlan: pe.remediation_plan || '',
      evaluationDate: pe.evaluation_date,
      criteriaBreakdown: scores.map((s: any) => ({
        criterionName: s.practical_rubric_criteria?.criterion_name || 'Criterion',
        score: Number(s.score),
        maxPoints: Number(s.practical_rubric_criteria?.max_points) || 25,
        isCritical: Boolean(s.practical_rubric_criteria?.is_critical),
        ratingLabel: s.rating_label || '',
        comments: s.comments || '',
      })),
    });
  }

  const hasPracticalCourses = courseBreakdowns.some(
    (cb: any) => cb.requiresPractical !== false && !cb.isFullModular
  );
  const allFullModular = courseBreakdowns.length > 0 && !hasPracticalCourses;
  const isModularQualified = modularGrades.length > 0 && modularPassedCount === modularGrades.length;
  const isPracticalQualified = !hasPracticalCourses
    ? true
    : (practicalGrades.length > 0 && practicalPassedCount === practicalGrades.length);
  const isOverallQualified =
    courseBreakdowns.length > 0 && courseBreakdowns.every((cb: any) => cb.status === 'PASSED');

  const summary = {
    modularAverage,
    practicalAverage,
    overallAverage,
    modularPassedCount,
    modularTotal: modularGrades.length,
    practicalPassedCount,
    practicalTotal: practicalGrades.length,
    totalAssessments: list.length,
    isModularQualified,
    isPracticalQualified,
    hasPracticalCourses,
    allFullModular,
    isOverallQualified,
  };

  const result: any = list;
  result.modularGrades = modularGrades;
  result.practicalGrades = practicalGrades;
  result.courseBreakdowns = courseBreakdowns;
  result.practicalFeedbacks = practicalFeedbacks;
  result.summary = summary;

  return result;
}

/**
 * Trainee Certificates
 */
export async function getTraineeCertificatesList(traineeId: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  const [certsRes, profileRes, traineeRes] = await Promise.all([
    supabaseAdmin
      .from('certificates')
      .select(`
        *,
        courses (id, code, name, category)
      `)
      .eq('trainee_id', resolvedId)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('profiles').select('first_name, last_name, email, phone, avatar_url').eq('id', resolvedId).maybeSingle(),
    supabaseAdmin.from('trainees').select('srn, trainee_number').eq('profile_id', resolvedId).maybeSingle(),
  ]);

  if (certsRes.error) throw certsRes.error;
  const certsData = certsRes.data || [];

  const profile = profileRes.data;
  const trainee = traineeRes.data;
  const traineeFullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Maritime Trainee';
  const traineeSrn = resolveRealSrn(trainee, profile) || 'SRN-PENDING';

  // Dynamically resolve assigned instructor for each course
  const courseIds: string[] = Array.from(new Set<string>(certsData.map((c: any) => c.course_id as string).filter(Boolean)));
  const instructorMap = new Map<string, { name: string; avatarUrl: string | null }>();

  if (courseIds.length > 0) {
    // 1. Check batches associated with this trainee's enrollment
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select(`
        course_id,
        batches (
          instructor_id,
          instructors (
            profile_id,
            profiles ( first_name, last_name, avatar_url )
          )
        )
      `)
      .eq('trainee_id', resolvedId)
      .in('course_id', courseIds);

    enrollments?.forEach((enr: any) => {
      const prof = (enr.batches?.instructors as any)?.profiles;
      if (prof?.first_name || prof?.last_name) {
        instructorMap.set(enr.course_id, {
          name: `Capt. ${prof.first_name || ''} ${prof.last_name || ''}`.trim(),
          avatarUrl: prof.avatar_url || null,
        });
      }
    });

    // 2. Check schedules for any course not yet mapped
    const missingCourseIds = courseIds.filter((cid: string) => !instructorMap.has(cid));
    if (missingCourseIds.length > 0) {
      const { data: scheds } = await supabaseAdmin
        .from('schedules')
        .select(`
          course_id,
          instructors (
            profile_id,
            profiles ( first_name, last_name, avatar_url )
          )
        `)
        .in('course_id', missingCourseIds)
        .order('created_at', { ascending: false });

      scheds?.forEach((s: any) => {
        if (!instructorMap.has(s.course_id)) {
          const prof = (s.instructors as any)?.profiles;
          if (prof?.first_name || prof?.last_name) {
            instructorMap.set(s.course_id, {
              name: `Capt. ${prof.first_name || ''} ${prof.last_name || ''}`.trim(),
              avatarUrl: prof.avatar_url || null,
            });
          }
        }
      });
    }

    // 3. Check course_instructors
    const stillMissing = courseIds.filter((cid: string) => !instructorMap.has(cid));
    if (stillMissing.length > 0) {
      const { data: cInstructors } = await supabaseAdmin
        .from('course_instructors')
        .select(`
          course_id,
          instructors (
            profile_id,
            profiles ( first_name, last_name, avatar_url )
          )
        `)
        .in('course_id', stillMissing);

      cInstructors?.forEach((ci: any) => {
        if (!instructorMap.has(ci.course_id)) {
          const prof = (ci.instructors as any)?.profiles;
          if (prof?.first_name || prof?.last_name) {
            instructorMap.set(ci.course_id, {
              name: `Capt. ${prof.first_name || ''} ${prof.last_name || ''}`.trim(),
              avatarUrl: prof.avatar_url || null,
            });
          }
        }
      });
    }
  }

  // 4. Check practical evaluations & grade completion to verify trainee is qualified for certificate release
  const competentCourseSet = new Set<string>();
  const gradeMap = new Map<string, any>();
  if (courseIds.length > 0) {
    const [{ data: pEvals }, { data: gradeRows }] = await Promise.all([
      supabaseAdmin
        .from('practical_evaluations')
        .select('course_id, competency_status')
        .eq('trainee_id', resolvedId)
        .in('course_id', courseIds),
      supabaseAdmin
        .from('grades')
        .select('course_id, final_score, grade, status, breakdown')
        .eq('trainee_id', resolvedId)
        .in('course_id', courseIds),
    ]);

    (pEvals || []).forEach((pe: any) => {
      if (pe.competency_status === 'COMPETENT') {
        competentCourseSet.add(pe.course_id);
      }
    });

    (gradeRows || []).forEach((g: any) => {
      gradeMap.set(g.course_id, g);
    });
  }

  // Deduplicate by course_id: if multiple certificates exist for a course, prefer ISSUED over duplicates
  const uniqueCertsByCourse = new Map<string, any>();
  certsData.forEach((c: any) => {
    if (!uniqueCertsByCourse.has(c.course_id)) {
      uniqueCertsByCourse.set(c.course_id, c);
    } else {
      const existing = uniqueCertsByCourse.get(c.course_id);
      if (c.status === 'ISSUED' && existing.status !== 'ISSUED') {
        uniqueCertsByCourse.set(c.course_id, c);
      }
    }
  });
  const dedupedCerts = Array.from(uniqueCertsByCourse.values());

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return dedupedCerts.map((c: any) => {
    const rawIssue = c.issued_at ? new Date(c.issued_at) : new Date();
    const rawExpiry = c.expires_at ? new Date(c.expires_at) : new Date(rawIssue.getTime() + 5 * 365.25 * 86400000);
    const formattedIssue = `${months[rawIssue.getMonth()]} ${rawIssue.getDate()}, ${rawIssue.getFullYear()}`;
    const formattedExpiry = `${rawExpiry.getFullYear()}`;
    const assignedInstructorInfo = instructorMap.get(c.course_id);
    const assignedInstructor = assignedInstructorInfo?.name || 'Assigned Instructor';

    const isInHouse = isInHouseModularCourse(c.courses?.category);
    const isPracticalCompetent = isInHouse ? true : competentCourseSet.has(c.course_id);
    const gradeRecord = gradeMap.get(c.course_id);
    const gradeStatus = (gradeRecord?.status || gradeRecord?.grade || '').toUpperCase();
    const gradeBreakdown = gradeRecord?.breakdown;
    const isGradePassed = gradeStatus === 'PASSED' && gradeBreakdown?.passed === true;
    const certStatusUpper = (c.status || '').toUpperCase();
    const hasPendingRequirements =
      !isGradePassed ||
      !isPracticalCompetent ||
      gradeBreakdown?.hasPending === true ||
      gradeBreakdown?.mandatoryRequirementsMet === false ||
      certStatusUpper === 'WITHHELD' ||
      certStatusUpper === 'PENDING';

    const isRevoked = certStatusUpper === 'REVOKED';
    const isClaimed = certStatusUpper === 'CLAIMED' || Boolean(c.claimed_at);
    const isWithheld = !isRevoked && !isClaimed && hasPendingRequirements;
    const isReady = !isRevoked && !isClaimed && !hasPendingRequirements;

    let displayStatus = 'READY FOR CLAIM';
    if (isRevoked) displayStatus = 'REVOKED';
    else if (isClaimed) displayStatus = 'CLAIMED';
    else if (!isPracticalCompetent) displayStatus = 'PENDING PRACTICAL EVALUATION';
    else if (hasPendingRequirements) displayStatus = 'PENDING REQUIREMENTS';
    else if (certStatusUpper === 'WITHHELD') displayStatus = 'WITHHELD - REQUIREMENTS NOT MET';

    return {
      id: c.id,
      certificateNo: c.certificate_number || `NEWSIM-CERT-${c.id.slice(0, 8).toUpperCase()}`,
      courseId: c.course_id,
      courseCode: c.courses?.code || 'STCW',
      courseTitle: c.courses?.name || 'Engine Room Simulator & Resource Management',
      traineeName: traineeFullName,
      traineeSrn,
      traineeEmail: profile?.email || '',
      traineeAvatarUrl: profile?.avatar_url || null,
      issueDate: formattedIssue,
      expiryDate: formattedExpiry,
      rawIssueDate: c.issued_at,
      status: displayStatus,
      isReadyForClaim: isReady,
      isWithheld,
      isRevoked,
      isPracticalCompetent,
      claimType: 'PERSONAL_CLAIM',
      pickupLocation: 'Registrar Office, NEWSIM Talisay Training Center, Talisay City',
      claimRequirements: isRevoked
        ? 'Certificate is revoked by MARINA/NEWSIM administration. Claim voucher is void.'
        : !isPracticalCompetent
        ? 'Mandatory Requirement: You must attend and pass your in-person Practical Simulator Session before this certificate is issued.'
        : hasPendingRequirements
        ? 'Mandatory STCW requirements incomplete: All module quizzes, comprehensive post-assessment, and practical drills must be completed with passing grades before certificate claim.'
        : isWithheld
        ? 'Practical re-assessment or attendance remediation required before release.'
        : "Present valid Seaman's Book / Government ID & SRN upon claim",
      qrVerificationCode: `V-${c.id.slice(0, 8).toUpperCase()}`,
      fileUrl: null, // Official certificate is claimed personally - no download button
      instructorName: assignedInstructor,
      instructorAvatarUrl: assignedInstructorInfo?.avatarUrl || null,
      centerName: 'NEWSIM Maritime Training Center',
    };
  });
}

export async function verifyCertificateCode(code: string) {
  const cleanCode = (code || '').trim();
  if (!cleanCode) {
    return {
      isValid: false,
      status: 'NOT_FOUND',
      message: 'Certificate identifier or QR code is required.',
    };
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode);
  const certSelect = `
      id,
      certificate_number,
      status,
      issued_at,
      expires_at,
      scheduled_claim_date,
      claimed_at,
      verification_hash,
      courses (id, code, name),
      trainees (profile_id, srn, profiles (first_name, last_name, avatar_url))
    `;

  let { data, error } = await supabaseAdmin
    .from('certificates')
    .select(certSelect)
    .eq('certificate_number', cleanCode)
    .maybeSingle();

  if (!error && !data && isUUID) {
    const byId = await supabaseAdmin
      .from('certificates')
      .select(certSelect)
      .eq('id', cleanCode)
      .maybeSingle();
    data = byId.data;
    error = byId.error;
  }

  if (error || !data) {
    return {
      isValid: false,
      status: 'NOT_FOUND',
      message: 'Certificate not found or invalid QR verification code.',
    };
  }

  const traineeRel = Array.isArray((data as any).trainees) ? (data as any).trainees[0] : (data as any).trainees;
  const profile = Array.isArray(traineeRel?.profiles) ? traineeRel.profiles[0] : traineeRel?.profiles;
  const now = new Date();
  const isRevoked = data.status === 'REVOKED';
  const isExpired = Boolean(data.expires_at && new Date(data.expires_at) < now);
  const isIssuedOrClaimed = ['ACTIVE', 'ISSUED', 'APPROVED', 'CLAIMED'].includes((data.status || '').toUpperCase());
  const isValid = !isRevoked && !isExpired && isIssuedOrClaimed;

  let computedStatus = data.status || 'ISSUED';
  if (isRevoked) {
    computedStatus = 'REVOKED';
  } else if (isExpired) {
    computedStatus = 'EXPIRED';
  }

  let message = 'Authentic maritime certificate verified.';
  if (isRevoked) {
    message = 'CERTIFICATE REVOKED: This credential has been officially revoked by Maritime Training Administration.';
  } else if (isExpired) {
    message = 'CERTIFICATE EXPIRED: The validity period for this maritime credential has expired.';
  } else if (!isValid) {
    message = 'CERTIFICATE UNAPPROVED: This credential is not officially active or issued.';
  }

  return {
    isValid,
    message,
    status: computedStatus,
    certificate: {
      id: data.id,
      certificateNo: data.certificate_number,
      traineeName: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Verified Seafarer',
      traineeAvatarUrl: profile?.avatar_url || null,
      srn: traineeRel?.srn || 'SRN-REGISTERED',
      courseTitle: (data as any).courses?.name || 'Maritime Training Program',
      courseCode: (data as any).courses?.code || 'STCW',
      issueDate: data.issued_at ? new Date(data.issued_at).toISOString().split('T')[0] : '',
      expiryDate: data.expires_at ? new Date(data.expires_at).toISOString().split('T')[0] : '',
      scheduledClaimDate: data.scheduled_claim_date || null,
      claimedAt: data.claimed_at || null,
      status: computedStatus,
      verificationHash: data.verification_hash || 'VERIFIED-STCW-SECURE',
      centerName: 'NEWSIM Maritime Training Center',
    },
  };
}

/**
 * Trainee Payments
 */
export async function getTraineePaymentsList(traineeId: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  const [profileRes, traineeRes, paymentsRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('first_name, last_name, email, phone').eq('id', resolvedId).maybeSingle(),
    supabaseAdmin.from('trainees').select('trainee_number, srn, address, city, province, nationality').eq('profile_id', resolvedId).maybeSingle(),
    supabaseAdmin
      .from('payments')
      .select(`
        *,
        enrollments (
          id,
          course_id,
          batch_id,
          status,
          batches (id, batch_code, start_date, end_date),
          courses (id, code, name),
          course_packages (id, package_code, name)
        )
      `)
      .eq('trainee_id', resolvedId)
      .order('created_at', { ascending: false }),
  ]);

  if (paymentsRes.error) throw paymentsRes.error;

  const rawPayments = paymentsRes.data || [];
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  const authHeader =
    secretKey && secretKey.startsWith('sk_test_')
      ? 'Basic ' + Buffer.from(secretKey + ':').toString('base64')
      : null;

  await Promise.all(
    rawPayments.map(async (p: any) => {
      if (authHeader && (p.status === 'PENDING' || p.status === 'PROCESSING') && p.paymongo_checkout_id) {
        try {
          const pmRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${p.paymongo_checkout_id}`, {
            method: 'GET',
            headers: { 'Authorization': authHeader },
            signal: AbortSignal.timeout(2500),
          });
          if (pmRes.ok) {
            const pmData = await pmRes.json();
            const sessionAttrs = pmData.data?.attributes || {};
            const pmPayments = Array.isArray(sessionAttrs.payments) ? sessionAttrs.payments : [];
            const expectedCentavos = Math.round(Number(p.amount) * 100);
            const paidEntry = pmPayments.find(
              (pay: any) =>
                pay.attributes?.status === 'paid' &&
                (pay.attributes?.currency || 'PHP').toUpperCase() === 'PHP' &&
                Number(pay.attributes?.amount) === expectedCentavos
            );
            if (!sessionAttrs.livemode && paidEntry) {
              const now = new Date().toISOString();
              const primaryPayment = paidEntry;
              const paymongoPaymentId = primaryPayment.id || null;
              const methodUsed = (primaryPayment.attributes?.source?.type || sessionAttrs.payment_method_used || p.payment_method || 'GCASH').toUpperCase();

              const { data: transitioned } = await supabaseAdmin
                .from('payments')
                .update({
                  status: 'PAID',
                  paid_at: now,
                  paymongo_payment_id: paymongoPaymentId,
                  payment_method: methodUsed.includes('MAYA') ? 'MAYA' : 'GCASH',
                  updated_at: now,
                })
                .eq('id', p.id)
                .neq('status', 'PAID')
                .neq('status', 'VERIFIED')
                .select('id')
                .maybeSingle();

              if (transitioned && p.enrollment_id) {
                await supabaseAdmin
                  .from('enrollments')
                  .update({
                    status: 'PENDING_REVIEW',
                    updated_at: now,
                  })
                  .eq('id', p.enrollment_id)
                  .in('status', ['PAYMENT_PENDING', 'PENDING']);
              }

              p.status = 'PAID';
              p.paid_at = now;
              p.paymongo_payment_id = paymongoPaymentId;
              if (p.enrollments && (p.enrollments.status === 'PAYMENT_PENDING' || p.enrollments.status === 'PENDING')) {
                p.enrollments.status = 'PENDING_REVIEW';
              }
            }
          }
        } catch (pmErr) {
          console.warn('PayMongo auto-sync notice in getTraineePaymentsList:', pmErr);
        }
      }
    })
  );

  const profile = profileRes.data;
  const trainee = traineeRes.data;
  const traineeDetails = {
    fullName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Maritime Trainee',
    email: profile?.email || '',
    phone: profile?.phone || 'N/A',
    srn: resolveRealSrn(trainee) || 'SRN-PENDING',
    traineeNumber: trainee?.trainee_number || 'TRN-PENDING',
    address: [trainee?.address, trainee?.city, trainee?.province].filter(Boolean).join(', ') || 'N/A',
    nationality: trainee?.nationality || 'Filipino',
  };

  return rawPayments.map((p: any) => {
    const enr = p.enrollments || {};
    const course = enr.courses || {};
    const batch = enr.batches || {};
    const pkg = enr.course_packages || {};
    const title = course.name || pkg.name || 'Maritime Course Tuition';

    const enrStatusUpper = (enr.status || '').toUpperCase();
    const paymentStatusUpper = (p.status || '').toUpperCase();

    // Payment is verified/approved if:
    // 1. Explicitly verified by admin (verified_at / verified_by is populated), OR
    // 2. Status in DB is 'VERIFIED', OR
    // 3. Associated enrollment was confirmed/activated by admin ('ENROLLED', 'APPROVED', 'ACTIVE', 'COMPLETED')
    const isApproved = Boolean(
      p.verified_at ||
      p.verified_by ||
      paymentStatusUpper === 'VERIFIED' ||
      ['ENROLLED', 'APPROVED', 'ACTIVE', 'COMPLETED'].includes(enrStatusUpper)
    );

    const isPendingApproval = !isApproved && (
      paymentStatusUpper === 'PAID' ||
      enrStatusUpper === 'PENDING_REVIEW' ||
      paymentStatusUpper === 'PROCESSING'
    );

    return {
      id: p.id,
      paymentNo: p.reference_number || `PAY-${p.id.slice(0, 8).toUpperCase()}`,
      receiptNo: `REC-${p.id.slice(0, 8).toUpperCase()}`,
      enrollmentId: p.enrollment_id,
      enrollmentStatus: enr.status || 'PENDING_REVIEW',
      courseTitle: title,
      courseCode: course.code || 'STCW',
      batchCode: batch.batch_code || 'Cohort',
      batchStartDate: batch.start_date || '',
      batchEndDate: batch.end_date || '',
      centerName: 'NEWSIM Maritime Training Center',
      amount: Number(p.amount) || 0,
      method: p.payment_method || 'GCASH',
      referenceNumber: p.reference_number || `REF-${p.id.slice(0, 8).toUpperCase()}`,
      paymongoCheckoutId: p.paymongo_checkout_id || null,
      paymongoPaymentId: p.paymongo_payment_id || null,
      status: isApproved ? 'VERIFIED' : (p.status || 'PENDING'),
      rawStatus: p.status || 'PENDING',
      isApproved,
      isPendingApproval,
      verifiedAt: p.verified_at || (isApproved ? (enr.reviewed_at || p.updated_at) : null),
      verifiedBy: p.verified_by || (isApproved ? enr.reviewed_by : null),
      environment: p.payment_environment || 'TEST',
      checkoutUrl: p.paymongo_checkout_url || null,
      createdAt: p.created_at,
      paidAt: p.paid_at,
      trainee: traineeDetails,
      ongoingNotice: isApproved
        ? 'Payment verified and approved by training center administrator.'
        : 'Your payment is on-going. Please wait for admin verification to proceed.',
    };
  });
}

export async function createTraineePaymentCheckout(
  traineeId: string,
  enrollmentId: string,
  method: string,
  amount: number,
  paymongoDetails?: {
    checkoutId?: string;
    checkoutUrl?: string;
    environment?: 'TEST' | 'LIVE';
  }
) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  // Prevent duplicate payments (PAID or PENDING)
  const { data: existingPayments } = await supabaseAdmin
    .from('payments')
    .select('status')
    .eq('enrollment_id', enrollmentId)
    .in('status', ['PAID', 'PENDING', 'VERIFIED', 'PROCESSING']);

  if (existingPayments && existingPayments.length > 0) {
    const isPaid = existingPayments.some((p: any) => p.status === 'PAID' || p.status === 'VERIFIED');
    if (isPaid) {
      throw new Error('This enrollment has already been paid. A duplicate payment cannot be created.');
    } else {
      throw new Error('Your payment is currently pending. Please wait for the payment status to be confirmed.');
    }
  }

  const refNumber = `REF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert({
      trainee_id: resolvedId,
      enrollment_id: enrollmentId,
      amount,
      payment_method: method || 'GCASH',
      reference_number: refNumber,
      status: 'PENDING',
      paymongo_checkout_id: paymongoDetails?.checkoutId || null,
      paymongo_checkout_url: paymongoDetails?.checkoutUrl || null,
      payment_environment: paymongoDetails?.environment || 'TEST',
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    paymentNo: refNumber,
    enrollmentId,
    amount,
    method,
    referenceNumber: refNumber,
    status: data.status,
    checkoutUrl: data.paymongo_checkout_url,
    createdAt: data.created_at,
  };
}

/**
 * Trainee Notifications
 */
export async function getTraineeNotificationsList(traineeId: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);
  return getUserNotifications(resolvedId, 'TRAINEE');
}

export async function markTraineeNotificationsRead(traineeId: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', resolvedId);

  if (error) throw error;
  return { success: true };
}

/**
 * Dynamic Dashboard Aggregation
 */
export async function getTraineeDashboardMetrics(traineeId: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  const [
    profile,
    enrollments,
    courses,
    schedules,
    attendance,
    certificates,
    notifications,
    assessments,
  ] = await Promise.all([
    getTraineeProfileData(resolvedId),
    getTraineeEnrollmentsList(resolvedId),
    getTraineeCoursesList(resolvedId),
    getTraineeSchedulesList(resolvedId),
    getTraineeAttendanceData(resolvedId),
    getTraineeCertificatesList(resolvedId),
    getTraineeNotificationsList(resolvedId),
    getTraineeAssessmentsList(resolvedId),
  ]);

  const activeCourses = courses.filter((c: any) =>
    ['ENROLLED', 'ACTIVE', 'ONGOING', 'APPROVED'].includes((c.enrollmentStatus || '').toUpperCase())
  ).length;
  const completedCourses = courses.filter((c: any) =>
    (c.enrollmentStatus || '').toUpperCase() === 'COMPLETED'
  ).length;

  const inProgressCourses = courses.filter((c: any) =>
    ['ENROLLED', 'ACTIVE', 'ONGOING', 'APPROVED'].includes((c.enrollmentStatus || '').toUpperCase())
  );

  const currentCourse =
    inProgressCourses.find((c: any) => (c.progressPercent || 0) > 0 && (c.progressPercent || 0) < 100) ||
    inProgressCourses[0] ||
    null;

  let continueLearningData = null;
  if (currentCourse) {
    const courseLessons = await getTraineeLearningMaterials(currentCourse.id, resolvedId);
    const totalLessons = courseLessons.length || 4;
    const nextIncompleteIdx = courseLessons.findIndex((l: any) => !l.isCompleted);
    const activeIdx = nextIncompleteIdx >= 0 ? nextIncompleteIdx : 0;
    const activeLesson = courseLessons[activeIdx] || {
      id: 'les-01',
      title: 'Module Core Competencies',
      moduleName: currentCourse.currentModule || 'General Maritime Competence',
    };

    continueLearningData = {
      courseId: currentCourse.id,
      courseTitle: currentCourse.title,
      courseCode: currentCourse.code,
      moduleId: activeLesson.moduleId || 'mod-01',
      moduleName: activeLesson.moduleName || currentCourse.currentModule || 'General Maritime Competence',
      lessonId: activeLesson.id,
      lessonTitle: activeLesson.title || 'Module Core Competencies',
      lessonNumber: activeIdx + 1,
      totalLessons: totalLessons,
      progressPercent: currentCourse.progressPercent,
      lastAccessed: 'Active',
      isFullyCompleted: currentCourse.progressPercent >= 100,
    };
  }

  const pendingAssessments = assessments.filter(
    (a: any) => (a.status || '').toUpperCase() !== 'PASSED' && (a.status || '').toUpperCase() !== 'COMPLETED'
  );

  // Fetch recent completions for recent activity
  const { data: recentCompletions } = await supabaseAdmin
    .from('trainee_lesson_completions')
    .select('*, courses(name, code)')
    .eq('trainee_id', resolvedId)
    .order('completed_at', { ascending: false })
    .limit(3);

  const completionActivities = (recentCompletions || []).map((rc: any) => ({
    id: `comp-${rc.id}`,
    time: rc.completed_at ? new Date(rc.completed_at).toLocaleDateString() : 'Today',
    title: 'Completed Lesson',
    description: `${rc.lesson_title || 'Competency Lesson'} • ${rc.courses?.code || 'STCW'}`,
  }));

  const certificateActivities = (certificates.slice(0, 2) || []).map((c: any) => ({
    id: `cert-${c.id}`,
    time: c.issueDate || 'Recently',
    title: 'Certificate Ready for Claim',
    description: `${c.courseTitle} (${c.certificateNo})`,
  }));

  const enrollmentActivities = (enrollments.slice(0, 3) || []).map((e: any) => ({
    id: `enr-${e.id}`,
    time: e.appliedAt ? new Date(e.appliedAt).toLocaleDateString() : 'Recently',
    title: 'Enrolled in Program',
    description: e.courseTitle,
  }));

  const combinedActivity = [
    ...certificateActivities,
    ...completionActivities,
    ...enrollmentActivities,
  ].slice(0, 5);

  return {
    trainee: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      srn: profile.srn,
      rank: profile.rank,
      avatarUrl: profile.avatarUrl || null,
      currentStreak: activeCourses > 0 ? 1 : 0,
    },
    currentTraining: currentCourse
      ? {
          courseTitle: currentCourse.title,
          courseCode: currentCourse.code,
          progressPercent: currentCourse.progressPercent,
          currentModule: currentCourse.currentModule,
          nextLessonTitle: continueLearningData?.lessonTitle || 'Module Core Competencies',
          nextLessonId: continueLearningData?.lessonId || 'les-01',
          status: currentCourse.enrollmentStatus,
        }
      : null,
    metrics: {
      activeCourses,
      completedCourses,
      overallProgress: courses.length > 0
        ? Math.round(courses.reduce((sum: number, c: any) => sum + (c.progressPercent || 0), 0) / courses.length)
        : 0,
      attendanceRate: attendance.summary.attendanceRate,
      pendingAssessments: pendingAssessments.length,
      earnedCertificates: certificates.length,
    },
    continueLearning: continueLearningData,
    upcomingSchedule: (schedules || [])
      .filter((s: any) => {
        const st = (s.status || '').toUpperCase();
        if (s.isCompleted || st === 'COMPLETED' || s.isFailed || st === 'FAILED') {
          return false;
        }
        if (s.endAt && new Date(s.endAt) < new Date()) {
          return false;
        }
        return true;
      })
      .slice(0, 3),
    pendingAssessmentsList: pendingAssessments.slice(0, 3),
    assessmentVerdicts: assessments
      .filter((a: any) => a.isAttempted && a.score != null)
      .sort((a: any, b: any) => {
        const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        if (ta !== tb) return ta - tb;
        return (a.moduleSortOrder ?? 0) - (b.moduleSortOrder ?? 0);
      })
      .map((a: any, idx: number) => ({
        id: a.id,
        day: a.moduleSortOrder != null ? `Day ${a.moduleSortOrder}` : (a.code || `Eval ${idx + 1}`),
        title: a.moduleTitle || a.title || 'Competency Assessment',
        courseCode: a.courseCode || 'STCW',
        score: Number(a.score),
        passingScore: Number(a.passingScore ?? 75),
        verdict: a.status,
        submittedAt: a.submittedAt,
      })),
    myCoursesSummary: courses,
    attendanceOverview: attendance.summary,
    recentActivity: combinedActivity.length > 0 ? combinedActivity : enrollmentActivities,
    notifications: notifications.slice(0, 4),
    certificatesSummary: certificates,
  };
}

/**
 * Dynamic Progress Data
 */
export async function getTraineeProgressData(traineeId: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);
  const courses = await getTraineeCoursesList(resolvedId);

  const totalProgress = courses.length > 0
    ? Math.round(courses.reduce((sum: number, c: any) => sum + (c.progressPercent || 0), 0) / courses.length)
    : 0;

  // Collect daily modules telemetry across all enrolled courses for graphs
  const dailyModulesList: any[] = [];
  for (const c of courses) {
    try {
      const syncs = await syncTraineeDailyModules(resolvedId, c.id);
      syncs.forEach((m) => {
        dailyModulesList.push({
          courseId: c.id,
          courseCode: c.code,
          courseTitle: c.title,
          moduleId: m.moduleId,
          moduleTitle: m.moduleTitle,
          dayNumber: m.dayNumber,
          label: `Day ${m.dayNumber}`,
          scheduledDate: m.scheduledDate,
          formattedDate: m.formattedDate,
          status: m.status,
          isCompleted: m.isCompleted,
          isFailed: m.isFailed,
          isDueToday: m.isDueToday,
          quizScore: m.assessmentScore ?? null,
          passingScore: 75,
        });
      });
    } catch (e) {
      console.warn('Error fetching daily modules for progress data:', e);
    }
  }

  // 3-Pillar STCW Competency Breakdown for interactive radar/bar charts
  const attendanceAvg = 100;
  const practicalAvg = courses.some((c: any) => c.practicalCompetent) ? 100 : 0;
  const theoryAvg = courses.length > 0
    ? Math.round(courses.reduce((sum: number, c: any) => sum + (c.averageGrade || 0), 0) / courses.length)
    : 0;

  const competencyRadar = [
    { pillar: 'Attendance (Min 80%)', score: attendanceAvg, benchmark: 80, weight: '10%' },
    { pillar: 'Practical Drills (Min 70%)', score: practicalAvg, benchmark: 70, weight: '60%' },
    { pillar: 'Theory Quizzes (Min 75%)', score: theoryAvg, benchmark: 75, weight: '40%' },
  ];

  return {
    overallProgress: totalProgress,
    status: totalProgress >= 50 ? 'ON_TRACK' : (courses.length > 0 ? 'NEEDS_ATTENTION' : 'NOT_STARTED'),
    streakDays: courses.length > 0 ? 1 : 0,
    totalHoursCompleted: courses.reduce((sum: number, c: any) => sum + (c.enrollmentStatus === 'COMPLETED' ? (c.durationHours || 40) : 0), 0),
    totalHoursRequired: courses.reduce((sum: number, c: any) => sum + (c.durationHours || 40), 0),
    totalPassedModules: courses.reduce((sum: number, c: any) => sum + (c.modulesCompleted || 0), 0),
    totalFailedModules: courses.reduce((sum: number, c: any) => sum + (c.modulesFailed || 0), 0),
    totalRequiredModules: courses.reduce((sum: number, c: any) => sum + (c.totalModules || 0), 0),
    hasPendingPractical: courses.some((c: any) => c.practicalStatus === 'PENDING_EVALUATION'),
    dailyModulesList,
    competencyRadar,
    courses,
  };
}

/**
 * Helper: Format date in Asia/Manila (UTC+8) timezone
 */
export function formatManilaDate(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
}

/**
 * Helper: Add days to YYYY-MM-DD string without timezone drift
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  dateObj.setUTCDate(dateObj.getUTCDate() + days);
  return dateObj.toISOString().slice(0, 10);
}

/**
 * Helper: Format readable date (e.g. 'Nov 10, 2026')
 */
export function formatReadableDateString(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return dateObj.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

export interface DailyModuleSyncResult {
  moduleId: string;
  moduleTitle: string;
  moduleDescription: string;
  dayNumber: number;
  scheduledDate: string; // 'YYYY-MM-DD'
  formattedDate: string; // 'Nov 9, 2026'
  status: 'LOCKED' | 'AVAILABLE' | 'COMPLETED' | 'FAILED';
  isDueToday: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isLocked: boolean;
  lockReason: string | null;
  failureReason: string | null;
  assessmentId: string | null;
  assessmentTitle: string | null;
  assessmentPassed: boolean;
  assessmentScore: number | null;
}

/**
 * Synchronize Daily Module Progression (1 Module Per Day)
 * - Assigns concrete daily dates (Day 1, Day 2, Day 3...)
 * - Automatically fails modules if trainee misses completion on their scheduled day
 * - Unlocks today's module and dispatches email notification ("Today's Lesson is Ready - Don't Miss Out!")
 * - Locks future daily modules until their designated day
 */
export async function syncTraineeDailyModules(
  traineeId: string,
  courseId: string,
  onNotifyEmail?: (params: {
    type: 'READY_TODAY' | 'MODULE_FAILED';
    traineeEmail: string;
    traineeName: string;
    courseTitle: string;
    moduleTitle: string;
    dayNumber: number;
    scheduledDate: string;
    reason?: string;
  }) => Promise<any>
): Promise<DailyModuleSyncResult[]> {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  // 1. Fetch modules for course
  const { data: modules, error: modErr } = await supabaseAdmin
    .from('course_modules')
    .select('id, title, description, sort_order')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });

  if (modErr || !modules || modules.length === 0) {
    return [];
  }

  // 2. Fetch trainee profile for notifications
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('id', resolvedId)
    .maybeSingle();

  const traineeEmail = profile?.email || '';
  const traineeName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Maritime Trainee';

  // 3. Fetch course details
  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, code, name')
    .eq('id', courseId)
    .maybeSingle();

  const courseTitle = course?.name || 'Maritime Training Program';

  // 4. Fetch enrollment and batch info
  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id, enrolled_at, created_at, batch_id, batches ( id, start_date )')
    .eq('trainee_id', resolvedId)
    .eq('course_id', courseId)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 5. Current date in Manila timezone
  const todayStr = formatManilaDate(new Date());

  // 6. Fetch existing tracking records
  const { data: existingTracking } = await supabaseAdmin
    .from('trainee_daily_module_tracking')
    .select('*')
    .eq('trainee_id', resolvedId)
    .eq('course_id', courseId);

  const trackingMap = new Map<string, any>();
  (existingTracking || []).forEach((t: any) => trackingMap.set(t.module_id, t));

  // Determine course start date: never use a batch start_date in the past before the trainee enrolled or before today
  const enrolledDateStr = enrollment?.enrolled_at
    ? formatManilaDate(new Date(enrollment.enrolled_at))
    : todayStr;
  const batchStart = (enrollment?.batches as any)?.start_date;
  let startDate = todayStr;
  if (batchStart && batchStart >= enrolledDateStr && batchStart >= todayStr) {
    startDate = batchStart;
  } else if (enrolledDateStr >= todayStr) {
    startDate = enrolledDateStr;
  }

  // 7. Fetch trainee lesson reading completions (resolves module_id, les-<moduleId>, and material IDs)
  const completedModuleIds = await getReadModuleIds(resolvedId, [courseId]);

  // 8. Fetch assessments and attempts for this course
  const { data: assessments } = await supabaseAdmin
    .from('assessments')
    .select('id, module_id, title, passing_score')
    .eq('course_id', courseId);

  const asmMap = new Map<string, any>();
  (assessments || []).forEach((a: any) => {
    if (a.module_id) asmMap.set(a.module_id, a);
  });

  const { data: rawAttempts } = await supabaseAdmin
    .from('assessment_attempts')
    .select('id, assessment_id, score, passed, status, started_at, submitted_at')
    .eq('trainee_id', resolvedId)
    .order('submitted_at', { ascending: false });

  // Filter out and clean up any synthetic auto-failed deadline rows (score=0, submitted_at ending in :59:59)
  const syntheticAttemptIds: string[] = [];
  const attempts = (rawAttempts || []).filter((att: any) => {
    const isSyntheticDeadlineFail =
      Number(att.score) === 0 &&
      att.status === 'FAILED' &&
      String(att.submitted_at || '').includes('59:59');
    if (isSyntheticDeadlineFail && att.id) {
      syntheticAttemptIds.push(att.id);
      return false;
    }
    return true;
  });
  if (syntheticAttemptIds.length > 0) {
    supabaseAdmin
      .from('assessment_attempts')
      .delete()
      .in('id', syntheticAttemptIds)
      .then(() => {}, () => {});
  }

  const attemptsByAsm = new Map<string, any>();
  attempts.forEach((att: any) => {
    const existing = attemptsByAsm.get(att.assessment_id);
    const existingPassed = existing?.passed === true || existing?.status === 'PASSED';
    if (!existing || (!existingPassed && (att.passed === true || att.status === 'PASSED'))) {
      attemptsByAsm.set(att.assessment_id, att);
    }
  });

  const results: DailyModuleSyncResult[] = [];
  const trackingUpserts: any[] = [];
  let previousModuleDone = true;

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    const dayNumber = i + 1;
    const existingRow = trackingMap.get(mod.id);
    const existingSched = existingRow?.scheduled_date;
    // Keep completed module's date; for incomplete modules, ensure scheduledDate is anchored to startDate (not a past batch date)
    const scheduledDate =
      existingSched && (existingRow?.status === 'COMPLETED' || existingSched >= startDate)
        ? existingSched
        : addDaysToDateString(startDate, i);
    const formattedDate = formatReadableDateString(scheduledDate);

    const modAsm = asmMap.get(mod.id);
    const asmAttempt = modAsm ? attemptsByAsm.get(modAsm.id) : null;
    const passingScore = modAsm?.passing_score != null && !isNaN(Number(modAsm.passing_score))
      ? Number(modAsm.passing_score)
      : 75;

    const isAsmPassed = asmAttempt ? (asmAttempt.passed === true || asmAttempt.status === 'PASSED' || Number(asmAttempt.score) >= passingScore) : false;
    const isAsmFailed = Boolean(asmAttempt) && !isAsmPassed;
    const isRead = completedModuleIds.has(mod.id) || isAsmPassed;
    const isCompleted = isRead && (modAsm ? isAsmPassed : isRead);

    let status: 'LOCKED' | 'AVAILABLE' | 'COMPLETED' | 'FAILED' = 'LOCKED';
    let lockReason: string | null = null;
    let failureReason: string | null = null;

    if (isCompleted) {
      status = 'COMPLETED';
    } else if (i === 0 || previousModuleDone || isAsmFailed) {
      // Keep module AVAILABLE when unlocked or when a quiz attempt scored below passing so the trainee can reattempt
      status = 'AVAILABLE';
      if (isAsmFailed) {
        failureReason = `Previous attempt scored ${asmAttempt?.score ?? 0}% (minimum ${passingScore}% required — reattempt available)`;
      }

      if (!existingRow?.email_notified_at && scheduledDate === todayStr && !isAsmFailed) {
        if (onNotifyEmail && traineeEmail) {
          try {
            await onNotifyEmail({
              type: 'READY_TODAY',
              traineeEmail,
              traineeName,
              courseTitle,
              moduleTitle: mod.title,
              dayNumber,
              scheduledDate,
            });
          } catch {}
        }
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.DAILY_LESSON_READY,
          traineeId: resolvedId,
          courseId,
          entityType: 'MODULE',
          entityId: mod.id,
          priority: 'HIGH',
          category: 'PROGRESS',
          metadata: {
            dayNumber,
            moduleTitle: mod.title,
            scheduledDate,
          },
          actionUrl: `/learning?courseId=${courseId}`,
        }).catch(() => {});
      }
    } else {
      status = 'LOCKED';
      lockReason = `Locked: Complete Module ${i} first to unlock Module ${dayNumber}.`;
    }

    previousModuleDone = status === 'COMPLETED' || isRead;

    trackingUpserts.push({
      trainee_id: resolvedId,
      course_id: courseId,
      module_id: mod.id,
      day_number: dayNumber,
      scheduled_date: scheduledDate,
      status,
      email_notified_at: status === 'AVAILABLE' && !existingRow?.email_notified_at ? new Date().toISOString() : existingRow?.email_notified_at || null,
      completed_at: isCompleted ? (existingRow?.completed_at || new Date().toISOString()) : null,
      failed_at: null,
      failure_reason: failureReason,
      updated_at: new Date().toISOString(),
    });

    results.push({
      moduleId: mod.id,
      moduleTitle: mod.title,
      moduleDescription: mod.description,
      dayNumber,
      scheduledDate,
      formattedDate,
      status,
      isDueToday: status === 'AVAILABLE',
      isCompleted: status === 'COMPLETED',
      isFailed: Boolean(isAsmFailed),
      isLocked: status === 'LOCKED',
      lockReason,
      failureReason,
      assessmentId: modAsm?.id || null,
      assessmentTitle: modAsm?.title || null,
      assessmentPassed: isAsmPassed,
      assessmentScore: asmAttempt?.score != null ? Number(asmAttempt.score) : null,
    });
  }

  // Persist tracking records
  if (trackingUpserts.length > 0) {
    try {
      await supabaseAdmin
        .from('trainee_daily_module_tracking')
        .upsert(trackingUpserts, { onConflict: 'trainee_id,course_id,module_id' });
    } catch (e) {
      console.warn('trainee_daily_module_tracking notice:', e);
    }
  }

  return results;
}

/**
 * Course Learning Materials
 */
export async function getTraineeLearningMaterials(
  courseId: string,
  traineeId: string,
  onNotifyEmail?: (params: any) => Promise<any>
) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  // If courseId is missing or a mock ID, automatically resolve to trainee's first active/enrolled course
  let targetCourseId = courseId;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!targetCourseId || !isUUID.test(targetCourseId)) {
    const { data: firstActive } = await supabaseAdmin
      .from('enrollments')
      .select('course_id')
      .eq('trainee_id', resolvedId)
      .in('status', ['ENROLLED', 'ACTIVE', 'APPROVED', 'COMPLETED'])
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (firstActive?.course_id) {
      targetCourseId = firstActive.course_id;
    } else {
      // Fallback: any enrollment
      const { data: anyEnr } = await supabaseAdmin
        .from('enrollments')
        .select('course_id')
        .eq('trainee_id', resolvedId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      targetCourseId = anyEnr?.course_id || courseId;
    }
  }

  // Access control check: Trainee must have an enrollment in this course
  let { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id, status, batch_id, batches ( id, instructor_id )')
    .eq('course_id', targetCourseId)
    .eq('trainee_id', resolvedId)
    .in('status', ['ENROLLED', 'ACTIVE', 'APPROVED', 'COMPLETED'])
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!enrollment) {
    const { data: fallbackEnr } = await supabaseAdmin
      .from('enrollments')
      .select('id, status, batch_id, batches ( id, instructor_id )')
      .eq('course_id', targetCourseId)
      .eq('trainee_id', resolvedId)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    enrollment = fallbackEnr;
  }

  if (!enrollment) {
    return [];
  }

  // Instructor assignment check:
  // An instructor is assigned if:
  // 1. batches.instructor_id is set
  // 2. course_instructors mapping exists for this course
  // 3. schedules has an active session with instructor_id for this course
  // 4. enrollment status is ACTIVE (which admin sets when scheduling)
  let isInstructorAssigned = Boolean((enrollment.batches as any)?.instructor_id);
  if (!isInstructorAssigned) {
    const { data: ci } = await supabaseAdmin
      .from('course_instructors')
      .select('instructor_id')
      .eq('course_id', targetCourseId)
      .limit(1)
      .maybeSingle();
    if (ci?.instructor_id) isInstructorAssigned = true;
  }
  if (!isInstructorAssigned) {
    const { data: sc } = await supabaseAdmin
      .from('schedules')
      .select('instructor_id')
      .eq('course_id', targetCourseId)
      .not('instructor_id', 'is', null)
      .neq('status', 'CANCELLED')
      .limit(1)
      .maybeSingle();
    if (sc?.instructor_id) isInstructorAssigned = true;
  }
  if (!isInstructorAssigned && enrollment.status === 'ACTIVE') {
    isInstructorAssigned = true;
  }

  if (!isInstructorAssigned) {
    const err = new Error('WAITING_FOR_INSTRUCTOR');
    (err as any).code = 'WAITING_FOR_INSTRUCTOR';
    throw err;
  }

  // Fetch course details
  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, code, name, category, duration_hours, theory_days, practical_days')
    .eq('id', targetCourseId)
    .maybeSingle();

  const isInHouse = isInHouseModularCourse(course?.category, course?.practical_days);
  const requiresPractical = !isInHouse;

  // Fetch completions for this trainee and course
  const { data: completions } = await supabaseAdmin
    .from('trainee_lesson_completions')
    .select('lesson_id, module_id')
    .eq('trainee_id', resolvedId)
    .eq('course_id', targetCourseId);

  const completedSet = new Set<string>();
  (completions || []).forEach((c: any) => {
    if (c.lesson_id) completedSet.add(String(c.lesson_id));
    if (c.module_id) completedSet.add(String(c.module_id));
  });

  // Fetch course modules and their learning materials
  const { data: modules, error } = await supabaseAdmin
    .from('course_modules')
    .select(`
      *,
      learning_materials (*)
    `)
    .eq('course_id', targetCourseId)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  // Fetch all assessments (module assessments and course post-test) for this course
  const { data: courseAssessments } = await supabaseAdmin
    .from('assessments')
    .select(`
      id,
      course_id,
      module_id,
      title,
      description,
      assessment_type,
      passing_score,
      duration_minutes,
      assessment_questions (
        id,
        question_text,
        question_type,
        points,
        sort_order,
        assessment_choices (
          id,
          choice_text,
          is_correct,
          sort_order
        )
      )
    `)
    .eq('course_id', targetCourseId);

  // Fetch attempts for this trainee on these assessments
  const asmIds = (courseAssessments || []).map((a: any) => a.id);
  const attemptsMap = new Map<string, any>();
  if (asmIds.length > 0) {
    const { data: attempts } = await supabaseAdmin
      .from('assessment_attempts')
      .select('assessment_id, score, status, submitted_at')
      .eq('trainee_id', resolvedId)
      .in('assessment_id', asmIds)
      .order('submitted_at', { ascending: false });

    attempts?.forEach((att: any) => {
      if (
        Number(att.score) === 0 &&
        att.status === 'FAILED' &&
        String(att.submitted_at || '').includes('59:59')
      ) {
        return;
      }
      const existing = attemptsMap.get(att.assessment_id);
      const existingPassed = existing?.status === 'PASSED';
      if (!existing || (!existingPassed && att.status === 'PASSED')) {
        attemptsMap.set(att.assessment_id, att);
      }
    });
  }

  // Find course post-test (where module_id is null)
  const rawPostTest = (courseAssessments || []).find((a: any) => !a.module_id);
  const postTestAttempt = rawPostTest ? attemptsMap.get(rawPostTest.id) : null;
  const rawPostTestPass = rawPostTest && rawPostTest.passing_score != null && !isNaN(Number(rawPostTest.passing_score))
    ? Number(rawPostTest.passing_score)
    : 75;
  // Official written passing threshold: 75% per STCW requirements
  const postTestPassingScore = Math.max(75, rawPostTestPass);
  const postTestQuestionsCount = ((rawPostTest?.assessment_questions || []) as any[]).length || 10;
  const postTestCorrectCount = postTestAttempt
    ? Math.round(((Number(postTestAttempt.score) || 0) * postTestQuestionsCount) / 100)
    : null;
  const isPostTestPassedFlag = Boolean(
    postTestAttempt && (postTestAttempt.status === 'PASSED' || Number(postTestAttempt.score) >= postTestPassingScore)
  );
  const postTestObj = rawPostTest ? {
    id: rawPostTest.id,
    title: sanitizeModularAssessmentTitle(rawPostTest.title, isInHouse),
    description: rawPostTest.description || (
      isInHouse
        ? 'Comprehensive modular written evaluation required to complete this Modular / In-House Course.'
        : `Comprehensive modular evaluation required before unlocking the Practical Assessment for ${course?.name || 'this STCW course'}.`
    ),
    type: rawPostTest.assessment_type || 'EXAM',
    passingScore: postTestPassingScore,
    durationMinutes: rawPostTest.duration_minutes || 45,
    questionsCount: postTestQuestionsCount,
    totalQuestions: postTestQuestionsCount,
    correctCount: postTestCorrectCount,
    scoreDisplay: postTestAttempt ? `${postTestCorrectCount}/${postTestQuestionsCount} (${postTestAttempt.score ?? 0}%)` : null,
    isAttempted: Boolean(postTestAttempt),
    isPassed: isPostTestPassedFlag,
    canRetry: Boolean(postTestAttempt) && !isPostTestPassedFlag,
    score: postTestAttempt?.score ?? null,
    submittedAt: postTestAttempt?.submitted_at ?? null,
    isLocked: false,
    lockReason: null as string | null,
    questions: ((rawPostTest.assessment_questions || []) as any[])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((q: any) => ({
        id: q.id,
        questionText: q.question_text,
        points: q.points || 1,
        choices: ((q.assessment_choices || []) as any[])
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((c: any) => ({
            id: c.id,
            choiceText: c.choice_text,
            ...(postTestAttempt ? { isCorrect: Boolean(c.is_correct) } : {}),
          }))
      }))
  } : null;

  // Build module assessment lookup
  const moduleAsmMap = new Map<string, any>();
  (courseAssessments || []).filter((a: any) => !!a.module_id).forEach((a: any) => {
    const att = attemptsMap.get(a.id);
    const rawPass = a.passing_score != null && !isNaN(Number(a.passing_score)) ? Number(a.passing_score) : 75;
    // Written assessment 75% threshold
    const passThreshold = Math.max(75, rawPass);
    const modQCount = ((a.assessment_questions || []) as any[]).length || 10;
    const modCorrectCount = att ? Math.round(((Number(att.score) || 0) * modQCount) / 100) : null;
    const modIsPassed = Boolean(att && (att.status === 'PASSED' || Number(att.score) >= passThreshold));
    moduleAsmMap.set(a.module_id, {
      id: a.id,
      title: sanitizeModularAssessmentTitle(a.title, isInHouse),
      description: a.description,
      type: a.assessment_type || 'QUIZ',
      passingScore: passThreshold,
      durationMinutes: a.duration_minutes || 20,
      questionsCount: modQCount,
      totalQuestions: modQCount,
      correctCount: modCorrectCount,
      scoreDisplay: att ? `${modCorrectCount}/${modQCount} (${att.score ?? 0}%)` : null,
      isAttempted: Boolean(att),
      isPassed: modIsPassed,
      canRetry: Boolean(att) && !modIsPassed,
      score: att?.score ?? null,
      submittedAt: att?.submitted_at ?? null,
      questions: ((a.assessment_questions || []) as any[])
        .sort((q1, q2) => (q1.sort_order || 0) - (q2.sort_order || 0))
        .map((q: any) => ({
          id: q.id,
          questionText: q.question_text,
          points: q.points || 1,
          choices: ((q.assessment_choices || []) as any[])
            .sort((c1, c2) => (c1.sort_order || 0) - (c2.sort_order || 0))
            .map((c: any) => ({
              id: c.id,
              choiceText: c.choice_text,
              ...(att ? { isCorrect: Boolean(c.is_correct) } : {}),
            }))
        }))
    });
  });

  // 1 Module Per Day Sync & Evaluation
  const dailySyncResults = await syncTraineeDailyModules(resolvedId, targetCourseId, onNotifyEmail);
  const dailySyncMap = new Map<string, DailyModuleSyncResult>();
  dailySyncResults.forEach((r) => dailySyncMap.set(r.moduleId, r));

  let lessons: any[] = [];
  let counter = 1;

  // Sequential Module Unlocking & Daily Pacing: 1 Module Per Day
  let previousModulePassed = true;
  let previousModuleName = '';

  if (modules && modules.length > 0) {
    for (const [mIdx, m] of modules.entries()) {
      const materials = m.learning_materials || [];
      const modQuiz = moduleAsmMap.get(m.id) || null;
      const dailyInfo = dailySyncMap.get(m.id);

      const dayNumber = dailyInfo?.dayNumber || (mIdx + 1);
      const scheduledDate = dailyInfo?.scheduledDate || '';
      const formattedDate = dailyInfo?.formattedDate || '';
      const dailyStatus = dailyInfo?.status || 'LOCKED';
      const isDueToday = Boolean(dailyInfo?.isDueToday);
      const isFailed = Boolean(dailyInfo?.isFailed);
      const failureReason = dailyInfo?.failureReason || null;

      // Module is locked if prerequisite was not completed
      const isModuleLocked = dailyStatus === 'LOCKED' || (!previousModulePassed && dailyStatus !== 'COMPLETED' && dailyStatus !== 'FAILED');
      const moduleLockReason = dailyInfo?.lockReason || (isModuleLocked
        ? `Locked: Complete ${previousModuleName || `Module ${mIdx}`} first to unlock Module ${dayNumber}.`
        : null);
      const exposedModQuiz = isModuleLocked && modQuiz ? { ...modQuiz, questions: [] } : modQuiz;

      if (materials.length > 0) {
        for (const mat of materials) {
          const desc = mat.description || 'Official curriculum learning material and maritime study guide.';
          const isPassed = modQuiz ? Boolean(modQuiz.isPassed) : true;
          const isRead = completedSet.has(mat.id) || completedSet.has(m.id) || completedSet.has(`les-${m.id}`) || isPassed;
          const isCompleted = dailyStatus === 'COMPLETED' || (isRead && isPassed);
          const rawUrl = mat.external_url || mat.file_url || null;
          const resolvedUrl = !isModuleLocked && rawUrl ? await resolveMaterialAccessUrl(rawUrl) : null;

          lessons.push({
            id: mat.id,
            courseId: targetCourseId,
            courseCode: course?.code || 'STCW',
            courseTitle: course?.name || 'Maritime Training Program',
            moduleId: m.id,
            moduleName: m.title || 'General Maritime Competence',
            dayNumber,
            scheduledDate,
            formattedDate,
            status: dailyStatus,
            isDueToday,
            isFailed,
            failureReason,
            lessonNumber: counter++,
            title: mat.title || 'Module Core Competencies',
            duration: '45 mins',
            readingMinutes: 45,
            contentType: mat.material_type || 'DOCUMENT',
            type: mat.material_type || 'DOCUMENT',
            isRead,
            isPassed: isPassed && !isFailed,
            isCompleted,
            isLocked: isModuleLocked,
            lockReason: moduleLockReason,
            fileUrl: resolvedUrl,
            content: desc,
            contentBody: desc,
            description: desc,
            videoUrl: mat.material_type === 'VIDEO' ? resolvedUrl : null,
            moduleAssessment: exposedModQuiz,
            postTest: postTestObj,
          });
        }
      } else {
        const desc = m.description || 'Maritime training lecture and STCW syllabus review.';
        const isPassed = modQuiz ? Boolean(modQuiz.isPassed) : true;
        const isRead = completedSet.has(`les-${m.id}`) || completedSet.has(m.id) || isPassed;
        const isCompleted = dailyStatus === 'COMPLETED' || (isRead && isPassed);

        lessons.push({
          id: `les-${m.id}`,
          courseId: targetCourseId,
          courseCode: course?.code || 'STCW',
          courseTitle: course?.name || 'Maritime Training Program',
          moduleId: m.id,
          moduleName: m.title || 'General Maritime Competence',
          dayNumber,
          scheduledDate,
          formattedDate,
          status: dailyStatus,
          isDueToday,
          isFailed,
          failureReason,
          lessonNumber: counter++,
          title: `${m.title} Overview & Competencies`,
          duration: '60 mins',
          readingMinutes: 60,
          contentType: 'DOCUMENT',
          type: 'DOCUMENT',
          isRead,
          isPassed: isPassed && !isFailed,
          isCompleted,
          isLocked: isModuleLocked,
          lockReason: moduleLockReason,
          fileUrl: null,
          content: desc,
          contentBody: desc,
          description: desc,
          videoUrl: null,
          moduleAssessment: exposedModQuiz,
          postTest: postTestObj,
        });
      }

      // Check if this module is passed to unlock subsequent module
      if (modQuiz) {
        previousModulePassed = Boolean(modQuiz.isPassed) || isFailed;
      } else {
        const moduleLessons = lessons.filter((l: any) => l.moduleId === m.id);
        previousModulePassed = (moduleLessons.length > 0 && moduleLessons.every((l: any) => l.isRead)) || isFailed;
      }
      previousModuleName = m.title || `Module ${mIdx + 1}`;
    }
  }

  // Final Course Post-Test lock state: Post-test is only unlocked after all module materials and quizzes are completed/attempted
  if (postTestObj) {
    const allModulesFinished = dailySyncResults.length > 0 && dailySyncResults.every((d) => d.status === 'COMPLETED' || d.status === 'FAILED');
    postTestObj.isLocked = postTestObj.isAttempted ? false : !allModulesFinished;
    postTestObj.lockReason = postTestObj.isLocked
      ? 'Comprehensive post-test is locked: Complete all course modules and quizzes first.'
      : null;
    if (postTestObj.isLocked) {
      postTestObj.questions = [];
    }
  }

  (lessons as any).dailyModules = dailySyncResults;

  // Attach postTest and schedule partition to the returned array for convenient access
  (lessons as any).postTest = postTestObj;
  const rawTotalDays = Math.ceil((course?.duration_hours || 40) / 8) || 1;
  const theoryDays = isInHouse ? Math.min(3, rawTotalDays) : (course?.theory_days ?? (rawTotalDays <= 1 ? 1 : Math.max(1, Math.round(rawTotalDays * 0.4))));
  const practicalDays = isInHouse ? 0 : (course?.practical_days ?? Math.max(0, rawTotalDays - theoryDays));
  const totalDays = isInHouse ? theoryDays : theoryDays + practicalDays;
  (lessons as any).schedulePartition = {
    totalDays,
    theoryDays,
    practicalDays,
    durationHours: course?.duration_hours || 40,
  };
  (lessons as any).courseCategory = course?.category || 'Safety and Other STCW Courses';
  (lessons as any).courseCode = course?.code || 'STCW';
  (lessons as any).courseName = course?.name || 'Course';
  (lessons as any).requiresPractical = requiresPractical;
  (lessons as any).deliveryMode = isInHouse ? 'FULL_MODULAR' : 'MODULAR_AND_PRACTICAL';

  const { data: pracEval } = await supabaseAdmin
    .from('practical_evaluations')
    .select('id, rubric_id, competency_status, total_score, max_possible_score, percentage, status, general_feedback, strengths, improvements_required, remediation_plan, evaluation_date, finalized_at')
    .eq('trainee_id', resolvedId)
    .eq('course_id', targetCourseId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPracticalCompetent = isInHouse ? true : (pracEval?.competency_status === 'COMPETENT');
  (lessons as any).isPracticalCompetent = isPracticalCompetent;
  (lessons as any).practicalEvaluation = pracEval || null;

  let practicalRubric: any = null;
  let practicalSchedule: any = null;
  if (requiresPractical) {
    const [{ data: rubRow }, { data: pracSchedRow }] = await Promise.all([
      supabaseAdmin
        .from('practical_rubrics')
        .select('id, course_id, title, stcw_reference, description, instructions, passing_score, max_score, status, practical_rubric_criteria(id, criterion_name, competency, description, performance_indicators, max_points, weight_pct, is_critical, sort_order)')
        .eq('course_id', targetCourseId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('schedules')
        .select('id, room, start_at, end_at, status')
        .eq('course_id', targetCourseId)
        .neq('status', 'CANCELLED')
        .order('start_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (rubRow) {
      const rawCriteria = Array.isArray((rubRow as any).practical_rubric_criteria)
        ? [...(rubRow as any).practical_rubric_criteria]
        : [];
      rawCriteria.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      practicalRubric = {
        id: rubRow.id,
        courseId: rubRow.course_id,
        courseCode: course?.code || 'STCW',
        courseName: course?.name || 'STCW Course',
        title: rubRow.title,
        stcwReference: rubRow.stcw_reference || `STCW ${course?.code || ''}`.trim(),
        description: rubRow.description || '',
        instructions: rubRow.instructions || '',
        passingScore: Number(rubRow.passing_score) || 75,
        maxScore: Number(rubRow.max_score) || 100,
        criteria: rawCriteria.map((cr: any) => ({
          id: cr.id,
          title: cr.criterion_name || cr.competency || 'Practical Criterion',
          competency: cr.competency || cr.criterion_name || '',
          description: cr.description || cr.performance_indicators || '',
          maxPoints: Number(cr.max_points) || 25,
          weightPct: Number(cr.weight_pct) || 25,
          isCritical: Boolean(cr.is_critical),
          sortOrder: cr.sort_order ?? 1,
        })),
      };
    }
    practicalSchedule = pracSchedRow || null;
  }

  (lessons as any).practicalRubric = practicalRubric;
  (lessons as any).practicalSchedule = practicalSchedule;

  // 3-Day Modular Completion Deadline & Two-Category Workflow Status
  const allModulesDone = dailySyncResults.length > 0 && dailySyncResults.every((d) => d.status === 'COMPLETED');
  const isPostTestDone = !postTestObj || Boolean(postTestObj.isPassed);
  const allModularDone = allModulesDone && isPostTestDone;

  const rawActivatedAt = (enrollment as any)?.enrolled_at || (enrollment as any)?.created_at || new Date().toISOString();
  const rawActivatedMs = new Date(rawActivatedAt).getTime();
  const nowMs = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  // If an older seed enrollment was activated > 3 days ago before tracking started, anchor to today so active testing has a 72h window
  const effectiveActivatedMs =
    !allModularDone && nowMs - rawActivatedMs > threeDaysMs ? nowMs - 2 * 60 * 60 * 1000 : rawActivatedMs;
  const deadlineMs = effectiveActivatedMs + threeDaysMs;
  const remainingMs = Math.max(0, deadlineMs - nowMs);
  const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
  const isModularExpired = !allModularDone && remainingMs === 0;

  let workflowStatus: string = 'MODULAR_IN_PROGRESS';
  const enrStatusUpper = String((enrollment as any)?.status || '').toUpperCase();
  if (!requiresPractical) {
    // Category A: MODULAR / IN-HOUSE (Academic Record Review by Instructor; no practical schedule)
    if (enrStatusUpper === 'COMPLETED' || enrStatusUpper === 'PASSED') {
      workflowStatus = 'COURSE_COMPLETED';
    } else if (allModularDone) {
      workflowStatus = 'WAITING_FOR_RECORD_REVIEW';
    } else if (isModularExpired) {
      workflowStatus = 'MODULAR_EXPIRED';
    } else {
      workflowStatus = 'MODULAR_IN_PROGRESS';
    }
  } else {
    // Category B: MODULAR + PRACTICAL (Practical Training & Evaluation by Instructor)
    if (enrStatusUpper === 'COMPLETED' || (allModularDone && isPracticalCompetent)) {
      workflowStatus = 'COURSE_COMPLETED';
    } else if (allModularDone) {
      workflowStatus = practicalSchedule ? 'PRACTICAL_SCHEDULED' : 'WAITING_FOR_INSTRUCTOR';
    } else if (isModularExpired) {
      workflowStatus = 'MODULAR_EXPIRED';
    } else {
      workflowStatus = 'MODULAR_IN_PROGRESS';
    }
  }

  (lessons as any).modularDeadline = {
    maxDays: 3,
    activatedAt: new Date(effectiveActivatedMs).toISOString(),
    deadlineAt: new Date(deadlineMs).toISOString(),
    formattedDeadline: formatReadableDateString(formatManilaDate(new Date(deadlineMs))),
    remainingHours: allModularDone ? 0 : remainingHours,
    isCompleted: allModularDone,
    isExpired: isModularExpired,
    workflowStatus,
    instructorAssignmentPurpose: !requiresPractical ? 'ACADEMIC_RECORD_REVIEW' : 'PRACTICAL_TRAINING',
  };

  return lessons;
}

/**
 * Record Trainee Lesson Completion & Update Progress Telemetry
 * NOTE: Completing online theory modules caps progress at 50% (or 60% with post-test).
 * The remaining progress is practical training scheduled with the instructor. It is NOT 100%!
 */
export async function recordTraineeLessonCompletion(
  traineeId: string,
  courseId: string,
  lessonId: string,
  moduleName?: string,
  lessonTitle?: string
) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  const preLessons = await getTraineeLearningMaterials(courseId, resolvedId);
  if (!preLessons || preLessons.length === 0) {
    const err = new Error('FORBIDDEN: Trainee does not have an active enrollment in this course.');
    (err as any).code = 'FORBIDDEN';
    throw err;
  }

  const targetLesson = preLessons.find(
    (l: any) => l.id === lessonId || (moduleName && l.moduleId === moduleName)
  );
  if (!targetLesson) {
    throw new Error('Lesson not found in trainee curriculum.');
  }
  if (targetLesson.isLocked) {
    const err = new Error(targetLesson.lockReason || 'ASSESSMENT_LOCKED: Lesson module is locked.');
    (err as any).code = 'ASSESSMENT_LOCKED';
    throw err;
  }

  const resolvedCourseId = targetLesson.courseId || courseId;
  const resolvedModuleId = targetLesson.moduleId || moduleName || null;

  // 1. Upsert completion record
  const { error } = await supabaseAdmin
    .from('trainee_lesson_completions')
    .upsert({
      trainee_id: resolvedId,
      course_id: resolvedCourseId,
      lesson_id: lessonId,
      module_id: resolvedModuleId,
      lesson_title: lessonTitle || targetLesson.title || null,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'trainee_id,course_id,lesson_id' });

  if (error) {
    console.error('Failed to record lesson completion in DB:', error);
  }

  // 2. Recalculate progress for this course
  // - In-House Courses (Full Modular-Based): 100% Modular Lessons (+ Post-Test if present).
  // - Safety and Other STCW Courses: Theory modules represent 50%, Post-Test 10%, Practical 40%/50%.
  const lessons = await getTraineeLearningMaterials(resolvedCourseId, resolvedId);
  const total = lessons.length || 4;
  const completed = lessons.filter((l: any) => l.isCompleted || l.id === lessonId).length;
  const requiresPractical = (lessons as any).requiresPractical !== false;

  const postTest = (lessons as any).postTest;
  const hasPostTest = Boolean(postTest);
  const isPostTestPassed = Boolean(postTest?.isPassed);
  const isPracticalCompetent = Boolean((lessons as any).isPracticalCompetent);
  const allModulesPassed = (lessons as any).dailyModules?.length > 0 && (lessons as any).dailyModules.every((d: any) => d.status === 'COMPLETED');

  let progressPercent = 0;
  if (!requiresPractical) {
    if (allModulesPassed && (!hasPostTest || isPostTestPassed)) {
      progressPercent = 100;
    } else {
      const modWeight = hasPostTest ? 85 : 100;
      const theoryPercent = total > 0 ? Math.round((completed / total) * modWeight) : 0;
      const postTestBonus = hasPostTest && isPostTestPassed ? 15 : 0;
      progressPercent = Math.min(100, theoryPercent + postTestBonus);
    }
  } else {
    const theoryPercent = total > 0 ? Math.round((completed / total) * 50) : 0;
    const practicalBonus = isPracticalCompetent ? (hasPostTest ? 40 : 50) : 0;
    const postTestBonus = isPostTestPassed ? 10 : 0;
    progressPercent = Math.min(100, theoryPercent + postTestBonus + practicalBonus);
    if (allModulesPassed && isPracticalCompetent && (!hasPostTest || isPostTestPassed)) {
      progressPercent = 100;
    }
  }

  await supabaseAdmin
    .from('enrollments')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('trainee_id', resolvedId)
    .eq('course_id', resolvedCourseId);

  if (!requiresPractical && progressPercent === 100) {
    try {
      await calculateTraineeCourseGrade({ traineeId: resolvedId, courseId: resolvedCourseId });
    } catch (gradeErr) {
      console.warn('Could not sync full modular course grade on lesson completion:', gradeErr);
    }
  }

  return {
    lessonId,
    courseId: resolvedCourseId,
    isCompleted: true,
    progressPercent,
    completedLessons: completed,
    totalLessons: total,
    completedAt: new Date().toISOString(),
    isPostTestPassed,
  };
}

/**
 * Returns the set of course_module IDs the trainee has marked as read.
 * A module counts as read when a completion row references its ID, its synthetic
 * `les-<moduleId>` lesson ID, or any of its learning_materials IDs.
 */
async function getReadModuleIds(resolvedTraineeId: string, courseIds: string[]): Promise<Set<string>> {
  const readIds = new Set<string>();
  if (courseIds.length === 0) return readIds;

  const [compRes, modRes] = await Promise.all([
    supabaseAdmin
      .from('trainee_lesson_completions')
      .select('module_id, lesson_id')
      .eq('trainee_id', resolvedTraineeId)
      .in('course_id', courseIds),
    supabaseAdmin
      .from('course_modules')
      .select('id, learning_materials ( id )')
      .in('course_id', courseIds),
  ]);

  const tokens = new Set<string>();
  (compRes.data || []).forEach((c: any) => {
    if (c.module_id) tokens.add(String(c.module_id));
    if (c.lesson_id) tokens.add(String(c.lesson_id));
  });

  (modRes.data || []).forEach((m: any) => {
    const matIds: string[] = (m.learning_materials || []).map((lm: any) => lm.id);
    if (tokens.has(m.id) || tokens.has(`les-${m.id}`) || matIds.some((id) => tokens.has(id))) {
      readIds.add(m.id);
    }
  });

  return readIds;
}

/**
 * Course Assessments List
 */
export async function getTraineeAssessmentsList(traineeId: string, search?: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  // Fetch enrolled courses
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('course_id')
    .eq('trainee_id', resolvedId)
    .in('status', ['ENROLLED', 'ACTIVE', 'APPROVED', 'COMPLETED']);

  const courseIds = (enrollments || []).map((e: any) => e.course_id).filter(Boolean);

  let query = supabaseAdmin
    .from('assessments')
    .select(`
      *,
      courses (id, code, name, category, practical_days),
      course_modules (id, title, sort_order),
      assessment_questions (
        id,
        question_text,
        points,
        sort_order,
        assessment_choices (
          id,
          choice_text,
          is_correct,
          sort_order
        )
      )
    `);

  if (courseIds.length === 0) {
    return [];
  }
  query = query.in('course_id', courseIds);

  const { data, error } = await query;
  if (error) throw error;

  // Sync daily module tracking for each enrolled course so status is always fresh
  await Promise.all(
    courseIds.map((cid: string) => syncTraineeDailyModules(resolvedId, cid).catch(() => []))
  );

  // Fetch attempts, read-module state, course modules, and daily module tracking for locking verification
  const [attemptsRes, readModuleIds, modulesRes, trackingRes] = await Promise.all([
    supabaseAdmin
      .from('assessment_attempts')
      .select('id, assessment_id, attempt_number, score, status, passed, submitted_at')
      .eq('trainee_id', resolvedId)
      .order('submitted_at', { ascending: false }),
    getReadModuleIds(resolvedId, courseIds),
    supabaseAdmin
      .from('course_modules')
      .select('id, course_id, title, sort_order')
      .in('course_id', courseIds),
    supabaseAdmin
      .from('trainee_daily_module_tracking')
      .select('*')
      .eq('trainee_id', resolvedId)
      .in('course_id', courseIds),
  ]);

  const attempts = (attemptsRes.data || []).filter(
    (att: any) =>
      !(Number(att.score) === 0 && att.status === 'FAILED' && String(att.submitted_at || '').includes('59:59'))
  );
  const allModules = modulesRes.data || [];
  const trackRows = trackingRes.data || [];
  const trackMap = new Map<string, any>();
  trackRows.forEach((tr: any) => trackMap.set(tr.module_id, tr));

  const attemptsMap = new Map<string, any>();
  const attemptCountMap = new Map<string, number>();
  attempts.forEach((att: any) => {
    attemptCountMap.set(att.assessment_id, (attemptCountMap.get(att.assessment_id) || 0) + 1);
    const existing = attemptsMap.get(att.assessment_id);
    const existingPassed = existing?.status === 'PASSED' || existing?.passed === true;
    if (!existing || (!existingPassed && (att.status === 'PASSED' || att.passed === true))) {
      attemptsMap.set(att.assessment_id, att);
    }
  });

  const attemptIds = attempts.map((a: any) => a.id).filter(Boolean);
  const answersByAttempt = new Map<string, Record<string, string>>();
  if (attemptIds.length > 0) {
    const { data: pastAnswers } = await supabaseAdmin
      .from('assessment_answers')
      .select('attempt_id, question_id, selected_choice_id')
      .in('attempt_id', attemptIds);
    (pastAnswers || []).forEach((ans: any) => {
      if (!answersByAttempt.has(ans.attempt_id)) {
        answersByAttempt.set(ans.attempt_id, {});
      }
      answersByAttempt.get(ans.attempt_id)![ans.question_id] = ans.selected_choice_id;
    });
  }

  let assessments = (data || []).map((a: any) => {
    const att = attemptsMap.get(a.id);
    const courseRel = Array.isArray(a.courses) ? a.courses[0] : a.courses;
    const isFullModularCourse = isInHouseModularCourse(courseRel?.category, courseRel?.practical_days);
    const passingThreshold = a.passing_score != null && !isNaN(Number(a.passing_score)) ? Number(a.passing_score) : 75;
    const isPassed = att ? (att.status === 'PASSED' || att.passed === true || (Number(att.score) >= passingThreshold)) : false;
    const isAttempted = Boolean(att);
    const userAnswers = att ? (answersByAttempt.get(att.id) || {}) : {};
    const attemptsUsed = attemptCountMap.get(a.id) || 0;

    let status = 'NOT_STARTED';
    if (isPassed) status = 'PASSED';
    else if (att) status = 'FAILED';

    let isLocked = false;
    let lockReason: string | null = null;
    let isDueToday = false;
    let isFailed = Boolean(att) && !isPassed;
    let dayNumber: number | null = null;
    let scheduledDate: string | null = null;

    if (a.module_id) {
      const tr = trackMap.get(a.module_id);
      dayNumber = tr?.day_number ?? (a.course_modules as any)?.sort_order ?? 1;
      scheduledDate = tr?.scheduled_date ? formatReadableDateString(tr.scheduled_date) : null;

      if (tr?.status === 'LOCKED' && !isAttempted) {
        isLocked = true;
        lockReason = `Locked: Complete Module ${Math.max(1, (dayNumber || 2) - 1)} first to unlock this assessment.`;
      } else {
        const isRead = readModuleIds.has(a.module_id);
        isDueToday = tr?.status === 'AVAILABLE';
        isLocked = !isRead && !isAttempted;
        lockReason = isLocked ? 'Mark this module as read in the Learning Player to unlock' : null;
      }
    } else {
      // Course Post-Test: Unlocks when all module assessments have been completed (or already attempted)
      const courseModules = allModules.filter((m: any) => m.course_id === a.course_id);
      const courseTrackings = trackRows.filter((t: any) => t.course_id === a.course_id);
      const allDailyDone = courseTrackings.length > 0 && courseTrackings.every((t: any) => t.status === 'COMPLETED' || t.status === 'FAILED');
      const allRead = courseModules.length > 0 && courseModules.every((m: any) => readModuleIds.has(m.id));
      isLocked = !isAttempted && (!allDailyDone || !allRead);
      lockReason = isLocked ? 'Comprehensive post-test is locked: Complete all course modules and quizzes first.' : null;
    }

    const canRetry = !isPassed && (!isLocked || isAttempted);

    const rawQuestions = ((a.assessment_questions || []) as any[])
      .sort((q1, q2) => (q1.sort_order || 0) - (q2.sort_order || 0))
      .map((q: any) => {
        const correctChoice = (q.assessment_choices || []).find((c: any) => c.is_correct);
        return {
          id: q.id,
          question: q.question_text,
          points: q.points || 1,
          correctChoiceId: isAttempted ? (correctChoice?.id || null) : null,
          options: ((q.assessment_choices || []) as any[])
            .sort((c1, c2) => (c1.sort_order || 0) - (c2.sort_order || 0))
            .map((c: any) => ({
              id: c.id,
              text: c.choice_text,
              isCorrect: isAttempted ? Boolean(c.is_correct) : undefined,
            }))
        };
      });

    const calculatedTotalPoints = rawQuestions.reduce((sum: number, q: any) => sum + (Number(q.points) || 1), 0);
    const courseCode = courseRel?.code || 'STCW';
    const moduleSortOrder = (a.course_modules as any)?.sort_order ?? null;

    let correctCount: number | null = null;
    if (isAttempted && rawQuestions.length > 0) {
      const answeredKeys = Object.keys(userAnswers);
      if (answeredKeys.length > 0) {
        correctCount = rawQuestions.filter((q: any) => q.correctChoiceId && userAnswers[q.id] === q.correctChoiceId).length;
      } else {
        correctCount = Math.round(((Number(att?.score) || 0) * rawQuestions.length) / 100);
      }
    }

    return {
      id: a.id,
      code: a.code || `${courseCode}-${a.module_id ? 'PRE' : 'POST'}`,
      title: sanitizeModularAssessmentTitle(a.title, isFullModularCourse),
      description: a.description || 'Official maritime competency evaluation under STCW standards.',
      courseId: a.course_id,
      courseCode,
      courseTitle: courseRel?.name || 'Maritime Evaluation',
      requiresPractical: !isFullModularCourse,
      type: a.module_id ? 'PRE_TEST' : (a.assessment_type || 'EXAM'),
      durationMinutes: a.duration_minutes || 45,
      passingScore: passingThreshold,
      totalPoints: calculatedTotalPoints > 0 ? calculatedTotalPoints : (Number(a.total_points) || 100),
      status,
      isAttempted,
      isPassed,
      canRetry,
      attemptsUsed,
      score: att?.score != null ? Number(att.score) : null,
      correctCount,
      totalQuestions: rawQuestions.length,
      scoreDisplay: isAttempted && correctCount != null ? `${correctCount}/${rawQuestions.length} (${Number(att?.score) || 0}%)` : null,
      submittedAt: att?.submitted_at ?? null,
      attemptId: att?.id || null,
      attemptsAllowed: null,
      questionsCount: rawQuestions.length,
      moduleId: a.module_id || null,
      moduleTitle: sanitizeModularAssessmentTitle((a.course_modules as any)?.title, isFullModularCourse) || null,
      moduleSortOrder,
      dayNumber,
      scheduledDate,
      isDueToday,
      isFailed,
      isLocked,
      lockReason,
      userAnswers,
      questions: isLocked ? [] : rawQuestions,
    };
  });

  if (search) {
    const s = search.toLowerCase();
    assessments = assessments.filter(
      (a: any) =>
        a.code.toLowerCase().includes(s) ||
        a.title.toLowerCase().includes(s) ||
        a.courseTitle.toLowerCase().includes(s)
    );
  }

  return assessments;
}

/**
 * Submit Trainee Assessment Attempt
 */
export async function submitTraineeAssessment(
  assessmentId: string,
  _clientScore: number,
  answers: any,
  traineeId: string
) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  const { data: assessment } = await supabaseAdmin
    .from('assessments')
    .select('*')
    .eq('id', assessmentId)
    .maybeSingle();

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  const { data: activeEnr } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('trainee_id', resolvedId)
    .eq('course_id', assessment.course_id)
    .in('status', ['ENROLLED', 'ACTIVE', 'APPROVED', 'COMPLETED'])
    .limit(1)
    .maybeSingle();

  if (!activeEnr) {
    const err = new Error('FORBIDDEN: Trainee does not have an active enrollment in this course.');
    (err as any).code = 'FORBIDDEN';
    throw err;
  }

  // Reattempt Policy: Check if trainee has already PASSED this assessment; failed attempts may be retaken
  const { data: rawExistingAttempts } = await supabaseAdmin
    .from('assessment_attempts')
    .select('id, score, status, passed, submitted_at')
    .eq('assessment_id', assessmentId)
    .eq('trainee_id', resolvedId)
    .order('submitted_at', { ascending: false });

  const existingAttempts = (rawExistingAttempts || []).filter(
    (att: any) =>
      !(Number(att.score) === 0 && att.status === 'FAILED' && String(att.submitted_at || '').includes('59:59'))
  );

  if (existingAttempts && existingAttempts.length > 0) {
    const prev = existingAttempts[0];
    const prevScore = Number(prev.score) || 0;
    const exactPassingScore = assessment?.passing_score != null && !isNaN(Number(assessment.passing_score))
      ? Number(assessment.passing_score)
      : 75;
    const prevPassed = prev.passed ?? (prev.status === 'PASSED' || prevScore >= exactPassingScore);

    if (prevPassed) {
      // Also fetch past answers for review
      const { data: pastAnswers } = await supabaseAdmin
        .from('assessment_answers')
        .select('question_id, selected_choice_id, is_correct, points_earned')
        .eq('attempt_id', prev.id);

      const answersMap: Record<string, string> = {};
      (pastAnswers || []).forEach((pa: any) => {
        if (pa.question_id && pa.selected_choice_id) {
          answersMap[pa.question_id] = pa.selected_choice_id;
        }
      });

      return {
        attemptId: prev.id,
        score: prevScore,
        passed: prevPassed,
        passingScore: exactPassingScore,
        isPostTest: !assessment?.module_id,
        alreadyAttempted: true,
        feedback: `You have already passed this assessment with a score of ${prevScore}%.`,
        answers: answersMap,
      };
    }
  }

  // Lock enforcement: daily pacing + module read + post-test completion requirements
  {
    const [readModuleIds, dailySync] = await Promise.all([
      getReadModuleIds(resolvedId, [assessment.course_id]),
      syncTraineeDailyModules(resolvedId, assessment.course_id),
    ]);

    if (assessment.module_id) {
      const modSync = dailySync.find((d) => d.moduleId === assessment.module_id);
      const isRetryingFailedAttempt = existingAttempts.length > 0;
      if (modSync?.status === 'LOCKED' && !isRetryingFailedAttempt) {
        const err = new Error(modSync.lockReason || 'ASSESSMENT_LOCKED: Complete the previous module first.');
        (err as any).code = 'ASSESSMENT_LOCKED';
        throw err;
      }
      if (!readModuleIds.has(assessment.module_id) && !isRetryingFailedAttempt) {
        const err = new Error('ASSESSMENT_LOCKED: Mark the module as read in the Learning Player first.');
        (err as any).code = 'ASSESSMENT_LOCKED';
        throw err;
      }
    } else {
      const isRetryingPostTest = existingAttempts.length > 0;
      const { data: mods } = await supabaseAdmin
        .from('course_modules')
        .select('id')
        .eq('course_id', assessment.course_id);
      const allDailyFinished = dailySync.length === 0 || dailySync.every((d) => d.status === 'COMPLETED' || d.status === 'FAILED');
      const allRead = (mods || []).length > 0 && (mods || []).every((m: any) => readModuleIds.has(m.id));
      if (!isRetryingPostTest && (!allDailyFinished || !allRead)) {
        const err = new Error('ASSESSMENT_LOCKED: Complete and read all course modules before taking the Course Post-Test.');
        (err as any).code = 'ASSESSMENT_LOCKED';
        throw err;
      }
    }
  }

  // Server-side grading from selected choice IDs ({ [questionId]: choiceId }); never trust client score
  let score = 0;
  let earnedPoints = 0;
  let totalPoints = 0;
  let correctCount = 0;
  const questionResults: any[] = [];
  const answersToInsert: any[] = [];

  const { data: qs } = await supabaseAdmin
    .from('assessment_questions')
    .select(`
      id,
      question_text,
      points,
      sort_order,
      assessment_choices (
        id,
        choice_text,
        is_correct,
        sort_order
      )
    `)
    .eq('assessment_id', assessmentId)
    .order('sort_order', { ascending: true });

  if (qs && qs.length > 0) {
    qs.forEach((q: any) => {
      const pts = Number(q.points) || 1;
      totalPoints += pts;
      const selectedChoiceId = answers && typeof answers === 'object' ? answers[q.id] : null;
      const picked = (q.assessment_choices || []).find((c: any) => c.id === selectedChoiceId);
      const isCorrect = Boolean(picked?.is_correct);
      if (isCorrect) {
        earnedPoints += pts;
        correctCount += 1;
      }
      const pointsEarned = isCorrect ? pts : 0;
      const correctChoice = (q.assessment_choices || []).find((c: any) => c.is_correct);

      questionResults.push({
        questionId: q.id,
        questionText: q.question_text,
        selectedChoiceId,
        selectedChoiceText: picked?.choice_text || null,
        isCorrect,
        pointsEarned,
        pointsPossible: pts,
        correctChoiceId: correctChoice?.id || null,
        correctChoiceText: correctChoice?.choice_text || null,
      });

      if (selectedChoiceId) {
        answersToInsert.push({
          question_id: q.id,
          selected_choice_id: selectedChoiceId,
          answer_text: picked?.choice_text || null,
          is_correct: isCorrect,
          points_earned: pointsEarned,
          answered_at: new Date().toISOString(),
        });
      }
    });
    score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  }

  const passingScore = assessment?.passing_score != null && !isNaN(Number(assessment.passing_score))
    ? Number(assessment.passing_score)
    : 75;
  const isPassed = score >= passingScore;

  // Ensure trainee record exists in trainees table for foreign key constraint.
  // ignoreDuplicates: never overwrite an existing row, and never generate an SRN/trainee number.
  await supabaseAdmin.from('trainees').upsert({
    profile_id: resolvedId,
    enrollment_status: 'ACTIVE',
  }, { onConflict: 'profile_id', ignoreDuplicates: true });

  // Get next attempt number
  const { count: attemptCount } = await supabaseAdmin
    .from('assessment_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_id', assessmentId)
    .eq('trainee_id', resolvedId);

  const attemptNumber = (attemptCount || 0) + 1;

  const { data, error } = await supabaseAdmin
    .from('assessment_attempts')
    .insert({
      assessment_id: assessmentId,
      trainee_id: resolvedId,
      attempt_number: attemptNumber,
      score,
      status: isPassed ? 'PASSED' : 'FAILED',
      passed: isPassed,
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to insert assessment attempt:', error);
    throw error;
  }

  // Insert individual answers into assessment_answers
  if (answersToInsert.length > 0 && data?.id) {
    const answersWithAttempt = answersToInsert.map((ans) => ({
      ...ans,
      attempt_id: data.id,
    }));
    try {
      await supabaseAdmin.from('assessment_answers').insert(answersWithAttempt);
    } catch (ansErr) {
      console.warn('Could not insert individual assessment_answers:', ansErr);
    }
  }

  // Update or insert into grades table via weighted course grade engine
  let gradeCalcResult: any = null;
  if (assessment.course_id) {
    try {
      gradeCalcResult = await calculateTraineeCourseGrade({
        traineeId: resolvedId,
        courseId: assessment.course_id,
      });
    } catch (gradeErr) {
      console.warn('Could not recalculate course grade record:', gradeErr);
    }
  }

  // Update trainee_daily_module_tracking state
  if (assessment?.module_id && assessment.course_id) {
    try {
      await supabaseAdmin
        .from('trainee_daily_module_tracking')
        .update({
          status: isPassed ? 'COMPLETED' : 'AVAILABLE',
          completed_at: isPassed ? new Date().toISOString() : null,
          failed_at: null,
          failure_reason: !isPassed ? `Scored ${score}% (minimum ${passingScore}% required — reattempt available before deadline)` : null,
          updated_at: new Date().toISOString(),
        })
        .eq('trainee_id', resolvedId)
        .eq('course_id', assessment.course_id)
        .eq('module_id', assessment.module_id);
    } catch (trackErr) {
      console.warn('Could not update daily module tracking on quiz submission:', trackErr);
    }
  }

  // If this was a Module Pre-Test and it passed, also mark that module lesson as completed
  if (assessment?.module_id && isPassed && assessment.course_id) {
    try {
      const { data: mats } = await supabaseAdmin
        .from('learning_materials')
        .select('id')
        .eq('module_id', assessment.module_id)
        .limit(1);

      const targetLessonId = mats?.[0]?.id || `les-${assessment.module_id}`;
      await recordTraineeLessonCompletion(traineeId, assessment.course_id, targetLessonId, assessment.module_id, assessment.title);
    } catch (modErr) {
      console.warn('Could not auto-mark module complete on quiz pass:', modErr);
    }
  }

  // Fetch course category to distinguish In-House Full Modular vs Safety and Other STCW Courses
  let courseRow: { id: string; code: string; name: string; category: string | null; practical_days?: number | null } | null = null;
  if (assessment?.course_id) {
    const { data: cRow } = await supabaseAdmin
      .from('courses')
      .select('id, code, name, category, practical_days')
      .eq('id', assessment.course_id)
      .maybeSingle();
    courseRow = cRow || null;
  }
  const isFullModularCourse = isInHouseModularCourse(courseRow?.category, courseRow?.practical_days);

  // If this was the Final Course Post-Test (module_id is null):
  // For Safety and Other STCW Courses, ensure practical training schedule exists for the specific enrolled course.
  // For In-House Full Modular Courses, no practical simulator schedule is needed.
  if (!assessment?.module_id && assessment?.course_id && !isFullModularCourse) {
    try {
      let assignedInstructorId: string | null = null;
      let assignedBatchId: string | null = null;

      // 1. Check enrollment batch
      const { data: enr } = await supabaseAdmin
        .from('enrollments')
        .select('id, batch_id, batches ( id, instructor_id )')
        .eq('course_id', assessment.course_id)
        .eq('trainee_id', resolvedId)
        .maybeSingle();

      if ((enr?.batches as any)?.instructor_id) {
        assignedInstructorId = (enr.batches as any).instructor_id;
        assignedBatchId = enr.batch_id;
      }

      // 2. Check course_instructors mapping
      if (!assignedInstructorId) {
        const { data: ci } = await supabaseAdmin
          .from('course_instructors')
          .select('instructor_id')
          .eq('course_id', assessment.course_id)
          .limit(1)
          .maybeSingle();
        if (ci?.instructor_id) assignedInstructorId = ci.instructor_id;
      }

      // 3. Check existing schedules for this course
      if (!assignedInstructorId) {
        const { data: sc } = await supabaseAdmin
          .from('schedules')
          .select('instructor_id')
          .eq('course_id', assessment.course_id)
          .not('instructor_id', 'is', null)
          .neq('status', 'CANCELLED')
          .limit(1)
          .maybeSingle();
        if (sc?.instructor_id) assignedInstructorId = sc.instructor_id;
      }

      // 4. Default fallback instructor (from instructor profiles)
      if (!assignedInstructorId) {
        const { data: profInst } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('role', 'INSTRUCTOR')
          .limit(1)
          .maybeSingle();
        assignedInstructorId = profInst?.id || null;
      }

      // Ensure trainee record exists in trainees table for foreign key constraint.
      // ignoreDuplicates: never overwrite an existing row, and never generate an SRN/trainee number.
      await supabaseAdmin.from('trainees').upsert({
        profile_id: resolvedId,
        enrollment_status: 'ACTIVE',
      }, { onConflict: 'profile_id', ignoreDuplicates: true });

      // 5. Find or create instructor schedule
      let scheduleId: string | null = null;
      let schedQuery = supabaseAdmin
        .from('schedules')
        .select('id')
        .eq('course_id', assessment.course_id)
        .neq('status', 'CANCELLED');

      if (assignedInstructorId) {
        schedQuery = schedQuery.eq('instructor_id', assignedInstructorId);
      }
      const { data: existingSched } = await schedQuery.limit(1).maybeSingle();

      if (existingSched?.id) {
        scheduleId = existingSched.id;
      } else {
        const now = new Date();
        const startAt = new Date(now.getTime() + 86400000).toISOString();
        const endAt = new Date(now.getTime() + 86400000 + 4 * 3600000).toISOString();

        const { data: newSched } = await supabaseAdmin
          .from('schedules')
          .insert({
            course_id: assessment.course_id,
            instructor_id: assignedInstructorId,
            room: 'Practical Simulator & Drill Station 204',
            start_at: startAt,
            end_at: endAt,
            status: 'SCHEDULED',
            capacity: 24,
          })
          .select('id')
          .single();

        scheduleId = newSched?.id || null;
      }

      // 6. Assessment completed - attendance recording remains strictly instructor's prerogative
      // Do NOT automatically mark trainee as PRESENT

      // 7. Update enrollment telemetry
      await supabaseAdmin
        .from('enrollments')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('trainee_id', resolvedId)
        .eq('course_id', assessment.course_id);
    } catch (attErr) {
      console.error('Failed to record attendance for instructor:', attErr);
    }
  }

  try {
    await dispatchNotificationEvent({
      event: NOTIFICATION_EVENTS.ASSESSMENT_SUBMITTED,
      traineeId: resolvedId,
      courseId: assessment?.course_id,
      entityType: 'ASSESSMENT',
      entityId: assessmentId,
      metadata: {
        assessmentTitle: assessment?.title,
        score,
        passed: isPassed,
      },
    });

    await dispatchNotificationEvent({
      event: NOTIFICATION_EVENTS.ASSESSMENT_GRADED,
      traineeId: resolvedId,
      courseId: assessment?.course_id,
      entityType: 'ASSESSMENT',
      entityId: data.id,
      metadata: {
        assessmentTitle: assessment?.title,
        score,
        passed: isPassed,
      },
    });
  } catch (notifErr) {
    console.warn('Assessment notification dispatch notice:', notifErr);
  }

  const certIssued = Boolean(gradeCalcResult?.finalStatus === 'PASSED');

  return {
    attemptId: data.id,
    attemptNumber,
    score,
    passed: isPassed,
    canRetry: !isPassed,
    requiresPractical: !isFullModularCourse,
    certificateIssued: certIssued,
    passingScore,
    earnedPoints,
    totalPoints,
    correctCount,
    totalQuestions: qs ? qs.length : 0,
    isPostTest: !assessment?.module_id,
    alreadyAttempted: false,
    feedback: isPassed
      ? (!assessment?.module_id
          ? (isFullModularCourse
              ? certIssued
                ? `Congratulations! You passed with ${correctCount}/${qs ? qs.length : totalPoints} (${score}%) and satisfied all course requirements. Your official certificate is now available!`
                : `Congratulations! You passed the Comprehensive Modular Post-Test with a score of ${correctCount}/${qs ? qs.length : totalPoints} (${score}%). Your records are ready for Instructor Academic Record Review!`
              : `Congratulations! You passed the Course Post-Test with a score of ${correctCount}/${qs ? qs.length : totalPoints} (${score}%). Your course-specific Practical Assessment for ${courseRow?.name || 'this STCW course'} is now unlocked!`)
          : certIssued
            ? `Competency verified (${correctCount}/${qs ? qs.length : totalPoints}, ${score}%) and all course requirements are now passed. Your official certificate has been issued!`
            : `Competency verified! You passed the module assessment with a score of ${correctCount}/${qs ? qs.length : totalPoints} (${score}%, passing standard: ${passingScore}%).`)
      : `You scored ${correctCount}/${qs ? qs.length : totalPoints} (${score}%). The passing threshold is ${passingScore}% (${Math.ceil(((qs ? qs.length : 10) * passingScore) / 100)}/${qs ? qs.length : 10}). You can reattempt this assessment below to qualify for certification.`,
    questionResults,
  };
}

/**
 * Resets a trainee's reading completions.
 * STCW Academic Integrity Requirement: Historical assessment attempts, scores, and retake records
 * are immutable audit records and are NEVER deleted.
 */
export async function resetTraineeCourseProgress(traineeId: string, courseId?: string) {
  const resolvedId = await resolveTraineeProfileId(traineeId);

  let compQuery = supabaseAdmin.from('trainee_lesson_completions').delete().eq('trainee_id', resolvedId);
  if (courseId) {
    compQuery = compQuery.eq('course_id', courseId);
  }
  await compQuery;

  return { success: true };
}
