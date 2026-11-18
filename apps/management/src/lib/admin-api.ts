import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminRequest,
  getSessionFromRequest,
  createUnauthorizedResponse,
  createForbiddenResponse,
  resolveEffectivePermissionsForUser,
  type SuperAdminAuthResult,
} from '@newsim/auth';
import { hasModulePermission, isFinancialPermissionId } from '@newsim/utils';
import { supabaseAdmin, type UserRecord } from '@newsim/database';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const adminCenterCache = new Map<
  string,
  {
    centerId: string | null;
    centerName: string;
    permissions?: string[];
    expiresAt: number;
  }
>();
let cachedDefaultCenter: { centerId: string | null; expiresAt: number } | null = null;

export async function getDefaultCenterId(): Promise<string | null> {
  const now = Date.now();
  if (cachedDefaultCenter && cachedDefaultCenter.expiresAt > now) {
    return cachedDefaultCenter.centerId;
  }
  const { data: defaultCenter } = await supabaseAdmin
    .from('training_centers')
    .select('id')
    .limit(1)
    .maybeSingle();
  const centerId = defaultCenter?.id || null;
  cachedDefaultCenter = { centerId, expiresAt: now + CACHE_TTL_MS };
  return centerId;
}

export function invalidateAdminContextCache(userId?: string): void {
  if (userId) {
    adminCenterCache.delete(userId);
  } else {
    adminCenterCache.clear();
  }
}

export async function resolveAdminContextFromDb(userId: string): Promise<{
  centerId: string | null;
  centerName: string;
  permissions: string[];
}> {
  const [{ data: adminRow }, { data: profileRow }] = await Promise.all([
    supabaseAdmin
      .from('admins')
      .select('training_center_id, permissions, training_centers(name)')
      .eq('profile_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  const centerRel = unwrap(adminRow?.training_centers);
  const centerId = adminRow?.training_center_id || null;
  const centerName = centerRel?.name || 'NEWSIM Talisay Training Center';
  const rawAdminPermissions =
    adminRow?.permissions && Array.isArray(adminRow.permissions)
      ? adminRow.permissions
      : [];

  const resolvedRole =
    (profileRow?.role || '').toString().toUpperCase().replace(/[-\s]+/g, '_') === 'SUPER_ADMIN'
      ? 'SUPER_ADMIN'
      : 'ADMIN';

  const permissions = await resolveEffectivePermissionsForUser(
    userId,
    resolvedRole,
    resolvedRole === 'ADMIN' ? rawAdminPermissions : null
  );

  adminCenterCache.set(userId, {
    centerId,
    centerName,
    permissions,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return { centerId, centerName, permissions };
}

export async function resolveAdminCenterId(userId: string): Promise<string | null> {
  const now = Date.now();
  const cached = adminCenterCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.centerId;
  }
  const fresh = await resolveAdminContextFromDb(userId);
  return fresh.centerId;
}

export type AdminContext = {
  user: UserRecord;
  sessionId?: string;
  centerId: string | null;
  centerName: string;
  permissions: string[];
  hasFinancialAccess: boolean;
};

export function denyIfUnauthorized(auth: SuperAdminAuthResult) {
  if (auth.authorized && auth.user) return null;
  return auth.statusCode === 401
    ? createUnauthorizedResponse(auth.error)
    : createForbiddenResponse(auth.error);
}

export async function requireAdmin(
  req: NextRequest,
  options?: { permission?: string; requireFinancial?: boolean }
): Promise<AdminContext | NextResponse> {
  let auth = verifyAdminRequest(req, options?.permission);

  // If auth failed due to missing/expired admin payload (not an explicit permission denial), verify live profile status from DB
  if (!auth.authorized && auth.statusCode !== 403) {
    try {
      const session = getSessionFromRequest(req);
      const userId = session?.activeUser?.id || session?.userId;
      if (userId) {
        const { data: dbProfile } = await supabaseAdmin
          .from('profiles')
          .select('id, email, first_name, last_name, role, status')
          .eq('id', userId)
          .maybeSingle();

        if (dbProfile) {
          const normRole = (dbProfile.role || '').toString().trim().toUpperCase().replace(/[-\s]+/g, '_');
          const normStatus = (dbProfile.status || 'ACTIVE').toString().trim().toUpperCase();

          if (
            (normRole === 'ADMIN' ||
              normRole === 'SUPER_ADMIN' ||
              normRole === 'SUPERADMIN' ||
              normRole === 'ADMINISTRATOR') &&
            normStatus === 'ACTIVE'
          ) {
            auth = {
              authorized: true,
              user: {
                ...(session?.activeUser || ({} as UserRecord)),
                id: dbProfile.id,
                email: dbProfile.email || session?.email || '',
                username: dbProfile.email || '',
                firstName: dbProfile.first_name || '',
                lastName: dbProfile.last_name || '',
                role: normRole === 'SUPER_ADMIN' || normRole === 'SUPERADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
                status: 'ACTIVE',
              } as UserRecord,
              sessionId: session?.sessionId || `sess-admin-${dbProfile.id.slice(0, 8)}`,
            };
          }
        }
      }
    } catch (fallbackError) {
      console.warn('Fallback admin profile lookup error:', fallbackError);
    }
  }

  const denied = denyIfUnauthorized(auth);
  if (denied) return denied;

  const user = auth.user!;
  // Always verify live profile status & admin permissions from DB so revocations take effect immediately across lambdas
  const { data: liveProfile } = await supabaseAdmin
    .from('profiles')
    .select('status, role')
    .eq('id', user.id)
    .maybeSingle();

  if (liveProfile && (liveProfile.status || '').toUpperCase() !== 'ACTIVE') {
    return createForbiddenResponse(`Account is ${liveProfile.status}. Active status required.`);
  }

  const dbAdmin = await resolveAdminContextFromDb(user.id);
  let centerId: string | null = dbAdmin.centerId || user.assignedCenterId || null;
  const centerName = dbAdmin.centerName || 'Training Center';
  user.permissions = dbAdmin.permissions;

  if (user.role === 'SUPER_ADMIN') {
    centerId = null;
  }

  const perms = user.permissions || [];
  if (options?.permission) {
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const hasExplicitPerm = isSuperAdmin
      ? !isFinancialPermissionId(options.permission)
      : hasModulePermission(perms, options.permission, 'ADMIN');
    if (!hasExplicitPerm) {
      return createForbiddenResponse(`Insufficient permissions: ${options.permission} required.`);
    }
  }

  // Evaluate financial permissions strictly:
  // Super Admin is explicitly restricted from financial operations per specifications.
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const hasFinancialAccess =
    !isSuperAdmin &&
    (perms.includes('PAYMENT_VIEW') ||
      perms.includes('PAYMENT_VERIFY') ||
      perms.includes('FINANCIAL_REPORTS') ||
      perms.includes('FINANCIAL_ACCESS'));

  if (options?.requireFinancial) {
    if (isSuperAdmin) {
      return createForbiddenResponse(
        'Financial privacy restriction: Technical Super Administrators do not have access to payment records.'
      );
    }
    if (!hasFinancialAccess) {
      return createForbiddenResponse(
        'Insufficient permissions: Payment operations and financial records are restricted to authorized financial personnel.'
      );
    }
  }

  return { user, sessionId: auth.sessionId, centerId, centerName, permissions: perms, hasFinancialAccess };
}

export function isAdminContext(value: AdminContext | NextResponse): value is AdminContext {
  return !(value instanceof NextResponse);
}

export function unwrap<T = any>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

export function requestMeta(req: NextRequest) {
  return {
    ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
    userAgent: req.headers.get('user-agent') || 'NEWSIM Admin Portal',
  };
}

export async function writeAdminAudit(params: {
  actorId?: string;
  action: string;
  entityType?: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  const entityId = params.entityId && UUID_RE.test(params.entityId) ? params.entityId : null;
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: params.actorId || null,
    action: params.action,
    entity_type: params.entityType || 'ADMIN',
    entity_id: entityId,
    new_values: params.details || {},
    ip_address: params.ip || '127.0.0.1',
    user_agent: params.userAgent || 'NEWSIM Admin Portal',
  });
  if (error) {
    console.error('Failed to write admin audit log:', error);
  }
}

export function applyCenterFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  centerId: string | null,
  column = 'training_center_id'
) {
  return centerId ? query.eq(column, centerId) : query;
}

export function formatMoney(amount: number) {
  return `₱ ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function toUiEnrollmentStatus(status?: string | null) {
  const value = (status || '').toUpperCase().trim().replace(/\s+/g, '_');
  if (value === 'NEW' || value === 'DRAFT' || value === 'SUBMITTED') return 'NEW';
  if (value === 'PAYMENT_PENDING') return 'PAYMENT_PENDING';
  if (value === 'PENDING' || value === 'UNDER_REVIEW' || value === 'PENDING_REVIEW') return 'UNDER_REVIEW';
  if (value === 'QUALIFICATION_CHECK' || value === 'QUALIFICATION') return 'QUALIFICATION_CHECK';
  if (value === 'APPROVED') return 'APPROVED';
  if (value === 'ACTIVE' || value === 'ONGOING' || value === 'ENROLLED') return 'ENROLLED';
  if (value === 'COMPLETED' || value === 'GRADUATED') return 'COMPLETED';
  if (value === 'REJECTED') return 'REJECTED';
  if (value === 'CANCELLED' || value === 'CANCELED') return 'CANCELLED';
  return value || 'NEW';
}

export function toDbEnrollmentStatus(status?: string | null) {
  const value = (status || '').toUpperCase().trim().replace(/\s+/g, '_');
  if (value === 'ENROLLED') return 'ENROLLED';
  if (value === 'UNDER_REVIEW' || value === 'PENDING_REVIEW') return 'PENDING_REVIEW';
  if (value === 'PAYMENT_PENDING') return 'PAYMENT_PENDING';
  if (value === 'QUALIFICATION_CHECK') return 'QUALIFICATION_CHECK';
  if (value === 'APPROVED') return 'APPROVED';
  if (value === 'NEW') return 'PAYMENT_PENDING';
  if (value === 'COMPLETED') return 'COMPLETED';
  if (value === 'REJECTED') return 'REJECTED';
  if (value === 'CANCELLED' || value === 'CANCELED') return 'CANCELLED';
  return value;
}


export function toUiPaymentStatus(status?: string | null) {
  const value = (status || '').toUpperCase();
  if (value === 'PAID') return 'VERIFIED';
  if (value === 'FAILED' || value === 'CANCELLED') return 'REJECTED';
  return value || 'PENDING';
}

export function toDbPaymentStatus(status?: string | null) {
  const value = (status || '').toUpperCase();
  if (value === 'VERIFIED') return 'PAID';
  if (value === 'REJECTED') return 'FAILED';
  return value;
}

export function toUiCertificateStatus(status?: string | null) {
  const value = (status || '').toUpperCase();
  if (value === 'ACTIVE') return 'ISSUED';
  return value || 'PENDING';
}

export function toDbCertificateStatus(status?: string | null) {
  const value = (status || '').toUpperCase();
  if (value === 'ISSUED') return 'ACTIVE';
  return value;
}

export function formatProfileName(profile?: { first_name?: string; last_name?: string } | null) {
  return `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown';
}

export function formatTrainee(row: any) {
  const profile = unwrap(row.profiles) || {};
  const center = unwrap(row.training_centers);
  return {
    id: row.profile_id,
    firstName: profile.first_name || '',
    lastName: profile.last_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    avatarUrl: profile.avatar_url || null,
    srn: row.srn || '',
    rank: row.gender || 'Seafarer',
    vesselType: row.nationality || '',
    status: (profile.status || 'ACTIVE').toString().toUpperCase(),
    centerId: row.training_center_id || '',
    centerName: center?.name || '',
    enrollmentsCount: row.enrollmentsCount ?? 0,
    attendanceRate: row.attendanceRate || '—',
    certificatesCount: row.certificatesCount ?? 0,
    dateOfBirth: row.date_of_birth,
    address: row.address || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isFullModularCourseRow(row: any): boolean {
  const cat = String(row?.category || '').trim().toLowerCase();
  if (
    cat.includes('in-house') ||
    cat.includes('in house') ||
    (cat.includes('modular') && !cat.includes('practical')) ||
    cat.includes('online') ||
    cat.includes('theoretical')
  ) {
    return true;
  }
  if (row?.practical_days !== undefined && row?.practical_days !== null && Number(row.practical_days) === 0) {
    return true;
  }
  return false;
}

export function formatCourse(row: any) {
  const center = unwrap(row.training_centers);
  const instructors = Array.isArray(row.course_instructors) ? row.course_instructors : [];
  const firstInstructor = unwrap(unwrap(instructors[0])?.instructors);
  const instructorProfile = unwrap(firstInstructor?.profiles);
  const isFullModular = isFullModularCourseRow(row);
  const rawTotalDays = Math.ceil((row.duration_hours || 40) / 8) || 1;
  const theoryDays = isFullModular
    ? Math.min(3, rawTotalDays)
    : (row.theory_days ?? (rawTotalDays <= 1 ? 1 : Math.max(1, Math.round(rawTotalDays * 0.4))));
  const practicalDays = isFullModular
    ? 0
    : (row.practical_days ?? Math.max(0, rawTotalDays - theoryDays));
  const totalDays = isFullModular ? theoryDays : theoryDays + practicalDays;

  return {
    id: row.id,
    code: row.code || '',
    title: row.name || row.title || '',
    category: row.category || 'STCW Mandatory',
    description: row.description || '',
    durationHours: row.duration_hours || 40,
    trainingDays: totalDays,
    theoryDays,
    practicalDays,
    isFullModular,
    deliveryMode: isFullModular ? 'FULL_MODULAR' : 'MODULAR_AND_PRACTICAL',
    requiresPractical: !isFullModular,
    capacity: Math.min(Math.max(1, Number(row.capacity ?? 24)), 24),
    enrolledCount: row.enrolled_count ?? (Array.isArray(row.enrollments) ? row.enrollments.length : (row.enrolledCount ?? 0)),
    fee: Number(row.price || 0),
    prerequisites: [],
    instructorId: firstInstructor?.profile_id || '',
    instructorName: formatProfileName(instructorProfile) || 'Unassigned',
    instructorAvatarUrl: instructorProfile?.avatar_url || null,
    centerId: row.training_center_id || '',
    centerName: center?.name || '',
    status: (row.status || 'DRAFT').toString().toUpperCase(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatEnrollment(row: any, options?: { includeFinancial?: boolean }) {
  const includeFinancial = options?.includeFinancial !== false;
  const trainee = unwrap(row.trainees);
  const profile = unwrap(trainee?.profiles);
  const course = unwrap(row.courses);
  const pkg = unwrap(row.course_packages);
  const batchRel = unwrap(row.batches);
  const center = unwrap(row.training_centers);
  const payments = Array.isArray(row.payments) ? row.payments : row.payments ? [row.payments] : [];
  const latestPayment = payments[payments.length - 1] || payments[0];
  const rawDate = row.enrolled_at || row.created_at;
  const batchCode = batchRel?.batch_code || 'Cohort';
  const enrollmentDate = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '';

  return {
    id: row.id,
    enrollmentNo: `ENR-${String(row.id).slice(0, 8).toUpperCase()}`,
    traineeId: row.trainee_id,
    traineeName: formatProfileName(profile),
    traineeEmail: profile?.email || '',
    traineePhone: profile?.phone || '',
    traineeAvatarUrl: profile?.avatar_url || null,
    traineeSrn: trainee?.srn || trainee?.trainee_number || '',
    courseId: row.course_id,
    courseCode: course?.code || pkg?.package_code || '',
    courseTitle: course?.name || pkg?.name || '',
    packageId: row.package_id || null,
    packageName: pkg?.name || null,
    batchId: row.batch_id || null,
    batchCode,
    batchQueueOrder: batchRel?.queue_order || 1,
    batchStartDate: batchRel?.start_date || '',
    batchEndDate: batchRel?.end_date || '',
    batchCapacity: batchRel?.capacity || 24,
    batchEnrolledCount: batchRel?.enrolled_count || 0,
    centerId: row.training_center_id || '',
    centerName: center?.name || '',
    batch: batchCode,
    enrollmentDate,
    status: toUiEnrollmentStatus(row.status),
    rawStatus: row.status,
    paymentStatus: includeFinancial ? toUiPaymentStatus(latestPayment?.status) : 'RESTRICTED',
    rawPaymentStatus: includeFinancial ? (latestPayment?.status || 'PENDING') : 'RESTRICTED',
    paymentMethod: includeFinancial ? (latestPayment?.payment_method || 'GCASH') : null,
    paymentAmount: includeFinancial ? Number(latestPayment?.amount ?? pkg?.package_price ?? course?.price ?? 0) : null,
    paymentEnvironment: includeFinancial ? (latestPayment?.payment_environment || 'TEST') : null,
    paymongoCheckoutId: includeFinancial ? (latestPayment?.paymongo_checkout_id || null) : null,
    paymongoPaymentId: includeFinancial ? (latestPayment?.paymongo_payment_id || null) : null,
    reviewNotes: row.review_notes || '',
    reviewedBy: row.reviewed_by || '',
    reviewedAt: row.reviewed_at || '',
    appliedAt: row.created_at,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
  };
}

export function computeEndDate(startDateStr: string, totalDays: number): string {
  if (!startDateStr) return '';
  const parts = startDateStr.split('-');
  if (parts.length !== 3) return startDateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return startDateStr;
  const dateObj = new Date(Date.UTC(y, m, d));
  const daysToAdd = Math.max(0, (totalDays || 1) - 1);
  dateObj.setUTCDate(dateObj.getUTCDate() + daysToAdd);
  const ey = dateObj.getUTCFullYear();
  const em = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const ed = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${ey}-${em}-${ed}`;
}

export function formatSchedule(row: any) {
  const course = unwrap(row.courses);
  const instructor = unwrap(row.instructors);
  const instructorProfile = unwrap(instructor?.profiles);
  const center = unwrap(row.training_centers);
  const start = row.start_at ? new Date(row.start_at) : null;
  const end = row.end_at ? new Date(row.end_at) : null;

  const durationHours = Number(course?.duration_hours || 40);
  const durationDays = Math.max(1, Math.ceil(durationHours / 8));
  const isFullModular = isFullModularCourseRow(course);
  const theoryDays = isFullModular
    ? Math.min(3, durationDays)
    : Number(course?.theory_days ?? (durationDays === 1 ? 1 : Math.max(1, Math.round(durationDays * 0.4))));
  const practicalDays = isFullModular
    ? 0
    : Number(course?.practical_days ?? (durationDays === 1 ? 0 : Math.max(0, durationDays - theoryDays)));
  const totalDays = Math.max(1, theoryDays + practicalDays);

  const startDate = start ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(start) : '';
  const endDate = computeEndDate(startDate, totalDays);

  const now = new Date();
  const rawStatus = (row.status || 'SCHEDULED').toString().toUpperCase();
  let status = rawStatus;

  if (rawStatus !== 'CANCELLED') {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
    // If end date/time has passed, schedule is DONE -> marked COMPLETED
    const isDone = (end && end < now) || (endDate && endDate < todayStr);

    if (rawStatus === 'COMPLETED' || isDone) {
      status = 'COMPLETED';
    } else if (start && start <= now && (!end || end > now)) {
      status = 'ONGOING';
    }
  }

  return {
    id: row.id,
    sessionCode: row.session_code || `SES-${String(row.id).slice(0, 8).toUpperCase()}`,
    courseId: row.course_id,
    courseCode: course?.code || '',
    courseTitle: course?.name || '',
    durationHours,
    durationDays,
    theoryDays,
    practicalDays,
    totalDays,
    instructorId: row.instructor_id || '',
    instructorName: formatProfileName(instructorProfile) || 'Unassigned',
    instructorAvatarUrl: instructorProfile?.avatar_url || null,
    centerId: row.training_center_id || '',
    centerName: center?.name || '',
    room: row.room || '',
    date: startDate,
    startDate,
    endDate,
    startTime: start
      ? start.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true })
      : '',
    endTime: end
      ? end.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true })
      : '',
    substituteInstructorId: row.substitute_instructor_id || '',
    substituteInstructorName: row.substituteInstructorName || '',
    substituteInstructorAvatarUrl: row.substituteInstructorAvatarUrl || null,
    instructorOnLeave: Boolean(row.instructorOnLeave),
    leaveDetails: row.leaveDetails || null,
    capacity: Math.min(Math.max(1, Number(row.capacity || 24)), 24),
    enrolledCount: row.enrolledCount ?? 0,
    status,
    startAt: row.start_at || '',
    endAt: row.end_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatAttendance(row: any) {
  const schedule = unwrap(row.schedules);
  const batch = unwrap(row.batches);
  const course = unwrap(schedule?.courses) || unwrap(row.courses);
  const instructor = unwrap(schedule?.instructors) || unwrap(batch?.instructors);
  const instructorProfile = unwrap(instructor?.profiles);
  const trainee = unwrap(row.trainees);
  const traineeProfile = unwrap(trainee?.profiles);
  const start = schedule?.start_at ? new Date(schedule.start_at) : null;
  const end = schedule?.end_at ? new Date(schedule.end_at) : null;
  const dateStr = row.session_date
    ? String(row.session_date).slice(0, 10)
    : start
      ? start.toISOString().slice(0, 10)
      : (row.check_in_at || row.created_at || '').slice(0, 10);
  const sessionCode = schedule?.id
    ? `SES-${String(schedule.id).slice(0, 8).toUpperCase()}`
    : batch?.batch_code
      ? `SES-${batch.batch_code}`
      : `SES-${String(row.id || '').slice(0, 8).toUpperCase()}`;

  return {
    id: row.id,
    date: dateStr,
    scheduleId: row.schedule_id || schedule?.id || '',
    batchId: row.batch_id || batch?.id || '',
    batchCode: batch?.batch_code || '',
    sessionCode,
    courseId: row.course_id || schedule?.course_id || course?.id || '',
    courseCode: course?.code || '',
    courseTitle: course?.name || '',
    traineeId: row.trainee_id,
    traineeName: formatProfileName(traineeProfile),
    traineeAvatarUrl: traineeProfile?.avatar_url || null,
    traineeSrn: trainee?.trainee_number || '',
    instructorId: schedule?.instructor_id || batch?.instructor_id || '',
    instructorName: formatProfileName(instructorProfile) || 'Assigned Instructor',
    instructorAvatarUrl: instructorProfile?.avatar_url || null,
    room: schedule?.room || 'Simulation Suite',
    startTime: start
      ? start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '08:00 AM',
    endTime: end
      ? end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '05:00 PM',
    status: (row.status || 'PRESENT').toString().toUpperCase(),
    remarks: row.remarks || '',
    updatedBy: row.recorded_by || '',
    updatedAt: row.updated_at || row.created_at,
  };
}

export function formatPayment(row: any) {
  const trainee = unwrap(row.trainees);
  const profile = unwrap(trainee?.profiles);
  const enrollment = unwrap(row.enrollments);
  const course = unwrap(enrollment?.courses);
  const isApproved = !!row.verified_at || (row.status || '').toUpperCase() === 'VERIFIED';
  const isRejected = ['FAILED', 'REJECTED', 'CANCELLED'].includes((row.status || '').toUpperCase());

  return {
    id: row.id,
    paymentNo: row.reference_number || `PAY-${String(row.id).slice(0, 8).toUpperCase()}`,
    enrollmentId: row.enrollment_id || enrollment?.id || '',
    traineeId: row.trainee_id,
    traineeName: formatProfileName(profile),
    traineeEmail: profile?.email || '',
    traineePhone: profile?.phone || '',
    traineeAvatarUrl: profile?.avatar_url || null,
    courseTitle: course?.name || 'Maritime Training Course',
    courseCode: course?.code || '',
    amount: Number(row.amount || 0),
    method: (row.payment_method || 'OTHER').toString().toUpperCase(),
    referenceNumber: row.reference_number || '',
    status: isApproved ? 'VERIFIED' : (isRejected ? 'REJECTED' : 'PENDING'),
    rawStatus: row.status,
    verifiedBy: row.verified_by || '',
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    enrollmentStatus: (enrollment?.status || '').toUpperCase(),
  };
}

export function formatCertificate(row: any) {
  const trainee = unwrap(row.trainees);
  const profile = unwrap(trainee?.profiles);
  const course = unwrap(row.courses);
  const issuer = unwrap(row.issuer) || unwrap(row.profiles);
  return {
    id: row.id,
    certificateNo: row.certificate_number || `CERT-${String(row.id).slice(0, 8).toUpperCase()}`,
    traineeId: row.trainee_id,
    traineeName: formatProfileName(profile),
    traineeEmail: profile?.email || '',
    traineeAvatarUrl: profile?.avatar_url || null,
    courseId: row.course_id,
    courseCode: course?.code || '',
    courseTitle: course?.name || '',
    issueDate: row.issued_at ? String(row.issued_at).slice(0, 10) : '',
    expiryDate: row.expires_at ? String(row.expires_at).slice(0, 10) : '',
    completionDate: row.issued_at ? String(row.issued_at).slice(0, 10) : '',
    status: toUiCertificateStatus(row.status),
    qrVerificationCode: row.certificate_number || String(row.id),
    instructorName: '',
    centerName: '',
    issuedBy: formatProfileName(issuer) || row.issued_by || '',
    issuedAt: row.issued_at,
    reissuedCount: 0,
  };
}

export async function resolveAssessmentModuleId(
  courseId: string,
  rawModuleId: unknown
): Promise<{ provided: boolean; moduleId: string | null; error?: string }> {
  if (rawModuleId === undefined) {
    return { provided: false, moduleId: null };
  }
  const trimmed = typeof rawModuleId === 'string' ? rawModuleId.trim() : rawModuleId;
  if (!trimmed || trimmed === 'POST_TEST') {
    return { provided: true, moduleId: null };
  }
  const { data: modRow, error } = await supabaseAdmin
    .from('course_modules')
    .select('id')
    .eq('id', String(trimmed))
    .eq('course_id', courseId)
    .maybeSingle();
  if (error || !modRow) {
    return { provided: true, moduleId: null, error: 'Selected curriculum module does not belong to this course.' };
  }
  return { provided: true, moduleId: modRow.id };
}

export function formatAssessment(row: any, stats?: { submissions?: number; passed?: number; failed?: number; average?: number }) {
  const course = unwrap(row.courses);
  const mod = unwrap(row.course_modules);
  const questions = unwrap(row.assessment_questions) || row.assessment_questions;
  const questionsList = Array.isArray(questions) ? questions : [];
  const calculatedTotalPoints = questionsList.reduce((sum: number, q: any) => sum + (Number(q.points) || 1), 0);
  const passingScoreNum = row.passing_score != null && !isNaN(Number(row.passing_score)) ? Number(row.passing_score) : 75;
  return {
    id: row.id,
    code: `ASM-${(course?.code || 'GEN').toString().slice(0, 8)}-${String(row.id).slice(0, 4).toUpperCase()}`,
    title: row.title,
    description: row.description || '',
    courseId: row.course_id,
    courseCode: course?.code || '',
    courseTitle: course?.name || '',
    moduleId: row.module_id || null,
    moduleTitle: mod?.title || null,
    moduleSortOrder: mod?.sort_order ?? null,
    type: (row.assessment_type || 'WRITTEN').toString().toUpperCase(),
    totalPoints: calculatedTotalPoints > 0 ? calculatedTotalPoints : (Number(row.total_points) || 100),
    passingScore: passingScoreNum,
    durationMinutes: row.duration_minutes || 0,
    status: (row.status || 'DRAFT').toString().toUpperCase(),
    submissionsCount: stats?.submissions || 0,
    passedCount: stats?.passed || 0,
    failedCount: stats?.failed || 0,
    averageScore: stats?.average || 0,
    questionsCount: questionsList.length || (row.questions_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatNotification(row: any) {
  const type = (row.type || row.entity_type || 'SYSTEM').toString().toUpperCase();
  let severity = (row.severity || row.priority || 'INFO').toString().toUpperCase();
  if (!['INFO', 'WARNING', 'CRITICAL'].includes(severity)) {
    severity = type === 'PAYMENT' || type === 'SECURITY' ? 'WARNING' : 'INFO';
  }

  let link = row.link || row.action_url || row.href || '';
  if (!link) {
    if (type.includes('ENROLL')) link = '/admin/enrollments';
    else if (type.includes('PAY')) link = '/admin/payments';
    else if (type.includes('CERT')) link = '/admin/certificates';
    else if (type.includes('ATTEND')) link = '/admin/attendance';
    else if (type.includes('SCHED')) link = '/admin/schedules';
    else if (type.includes('TRAIN')) link = '/admin/trainees';
  }

  return {
    id: row.id,
    title: row.title || row.subject || 'Notification',
    message: row.message || row.body || row.content || '',
    severity,
    type,
    isRead: Boolean(row.is_read ?? row.read_at),
    link,
    createdAt: row.created_at,
  };
}

export const COURSE_SELECT = '*, training_centers(name)';
export const ENROLLMENT_SELECT =
  '*, trainees(profile_id, trainee_number, srn, profiles(first_name, last_name, email, phone, avatar_url)), courses(code, name, price), course_packages(package_code, name, package_price), batches(id, batch_code, start_date, end_date, capacity, enrolled_count, status, queue_order), training_centers(name), payments(id, status, amount, payment_method, reference_number, paymongo_checkout_id, paymongo_payment_id, payment_environment, paid_at, created_at)';
export const BATCH_SELECT =
  '*, courses(code, name, price, duration_hours), course_packages(package_code, name, package_price), training_centers(name)';

export function formatBatch(row: any) {
  const course = unwrap(row.courses);
  const pkg = unwrap(row.course_packages);
  const center = unwrap(row.training_centers);
  return {
    id: row.id,
    batchCode: row.batch_code,
    queueOrder: Number(row.queue_order || 1),
    courseId: row.course_id,
    courseCode: course?.code || '',
    courseTitle: course?.name || '',
    coursePrice: Number(course?.price || 0),
    packageId: row.package_id || null,
    packageName: pkg?.name || null,
    centerId: row.training_center_id || '',
    centerName: center?.name || '',
    startDate: row.start_date,
    endDate: row.end_date || '',
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    instructorId: row.instructor_id || '',
    capacity: Number(row.capacity || 24),
    enrolledCount: Number(row.enrolled_count || 0),
    remainingSlots: Math.max(0, Number(row.capacity || 24) - Number(row.enrolled_count || 0)),
    status: row.status || 'OPEN',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export const SCHEDULE_SELECT =
  '*, courses(id, code, name, category, duration_hours, theory_days, practical_days), instructors(profiles(first_name, last_name, avatar_url)), training_centers(name)';
export const ATTENDANCE_SELECT =
  '*, trainees(trainee_number, profiles(first_name, last_name, avatar_url)), courses(id, code, name, training_center_id), batches(id, batch_code, instructor_id, instructors(profiles(first_name, last_name, avatar_url))), schedules(id, start_at, end_at, room, instructor_id, course_id, training_center_id, courses(id, code, name), instructors(profiles(first_name, last_name, avatar_url)))';
export const PAYMENT_SELECT =
  '*, trainees(profiles(first_name, last_name, email, phone, avatar_url)), enrollments(id, status, training_center_id, courses(code, name))';
export const CERTIFICATE_SELECT =
  '*, trainees(profiles(first_name, last_name, email, avatar_url)), courses(code, name, training_center_id)';
export const ASSESSMENT_SELECT = '*, courses(code, name, training_center_id), course_modules(id, title, sort_order), assessment_questions(id, points)';
export const INSTRUCTOR_SELECT = '*, profiles!inner(*), training_centers(name)';

export function formatInstructor(row: any) {
  const profile = unwrap(row.profiles) || row;
  const instructor = unwrap(row.instructors) || row;
  const center = unwrap(instructor.training_centers) || unwrap(row.training_centers);
  const instructorId =
    instructor.profile_id ||
    profile.id ||
    instructor.id ||
    row.profile_id ||
    row.id ||
    '';
  return {
    id: profile.id || instructor.profile_id || instructorId,
    instructorId,
    firstName: profile.first_name || '',
    lastName: profile.last_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    avatarUrl: profile.avatar_url || null,
    specialization: instructor.specialization || instructor.position || 'Maritime Instruction',
    employeeId: instructor.instructor_number || instructor.username || '',
    status: (profile.status || instructor.employment_status || 'PENDING').toString().toUpperCase(),
    assignedCenterId: instructor.training_center_id || '',
    assignedCenterName: center?.name || '',
    activeCoursesCount: 0,
    upcomingSessionsCount: 0,
    createdAt: profile.created_at || instructor.created_at,
  };
}

export function parseClockToIso(dateStr: string, timeStr: string): string {
  let [year, month, day] = [0, 0, 0];
  const cleanDate = (dateStr || '').trim();
  if (cleanDate.includes('-')) {
    const parts = cleanDate.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else if (cleanDate.includes('/')) {
    const parts = cleanDate.split('/');
    if (parts[2]?.length === 4) {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } else {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
  }

  let hours = 8;
  let minutes = 0;
  const match = (timeStr || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  }

  // Construct Manila time (UTC+8) Date
  if (year && month && day) {
    const parsed = new Date(Date.UTC(year, month - 1, day, hours - 8, minutes, 0));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const fallback = new Date(`${dateStr} ${timeStr}`);
  if (Number.isNaN(fallback.getTime())) {
    throw new Error('Invalid date or time');
  }
  return fallback.toISOString();
}

export function matchesSearch(haystack: Array<string | number | null | undefined>, search: string) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return haystack.some((value) => String(value || '').toLowerCase().includes(needle));
}
