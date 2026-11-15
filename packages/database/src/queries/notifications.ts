import { supabaseAdmin } from '../supabase';

export const NOTIFICATION_CATEGORIES = [
  'ACCOUNT',
  'SECURITY',
  'ENROLLMENT',
  'PAYMENT',
  'BATCH',
  'SCHEDULE',
  'ATTENDANCE',
  'PROGRESS',
  'ASSESSMENT',
  'PRACTICAL',
  'CERTIFICATION',
  'SYSTEM',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export type PortalUserRole = 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR' | 'TRAINEE';

export function normalizePortalRole(role?: string | null): PortalUserRole {
  const norm = (role || '').toString().trim().toUpperCase().replace(/[-\s]+/g, '_');
  if (norm === 'SUPER_ADMIN' || norm === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (norm === 'ADMIN' || norm === 'ADMINISTRATOR') return 'ADMIN';
  if (norm === 'INSTRUCTOR' || norm === 'TEACHER' || norm === 'TRAINER') return 'INSTRUCTOR';
  return 'TRAINEE';
}

export const NOTIFICATION_EVENTS = {
  // ACCOUNT / SRN / SELF SECURITY
  NEW_TRAINEE_REGISTRATION: 'NEW_TRAINEE_REGISTRATION',
  GOOGLE_REGISTRATION: 'GOOGLE_REGISTRATION',
  SRN_REQUIRED: 'SRN_REQUIRED',
  SRN_UPDATED: 'SRN_UPDATED',
  SRN_VALIDATION_FAILED: 'SRN_VALIDATION_FAILED',
  ACCOUNT_SECURITY_EVENT: 'ACCOUNT_SECURITY_EVENT',
  ACCOUNT_REACTIVATED: 'ACCOUNT_REACTIVATED',
  MFA_UPDATED: 'MFA_UPDATED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  SESSION_REVOKED: 'SESSION_REVOKED',

  // SUPER ADMIN GOVERNANCE
  ROLE_PERMISSIONS_UPDATED: 'ROLE_PERMISSIONS_UPDATED',
  ADMIN_ACCOUNT_CREATED: 'ADMIN_ACCOUNT_CREATED',

  // ENROLLMENT
  NEW_ENROLLMENT: 'NEW_ENROLLMENT',
  ENROLLMENT_PAYMENT_PENDING: 'ENROLLMENT_PAYMENT_PENDING',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  ENROLLMENT_ACTIVATED: 'ENROLLMENT_ACTIVATED',
  ENROLLMENT_REJECTED: 'ENROLLMENT_REJECTED',
  ENROLLMENT_CANCELLED: 'ENROLLMENT_CANCELLED',
  ENROLLMENT_COMPLETED: 'ENROLLMENT_COMPLETED',
  PREREQUISITE_FAILED: 'PREREQUISITE_FAILED',

  // BATCH
  BATCH_CREATED: 'BATCH_CREATED',
  BATCH_ALMOST_FULL: 'BATCH_ALMOST_FULL',
  BATCH_FULL: 'BATCH_FULL',
  BATCH_STARTING_SOON: 'BATCH_STARTING_SOON',
  BATCH_STARTED: 'BATCH_STARTED',
  BATCH_COMPLETED: 'BATCH_COMPLETED',
  BATCH_CANCELLED: 'BATCH_CANCELLED',

  // SCHEDULE & INSTRUCTOR LEAVES
  SCHEDULE_CHANGED: 'SCHEDULE_CHANGED',
  SESSION_CANCELLED: 'SESSION_CANCELLED',
  VENUE_CHANGED: 'VENUE_CHANGED',
  INSTRUCTOR_ASSIGNED: 'INSTRUCTOR_ASSIGNED',
  INSTRUCTOR_ASSIGNMENT_CHANGED: 'INSTRUCTOR_ASSIGNMENT_CHANGED',
  INSTRUCTOR_CONFLICT: 'INSTRUCTOR_CONFLICT',
  SUBSTITUTE_ASSIGNED: 'SUBSTITUTE_ASSIGNED',
  LEAVE_REQUEST_SUBMITTED: 'LEAVE_REQUEST_SUBMITTED',
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',

  // ATTENDANCE
  ATTENDANCE_RECORDED: 'ATTENDANCE_RECORDED',
  TRAINEE_LATE: 'TRAINEE_LATE',
  TRAINEE_ABSENT: 'TRAINEE_ABSENT',
  LOW_ATTENDANCE: 'LOW_ATTENDANCE',

  // PROGRESS
  DAILY_LESSON_READY: 'DAILY_LESSON_READY',
  TRAINEE_FALLING_BEHIND: 'TRAINEE_FALLING_BEHIND',
  MODULE_COMPLETED: 'MODULE_COMPLETED',
  PRACTICAL_COMPLETED: 'PRACTICAL_COMPLETED',
  TRAINING_COMPLETED: 'TRAINING_COMPLETED',

  // ASSESSMENT
  ASSESSMENT_ASSIGNED: 'ASSESSMENT_ASSIGNED',
  ASSESSMENT_SUBMITTED: 'ASSESSMENT_SUBMITTED',
  ASSESSMENT_PENDING_GRADING: 'ASSESSMENT_PENDING_GRADING',
  ASSESSMENT_GRADED: 'ASSESSMENT_GRADED',
  PRACTICAL_ASSESSMENT_REQUIRED: 'PRACTICAL_ASSESSMENT_REQUIRED',

  // CERTIFICATION
  CERTIFICATION_ENDORSEMENT_REQUIRED: 'CERTIFICATION_ENDORSEMENT_REQUIRED',
  CERTIFICATION_ENDORSED: 'CERTIFICATION_ENDORSED',
  CERTIFICATION_UNDER_REVIEW: 'CERTIFICATION_UNDER_REVIEW',
  CERTIFICATION_APPROVED: 'CERTIFICATION_APPROVED',
  CERTIFICATE_PREVIEW_AVAILABLE: 'CERTIFICATE_PREVIEW_AVAILABLE',
  CERTIFICATE_READY_FOR_RELEASE: 'CERTIFICATE_READY_FOR_RELEASE',
  CERTIFICATION_REQUIREMENT_MISSING: 'CERTIFICATION_REQUIREMENT_MISSING',

  // SYSTEM & SECURITY
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  SECURITY_ALERT: 'SECURITY_ALERT',
} as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

export interface NotificationPayload {
  title: string;
  message: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}

export interface DispatchEventParams {
  event: NotificationEventType;
  targetUserId?: string;
  targetRole?: PortalUserRole;
  superAdminId?: string;
  adminId?: string;
  traineeId?: string;
  instructorId?: string;
  batchId?: string;
  courseId?: string;
  trainingCenterId?: string | null;
  entityType?: string;
  entityId?: string;
  // Custom message overrides (applied ONLY for single-role targets unless roleOverrides is used)
  title?: string;
  message?: string;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  actionUrl?: string;
  roleOverrides?: Partial<Record<PortalUserRole, Partial<NotificationPayload>>>;
  metadata?: Record<string, any>;
}

export const PORTAL_NOTIFICATION_CATEGORIES: Record<PortalUserRole, readonly NotificationCategory[]> = {
  SUPER_ADMIN: ['SECURITY', 'ACCOUNT', 'SYSTEM'],
  ADMIN: [
    'ACCOUNT',
    'SECURITY',
    'ENROLLMENT',
    'PAYMENT',
    'BATCH',
    'SCHEDULE',
    'ATTENDANCE',
    'PROGRESS',
    'PRACTICAL',
    'CERTIFICATION',
  ],
  INSTRUCTOR: [
    'ACCOUNT',
    'SECURITY',
    'ENROLLMENT',
    'BATCH',
    'SCHEDULE',
    'ATTENDANCE',
    'PROGRESS',
    'PRACTICAL',
    'ASSESSMENT',
    'CERTIFICATION',
  ],
  TRAINEE: [
    'ACCOUNT',
    'SECURITY',
    'ENROLLMENT',
    'PAYMENT',
    'BATCH',
    'SCHEDULE',
    'ATTENDANCE',
    'PROGRESS',
    'PRACTICAL',
    'ASSESSMENT',
    'CERTIFICATION',
  ],
};

const SUPER_ADMIN_BLOCKED_TYPES = new Set<string>([
  'NEW_TRAINEE_REGISTRATION',
  'GOOGLE_REGISTRATION',
  'SRN_REQUIRED',
  'SRN_UPDATED',
  'SRN_VALIDATION_FAILED',
  'NEW_ENROLLMENT',
  'ENROLLMENT_PAYMENT_PENDING',
  'PAYMENT_SUBMITTED',
  'PAYMENT_CONFIRMED',
  'ENROLLMENT_ACTIVATED',
  'ENROLLMENT_REJECTED',
  'ENROLLMENT_CANCELLED',
  'ENROLLMENT_COMPLETED',
  'PREREQUISITE_FAILED',
  'BATCH_CREATED',
  'BATCH_ALMOST_FULL',
  'BATCH_FULL',
  'BATCH_STARTING_SOON',
  'BATCH_STARTED',
  'BATCH_COMPLETED',
  'BATCH_CANCELLED',
  'SCHEDULE',
  'SCHEDULE_CHANGED',
  'SESSION_CANCELLED',
  'VENUE_CHANGED',
  'INSTRUCTOR_ASSIGNED',
  'INSTRUCTOR_ASSIGNMENT_CHANGED',
  'INSTRUCTOR_CONFLICT',
  'SUBSTITUTE_ASSIGNED',
  'LEAVE_REQUEST_SUBMITTED',
  'LEAVE_APPROVED',
  'LEAVE_REJECTED',
  'ATTENDANCE_RECORDED',
  'TRAINEE_LATE',
  'TRAINEE_ABSENT',
  'LOW_ATTENDANCE',
  'DAILY_LESSON_READY',
  'TRAINEE_FALLING_BEHIND',
  'MODULE_COMPLETED',
  'PRACTICAL_COMPLETED',
  'TRAINING_COMPLETED',
  'ASSESSMENT_ASSIGNED',
  'ASSESSMENT_SUBMITTED',
  'ASSESSMENT_PENDING_GRADING',
  'ASSESSMENT_GRADED',
  'PRACTICAL_ASSESSMENT_REQUIRED',
  'CERTIFICATION_ENDORSEMENT_REQUIRED',
  'CERTIFICATION_ENDORSED',
  'CERTIFICATION_UNDER_REVIEW',
  'CERTIFICATION_APPROVED',
  'CERTIFICATE_PREVIEW_AVAILABLE',
  'CERTIFICATE_READY_FOR_RELEASE',
  'CERTIFICATION_REQUIREMENT_MISSING',
]);

const ADMIN_BLOCKED_TYPES = new Set<string>([
  'NEW_TRAINEE_REGISTRATION',
  'GOOGLE_REGISTRATION',
  'SRN_REQUIRED',
  'SRN_UPDATED',
  'SRN_VALIDATION_FAILED',
  'DAILY_LESSON_READY',
  'MODULE_COMPLETED',
  'ATTENDANCE_RECORDED',
  'ASSESSMENT_ASSIGNED',
  'ASSESSMENT_SUBMITTED',
  'ASSESSMENT_PENDING_GRADING',
  'ASSESSMENT_GRADED',
  'PRACTICAL_ASSESSMENT_REQUIRED',
  'CERTIFICATION_ENDORSEMENT_REQUIRED',
  'CERTIFICATE_PREVIEW_AVAILABLE',
  'LEAVE_APPROVED',
  'LEAVE_REJECTED',
  'SUBSTITUTE_ASSIGNED',
  'ROLE_PERMISSIONS_UPDATED',
  'ADMIN_ACCOUNT_CREATED',
  'SECURITY_ALERT',
  'SYSTEM_ERROR',
  'SESSION_REVOKED',
]);

const INSTRUCTOR_BLOCKED_TYPES = new Set<string>([
  'NEW_TRAINEE_REGISTRATION',
  'GOOGLE_REGISTRATION',
  'SRN_REQUIRED',
  'SRN_UPDATED',
  'SRN_VALIDATION_FAILED',
  'NEW_ENROLLMENT',
  'ENROLLMENT_PAYMENT_PENDING',
  'PAYMENT_SUBMITTED',
  'PAYMENT_CONFIRMED',
  'ENROLLMENT_REJECTED',
  'PREREQUISITE_FAILED',
  'BATCH_CREATED',
  'BATCH_ALMOST_FULL',
  'BATCH_FULL',
  'INSTRUCTOR_CONFLICT',
  'LEAVE_REQUEST_SUBMITTED',
  'ATTENDANCE_RECORDED',
  'DAILY_LESSON_READY',
  'ASSESSMENT_ASSIGNED',
  'ASSESSMENT_GRADED',
  'CERTIFICATION_ENDORSED',
  'CERTIFICATION_UNDER_REVIEW',
  'CERTIFICATE_PREVIEW_AVAILABLE',
  'CERTIFICATE_READY_FOR_RELEASE',
  'ROLE_PERMISSIONS_UPDATED',
  'ADMIN_ACCOUNT_CREATED',
  'SECURITY_ALERT',
  'SYSTEM_ERROR',
  'SESSION_REVOKED',
]);

const TRAINEE_BLOCKED_TYPES = new Set<string>([
  'BATCH_CREATED',
  'BATCH_ALMOST_FULL',
  'INSTRUCTOR_ASSIGNED',
  'INSTRUCTOR_ASSIGNMENT_CHANGED',
  'INSTRUCTOR_CONFLICT',
  'SUBSTITUTE_ASSIGNED',
  'LEAVE_REQUEST_SUBMITTED',
  'LEAVE_APPROVED',
  'LEAVE_REJECTED',
  'ASSESSMENT_PENDING_GRADING',
  'CERTIFICATION_ENDORSEMENT_REQUIRED',
  'ROLE_PERMISSIONS_UPDATED',
  'ADMIN_ACCOUNT_CREATED',
  'SECURITY_ALERT',
  'SYSTEM_ERROR',
  'SESSION_REVOKED',
]);

const PAYMENT_KEYWORDS = ['PAYMENT', 'PAYMONGO', 'BILLING', 'RECEIPT', 'TUITION'];

export interface PortalNotificationFilterOptions {
  canViewPayments?: boolean;
  permissions?: string[] | null;
  position?: string | null;
  recipientId?: string;
}

export function hasAdminFinancialPermission(
  permissions?: string[] | null,
  position?: string | null
): boolean {
  const pos = (position || '').toString().toUpperCase();
  if (pos.includes('IT_SUPPORT') || pos.includes('IT SUPPORT') || pos.includes('READ_ONLY')) {
    return false;
  }
  const perms = Array.isArray(permissions)
    ? permissions.map((p) => String(p || '').toUpperCase().trim()).filter(Boolean)
    : [];
  if (perms.length === 0) return false;
  return (
    perms.includes('ALL') ||
    perms.includes('PAYMENT_VIEW') ||
    perms.includes('PAYMENT_VERIFY') ||
    perms.includes('FINANCIAL_REPORTS') ||
    perms.includes('FINANCIAL_ACCESS')
  );
}

function inferNotificationCategoryFromRow(row: any): NotificationCategory {
  const type = (row.type || 'SYSTEM').toString().toUpperCase();
  const explicitCat = row.category ? row.category.toString().toUpperCase() : '';
  if (
    explicitCat &&
    explicitCat !== 'SYSTEM' &&
    NOTIFICATION_CATEGORIES.includes(explicitCat as NotificationCategory)
  ) {
    return explicitCat as NotificationCategory;
  }
  if (type.includes('PAY')) return 'PAYMENT';
  if (type.includes('ENROLL')) return 'ENROLLMENT';
  if (type.includes('BATCH')) return 'BATCH';
  if (type.includes('SCHED') || type.includes('SESSION') || type.includes('VENUE') || type.includes('LEAVE') || type.includes('SUBSTITUTE')) return 'SCHEDULE';
  if (type.includes('ATTEND') || type.includes('ABSENT') || type.includes('LATE')) return 'ATTENDANCE';
  if (type.includes('PRACTIC')) return 'PRACTICAL';
  if (type.includes('ASSESS') || type.includes('GRADE')) return 'ASSESSMENT';
  if (type.includes('CERT')) return 'CERTIFICATION';
  if (type.includes('PROG') || type.includes('MODULE') || type.includes('LESSON') || type.includes('TRAINING') || type.includes('BEHIND')) return 'PROGRESS';
  if (type.includes('SEC') || type.includes('MFA') || type.includes('PASS') || type.includes('ROLE_PERMISSION')) return 'SECURITY';
  if (type.includes('REG') || type.includes('SRN') || type.includes('USER') || type.includes('ACCOUNT') || type.includes('ADMIN')) return 'ACCOUNT';
  return 'SYSTEM';
}

export function isNotificationAllowedForPortal(
  row: any,
  userRole: PortalUserRole,
  options?: PortalNotificationFilterOptions
): boolean {
  const role = normalizePortalRole(userRole);
  const type = (row?.type || 'SYSTEM').toString().toUpperCase().trim();
  const category = inferNotificationCategoryFromRow(row);
  const title = (row?.title || '').toString();
  const actionUrl = (row?.action_url || row?.link || '').toString();

  if (options?.recipientId && row?.recipient_id && row.recipient_id !== options.recipientId) {
    return false;
  }

  const allowedCategories = PORTAL_NOTIFICATION_CATEGORIES[role];
  if (!allowedCategories.includes(category)) {
    return false;
  }

  // Catch legacy mis-tagged rows from old direct inserts / overrides
  if (role === 'SUPER_ADMIN') {
    if (SUPER_ADMIN_BLOCKED_TYPES.has(type)) return false;
    if (actionUrl.startsWith('/admin/') || actionUrl.startsWith('/learning') || actionUrl.startsWith('/enrollment') || actionUrl.startsWith('/payments')) {
      return false;
    }
    if (
      title.includes('Your Lesson Today is Ready') ||
      title.includes('New Paid Enrollment') ||
      title.includes('Certificate Issued') ||
      title.includes('New Enrollment')
    ) {
      return false;
    }
    // Never show another user's self MFA/password notification if mis-targeted or legacy cross-portal row
    if ((type === 'MFA_UPDATED' || type === 'PASSWORD_CHANGED') && row?.entity_id && row?.recipient_id && row.entity_id !== row.recipient_id) {
      return false;
    }
    // Legacy Trainee MFA notifications leaked into SUPER_ADMIN before isolation fix had entity_id null & generic 'System Notification' copy
    if (
      type === 'MFA_UPDATED' &&
      row?.title === 'System Notification' &&
      row?.message === 'A system event occurred.'
    ) {
      return false;
    }
    return true;
  }

  if (role === 'ADMIN') {
    if (ADMIN_BLOCKED_TYPES.has(type)) return false;
    if (actionUrl.startsWith('/super-admin/') || actionUrl.startsWith('/learning') || actionUrl.startsWith('/my-courses')) {
      return false;
    }
    if (title.includes('Your Lesson Today is Ready')) {
      return false;
    }

    const canViewPayments =
      options?.canViewPayments !== undefined
        ? options.canViewPayments
        : options?.permissions
          ? hasAdminFinancialPermission(options.permissions, options.position)
          : true;

    const isPaymentRelated =
      category === 'PAYMENT' || PAYMENT_KEYWORDS.some((kw) => type.includes(kw) || title.toUpperCase().includes(kw));

    if (isPaymentRelated && !canViewPayments) {
      return false;
    }

    // Optional RBAC category scoping when explicit permissions are available
    const perms = Array.isArray(options?.permissions)
      ? options!.permissions!.map((p) => String(p || '').toUpperCase().trim())
      : null;

    if (perms && perms.length > 0 && !perms.includes('ALL')) {
      if (category === 'ATTENDANCE' && !perms.some((p) => p.startsWith('ATTENDANCE_'))) return false;
      if (category === 'CERTIFICATION' && !perms.some((p) => p.startsWith('CERTIFICATE_'))) return false;
      if (category === 'ENROLLMENT' && !perms.some((p) => p.startsWith('ENROLLMENT_') || p.startsWith('PAYMENT_'))) return false;
      if (type.includes('LEAVE') && !perms.some((p) => p.startsWith('LEAVE_') || p === 'SCHEDULE_MANAGE')) return false;
      if ((category === 'SCHEDULE' || category === 'BATCH') && !type.includes('LEAVE') && !perms.some((p) => p.startsWith('SCHEDULE_') || p.startsWith('COURSE_') || p.startsWith('ENROLLMENT_'))) {
        return false;
      }
    }

    return true;
  }

  if (role === 'INSTRUCTOR') {
    if (INSTRUCTOR_BLOCKED_TYPES.has(type)) return false;
    if (category === 'PAYMENT' || PAYMENT_KEYWORDS.some((kw) => type.includes(kw))) return false;
    if (actionUrl.startsWith('/admin/') || actionUrl.startsWith('/super-admin/') || actionUrl.startsWith('/learning')) {
      return false;
    }
    if (title.includes('Your Lesson Today is Ready')) {
      return false;
    }
    return true;
  }

  // TRAINEE
  if (TRAINEE_BLOCKED_TYPES.has(type)) return false;
  if (actionUrl.startsWith('/admin/') || actionUrl.startsWith('/super-admin/')) {
    return false;
  }
  return true;
}

export interface FormattedNotification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  isRead: boolean;
  readAt?: string | null;
  link: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

/**
 * Format raw notification row with fallback inference for category, priority, and link.
 */
export function formatNotificationItem(row: any, userRole: PortalUserRole = 'TRAINEE'): FormattedNotification {
  const role = normalizePortalRole(userRole);
  const type = (row.type || 'SYSTEM').toString().toUpperCase();
  const category: NotificationCategory = inferNotificationCategoryFromRow(row);

  let priority: NotificationPriority = 'MEDIUM';
  if (row.priority && NOTIFICATION_PRIORITIES.includes(row.priority.toUpperCase())) {
    priority = row.priority.toUpperCase();
  } else if (
    type.includes('REJECT') ||
    type.includes('CANCEL') ||
    type.includes('FAIL') ||
    type.includes('CONFLICT') ||
    type.includes('ERROR') ||
    type.includes('SECURITY') ||
    type.includes('ALERT') ||
    type.includes('CRITICAL') ||
    type.includes('MISSING')
  ) {
    priority = 'HIGH';
  } else if (
    type.includes('COMPLETED') ||
    type.includes('SAVED') ||
    type.includes('PREVIEW') ||
    type.includes('RECORDED')
  ) {
    priority = 'LOW';
  }

  const severity: 'INFO' | 'WARNING' | 'CRITICAL' =
    priority === 'HIGH' ? (type.includes('SECURITY') || type.includes('ERROR') ? 'CRITICAL' : 'WARNING') : 'INFO';

  // Determine navigation URL strictly scoped to the viewer's portal routes
  const rawLink = String(row.action_url || row.link || '').trim();
  let link = rawLink;

  if (link) {
    if (role === 'INSTRUCTOR') {
      if (link === '/schedule' || link.startsWith('/schedule?')) link = link.replace('/schedule', '/schedules');
      else if (link === '/certification' || link.startsWith('/certification')) link = '/trainees';
      else if (link.startsWith('/admin/') || link.startsWith('/super-admin/')) link = '';
    } else if (role === 'TRAINEE') {
      if (link === '/courses' || link.startsWith('/courses?')) link = '/my-courses';
      else if (link === '/schedule' || link.startsWith('/schedule?')) link = link.replace('/schedule', '/schedules');
      else if (link === '/notifications' && category !== 'SYSTEM') link = '';
      else if (link.startsWith('/admin/') || link.startsWith('/super-admin/')) link = '';
    } else if (role === 'ADMIN') {
      if (link === '/admin/trainees' || link.startsWith('/admin/trainees')) link = '/admin/enrollments';
      else if (!link.startsWith('/admin/')) link = '';
    } else if (role === 'SUPER_ADMIN') {
      if (link === '/notifications') link = '/super-admin/notifications';
      else if (!link.startsWith('/super-admin/')) link = '';
    }
  }

  if (!link) {
    if (role === 'TRAINEE') {
      if (category === 'ENROLLMENT') link = '/enrollment';
      else if (category === 'PAYMENT') link = '/payments';
      else if (category === 'SCHEDULE' || category === 'BATCH') link = '/schedules';
      else if (category === 'ATTENDANCE') link = '/attendance';
      else if (category === 'ASSESSMENT') link = type.includes('GRADED') ? '/grades' : '/assessments';
      else if (category === 'CERTIFICATION') link = '/certificates';
      else if (category === 'PROGRESS' || category === 'PRACTICAL') {
        link = type.includes('LESSON') || type.includes('BEHIND') ? '/learning' : '/progress';
      }
      else if (category === 'ACCOUNT' || category === 'SECURITY') {
        link = type === 'NEW_TRAINEE_REGISTRATION' ? '/my-courses' : '/settings';
      }
      else link = '/notifications';
    } else if (role === 'INSTRUCTOR') {
      if (type.includes('LEAVE')) link = '/leave';
      else if (category === 'SCHEDULE' || category === 'BATCH') link = '/schedules';
      else if (category === 'ATTENDANCE') link = '/attendance';
      else if (category === 'ASSESSMENT') link = '/assessments';
      else if (category === 'PRACTICAL') link = '/grades';
      else if (category === 'PROGRESS' || category === 'ENROLLMENT' || category === 'CERTIFICATION') link = '/trainees';
      else if (category === 'ACCOUNT' || category === 'SECURITY') link = '/profile';
      else link = '/notifications';
    } else if (role === 'ADMIN') {
      if (type.includes('LEAVE')) link = '/admin/leaves';
      else if (category === 'ENROLLMENT') link = '/admin/enrollments';
      else if (category === 'PAYMENT') link = '/admin/payments';
      else if (category === 'BATCH') link = '/admin/batches';
      else if (category === 'SCHEDULE') link = '/admin/schedules';
      else if (category === 'ATTENDANCE') link = '/admin/attendance';
      else if (category === 'CERTIFICATION') link = '/admin/certificates';
      else if (category === 'PROGRESS' || category === 'PRACTICAL' || category === 'ACCOUNT') link = '/admin/enrollments';
      else if (category === 'SECURITY') link = '/admin/settings';
      else link = '/admin/notifications';
    } else {
      // SUPER_ADMIN
      if (category === 'ACCOUNT') link = type.includes('MFA') || type.includes('PASSWORD') ? '/super-admin/settings' : '/super-admin/admins';
      else if (category === 'SECURITY') link = type.includes('ROLE_PERMISSION') ? '/super-admin/roles-permissions' : '/super-admin/security';
      else if (category === 'SYSTEM') link = '/super-admin/audit-logs';
      else link = '/super-admin/notifications';
    }
  }

  return {
    id: row.id,
    recipientId: row.recipient_id,
    title: row.title || 'Notification',
    message: row.message || '',
    type,
    category,
    priority,
    severity,
    isRead: Boolean(row.is_read ?? row.read_at),
    readAt: row.read_at || null,
    link,
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

/**
 * Baseline notification insertion with resilient schema fallback.
 * Checks for duplicate unread notification before inserting.
 */
export async function createNotificationRecord(input: {
  recipient_id: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  priority?: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
}) {
  if (!input.recipient_id) return null;

  // Duplicate prevention (Section 26):
  // Check if identical unread notification was created recently (within last 30 minutes)
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  let dupQuery = supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('recipient_id', input.recipient_id)
    .eq('type', input.type)
    .eq('is_read', false)
    .gte('created_at', thirtyMinsAgo)
    .limit(1);

  if (input.entity_id) {
    dupQuery = dupQuery.eq('entity_id', input.entity_id);
  } else if (input.title) {
    dupQuery = dupQuery.eq('title', input.title);
  }

  const { data: existingDup } = await dupQuery.maybeSingle();
  if (existingDup?.id) {
    // Duplicate detected, return existing without re-inserting
    return existingDup;
  }

  // Attempt insert with extended fields
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        recipient_id: input.recipient_id,
        title: input.title,
        message: input.message,
        type: input.type,
        category: input.category || 'SYSTEM',
        priority: input.priority || 'MEDIUM',
        entity_type: input.entity_type || null,
        entity_id: input.entity_id || null,
        action_url: input.action_url || null,
        is_read: false,
      })
      .select()
      .single();

    if (!error) return data;

    // If error 42703 (column does not exist), fall back to core schema
    if (error.code === '42703' || error.message?.includes('column')) {
      const { data: fallbackData, error: fbErr } = await supabaseAdmin
        .from('notifications')
        .insert({
          recipient_id: input.recipient_id,
          title: input.title,
          message: input.message,
          type: input.type,
          is_read: false,
        })
        .select()
        .single();

      if (fbErr) throw fbErr;
      return fallbackData;
    }

    throw error;
  } catch (err: any) {
    console.warn('createNotificationRecord notice:', err?.message || err);
    return null;
  }
}

interface AdminRecipientMeta {
  id: string;
  position: string | null;
  permissions: string[];
  canViewPayments: boolean;
}

async function resolveActivePortalAdminsAndSuperAdmins(): Promise<{
  admins: AdminRecipientMeta[];
  superAdminIds: string[];
}> {
  const admins: AdminRecipientMeta[] = [];
  const superAdminIds: string[] = [];

  try {
    const [profilesRes, rolePermsRes] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, role, status')
        .in('role', ['admin', 'ADMIN', 'super_admin', 'SUPER_ADMIN'])
        .eq('status', 'ACTIVE'),
      supabaseAdmin.from('role_permissions').select('permission').eq('role', 'ADMIN'),
    ]);

    const adminProfiles = profilesRes.data || [];
    const rolePolicyRows = (rolePermsRes.data || [])
      .map((r: any) => String(r.permission || '').toUpperCase().trim())
      .filter(Boolean);
    const hasSeededAdminPolicy = rolePolicyRows.length > 0;
    const rolePolicyAllowsPayment =
      !hasSeededAdminPolicy ||
      rolePolicyRows.includes('PAYMENT_VIEW') ||
      rolePolicyRows.includes('PAYMENT_VERIFY') ||
      rolePolicyRows.includes('FINANCIAL_REPORTS') ||
      rolePolicyRows.includes('FINANCIAL_ACCESS');

    const rawAdminIds: string[] = [];
    for (const p of adminProfiles) {
      const normRole = normalizePortalRole(p.role);
      if (normRole === 'SUPER_ADMIN') {
        superAdminIds.push(p.id);
      } else if (normRole === 'ADMIN') {
        rawAdminIds.push(p.id);
      }
    }

    if (rawAdminIds.length > 0) {
      const { data: adminRows } = await supabaseAdmin
        .from('admins')
        .select('profile_id, position, permissions')
        .in('profile_id', rawAdminIds);

      const metaMap = new Map<string, any>();
      for (const row of adminRows || []) {
        metaMap.set(row.profile_id, row);
      }

      for (const id of rawAdminIds) {
        const meta = metaMap.get(id);
        const position = meta?.position || null;
        const rawPerms = Array.isArray(meta?.permissions)
          ? meta.permissions.map((perm: any) => String(perm || '').toUpperCase().trim()).filter(Boolean)
          : [];

        const effectivePerms =
          hasSeededAdminPolicy && rawPerms.length > 0 && !rawPerms.includes('ALL')
            ? rawPerms.filter((perm: string) => {
                if (perm === 'ATTENDANCE_MONITOR') return rolePolicyRows.includes('ATTENDANCE_MANAGE');
                if (perm === 'USER_VIEW') return rolePolicyRows.includes('ENROLLMENT_VIEW');
                if (perm === 'FINANCIAL_REPORTS' || perm === 'FINANCIAL_ACCESS') return rolePolicyRows.includes('PAYMENT_VIEW');
                return rolePolicyRows.includes(perm);
              })
            : rawPerms;

        const canViewPayments = Boolean(
          meta && rolePolicyAllowsPayment && hasAdminFinancialPermission(effectivePerms, position)
        );

        admins.push({
          id,
          position,
          permissions: effectivePerms,
          canViewPayments,
        });
      }
    }
  } catch (err) {
    console.warn('Failed to resolve active portal admins for notification dispatch:', err);
  }

  return { admins, superAdminIds };
}

/**
 * Returns active Admin profile IDs authorized to view financial/payment notifications.
 */
export async function getFinancialAdminRecipientIds(): Promise<string[]> {
  const { admins } = await resolveActivePortalAdminsAndSuperAdmins();
  return admins.filter((a) => a.canViewPayments).map((a) => a.id);
}

/**
 * Dispatch an event according to strict Per-Portal Notification Separation rules.
 * Automatically resolves Trainee, assigned Instructor, RBAC-scoped Admins, and Super Admins.
 */
export async function dispatchNotificationEvent(params: DispatchEventParams): Promise<{ count: number }> {
  const {
    event,
    targetUserId,
    targetRole,
    superAdminId: explicitSuperAdminId,
    adminId: explicitAdminId,
    traineeId,
    instructorId: explicitInstructorId,
    batchId,
    courseId,
    entityType,
    entityId,
    title: customTitle,
    message: customMessage,
    priority: customPriority,
    category: customCategory,
    actionUrl,
    roleOverrides,
  } = params;

  // 1. Evaluate Recipient Rules per Portal Separation Matrix
  // [SUPER_ADMIN, ADMIN, INSTRUCTOR, TRAINEE, defaultPriority, defaultCategory]
  const matrix: Record<NotificationEventType, [boolean, boolean, boolean, boolean, NotificationPriority, NotificationCategory]> = {
    // ACCOUNT / SRN (Trainee self-service only)
    NEW_TRAINEE_REGISTRATION: [false, false, false, true, 'LOW', 'ACCOUNT'],
    GOOGLE_REGISTRATION: [false, false, false, true, 'LOW', 'ACCOUNT'],
    SRN_REQUIRED: [false, false, false, true, 'HIGH', 'ACCOUNT'],
    SRN_UPDATED: [false, false, false, true, 'LOW', 'ACCOUNT'],
    SRN_VALIDATION_FAILED: [false, false, false, true, 'HIGH', 'ACCOUNT'],

    // PERSONAL SECURITY / SELF EVENTS (Targeted to single actor/target user, never cross-portal broadcast)
    ACCOUNT_SECURITY_EVENT: [false, false, false, false, 'HIGH', 'SECURITY'],
    ACCOUNT_REACTIVATED: [false, false, false, false, 'MEDIUM', 'ACCOUNT'],
    MFA_UPDATED: [false, false, false, false, 'MEDIUM', 'SECURITY'],
    PASSWORD_CHANGED: [false, false, false, false, 'MEDIUM', 'SECURITY'],
    SESSION_REVOKED: [false, false, false, false, 'HIGH', 'SECURITY'],

    // SUPER ADMIN GOVERNANCE
    ROLE_PERMISSIONS_UPDATED: [true, false, false, false, 'HIGH', 'SECURITY'],
    ADMIN_ACCOUNT_CREATED: [true, false, false, false, 'MEDIUM', 'ACCOUNT'],

    // ENROLLMENT & PAYMENT (Payment strictly scoped to financial Admins + Trainee)
    NEW_ENROLLMENT: [false, true, false, true, 'MEDIUM', 'ENROLLMENT'],
    ENROLLMENT_PAYMENT_PENDING: [false, true, false, true, 'MEDIUM', 'PAYMENT'],
    PAYMENT_SUBMITTED: [false, true, false, true, 'MEDIUM', 'PAYMENT'],
    PAYMENT_CONFIRMED: [false, true, false, true, 'MEDIUM', 'PAYMENT'],
    ENROLLMENT_ACTIVATED: [false, true, true, true, 'HIGH', 'ENROLLMENT'],
    ENROLLMENT_REJECTED: [false, true, false, true, 'HIGH', 'ENROLLMENT'],
    ENROLLMENT_CANCELLED: [false, true, true, true, 'HIGH', 'ENROLLMENT'],
    ENROLLMENT_COMPLETED: [false, true, true, true, 'LOW', 'ENROLLMENT'],
    PREREQUISITE_FAILED: [false, true, false, true, 'HIGH', 'ENROLLMENT'],

    // BATCH & SCHEDULE & INSTRUCTOR LEAVES
    BATCH_CREATED: [false, true, false, false, 'LOW', 'BATCH'],
    BATCH_ALMOST_FULL: [false, true, false, false, 'MEDIUM', 'BATCH'],
    BATCH_FULL: [false, true, false, true, 'HIGH', 'BATCH'],
    BATCH_STARTING_SOON: [false, true, true, true, 'MEDIUM', 'BATCH'],
    BATCH_STARTED: [false, true, true, true, 'LOW', 'BATCH'],
    BATCH_COMPLETED: [false, true, true, true, 'LOW', 'BATCH'],
    BATCH_CANCELLED: [false, true, true, true, 'HIGH', 'BATCH'],
    SCHEDULE_CHANGED: [false, true, true, true, 'HIGH', 'SCHEDULE'],
    SESSION_CANCELLED: [false, true, true, true, 'HIGH', 'SCHEDULE'],
    VENUE_CHANGED: [false, true, true, true, 'MEDIUM', 'SCHEDULE'],
    INSTRUCTOR_ASSIGNED: [false, true, true, false, 'MEDIUM', 'SCHEDULE'],
    INSTRUCTOR_ASSIGNMENT_CHANGED: [false, true, true, false, 'MEDIUM', 'SCHEDULE'],
    INSTRUCTOR_CONFLICT: [false, true, false, false, 'HIGH', 'SCHEDULE'],
    SUBSTITUTE_ASSIGNED: [false, true, true, false, 'MEDIUM', 'SCHEDULE'],
    LEAVE_REQUEST_SUBMITTED: [false, true, false, false, 'MEDIUM', 'SCHEDULE'],
    LEAVE_APPROVED: [false, false, true, false, 'MEDIUM', 'SCHEDULE'],
    LEAVE_REJECTED: [false, false, true, false, 'HIGH', 'SCHEDULE'],

    // ATTENDANCE & PROGRESS
    ATTENDANCE_RECORDED: [false, false, false, true, 'LOW', 'ATTENDANCE'],
    TRAINEE_LATE: [false, true, true, true, 'MEDIUM', 'ATTENDANCE'],
    TRAINEE_ABSENT: [false, true, true, true, 'HIGH', 'ATTENDANCE'],
    LOW_ATTENDANCE: [false, true, true, true, 'HIGH', 'ATTENDANCE'],
    DAILY_LESSON_READY: [false, false, false, true, 'MEDIUM', 'PROGRESS'],
    TRAINEE_FALLING_BEHIND: [false, true, true, true, 'HIGH', 'PROGRESS'],
    MODULE_COMPLETED: [false, false, true, true, 'LOW', 'PROGRESS'],
    PRACTICAL_COMPLETED: [false, true, true, true, 'LOW', 'PRACTICAL'],
    TRAINING_COMPLETED: [false, true, true, true, 'LOW', 'PROGRESS'],

    // ASSESSMENT
    ASSESSMENT_ASSIGNED: [false, false, false, true, 'MEDIUM', 'ASSESSMENT'],
    ASSESSMENT_SUBMITTED: [false, false, true, true, 'MEDIUM', 'ASSESSMENT'],
    ASSESSMENT_PENDING_GRADING: [false, false, true, false, 'MEDIUM', 'ASSESSMENT'],
    ASSESSMENT_GRADED: [false, false, false, true, 'MEDIUM', 'ASSESSMENT'],
    PRACTICAL_ASSESSMENT_REQUIRED: [false, false, true, true, 'MEDIUM', 'PRACTICAL'],

    // CERTIFICATION
    CERTIFICATION_ENDORSEMENT_REQUIRED: [false, false, true, false, 'HIGH', 'CERTIFICATION'],
    CERTIFICATION_ENDORSED: [false, true, false, true, 'MEDIUM', 'CERTIFICATION'],
    CERTIFICATION_UNDER_REVIEW: [false, true, false, true, 'MEDIUM', 'CERTIFICATION'],
    CERTIFICATION_APPROVED: [false, true, true, true, 'HIGH', 'CERTIFICATION'],
    CERTIFICATE_PREVIEW_AVAILABLE: [false, false, false, true, 'LOW', 'CERTIFICATION'],
    CERTIFICATE_READY_FOR_RELEASE: [false, true, false, true, 'LOW', 'CERTIFICATION'],
    CERTIFICATION_REQUIREMENT_MISSING: [false, true, true, true, 'HIGH', 'CERTIFICATION'],

    // SYSTEM & SECURITY (Super Admin Only)
    SYSTEM_ERROR: [true, false, false, false, 'HIGH', 'SYSTEM'],
    SECURITY_ALERT: [true, false, false, false, 'HIGH', 'SECURITY'],
  };

  const rule = matrix[event] || [false, true, false, false, 'MEDIUM', 'SYSTEM'];
  const [matrixSuperAdmin, matrixAdmin, matrixInstructor, matrixTrainee, defaultPriority, defaultCategory] = rule;
  const priority = customPriority || defaultPriority;
  const category = customCategory || defaultCategory;

  const isTargetSelfEvent =
    event === 'MFA_UPDATED' ||
    event === 'PASSWORD_CHANGED' ||
    event === 'ACCOUNT_REACTIVATED' ||
    event === 'SESSION_REVOKED' ||
    event === 'ACCOUNT_SECURITY_EVENT';

  const meta: Record<string, any> = { ...(params.metadata || {}) };

  // 2. Resolve Active Admins & Super Admins only when needed
  let resolvedAdmins: AdminRecipientMeta[] = [];
  let resolvedSuperAdminIds: string[] = [];

  if (
    matrixSuperAdmin ||
    matrixAdmin ||
    Boolean(meta.escalateToSuperAdmin)
  ) {
    if (explicitSuperAdminId) {
      resolvedSuperAdminIds = [explicitSuperAdminId];
    }
    if (explicitAdminId) {
      const { admins } = await resolveActivePortalAdminsAndSuperAdmins();
      const matched = admins.find((a) => a.id === explicitAdminId);
      resolvedAdmins = matched
        ? [matched]
        : [{ id: explicitAdminId, position: null, permissions: [], canViewPayments: false }];
      if (matrixSuperAdmin && !explicitSuperAdminId) {
        const { superAdminIds } = await resolveActivePortalAdminsAndSuperAdmins();
        resolvedSuperAdminIds = superAdminIds;
      }
    } else {
      const resolved = await resolveActivePortalAdminsAndSuperAdmins();
      if (!explicitSuperAdminId) resolvedSuperAdminIds = resolved.superAdminIds;
      resolvedAdmins = resolved.admins;
    }
  }

  // 3. Auto-enrich metadata (traineeName, courseName, batchName, instructorName, srn) & Instructor IDs
  let effectiveBatchId = batchId;
  let effectiveCourseId = courseId;

  if (traineeId && (!effectiveBatchId && effectiveCourseId)) {
    try {
      const { data: enrRow } = await supabaseAdmin
        .from('enrollments')
        .select('batch_id')
        .eq('trainee_id', traineeId)
        .eq('course_id', effectiveCourseId)
        .in('status', ['ACTIVE', 'CONFIRMED', 'COMPLETED', 'PENDING', 'PENDING_PAYMENT'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (enrRow?.batch_id) effectiveBatchId = enrRow.batch_id;
    } catch {}
  }

  const instructorIdSet = new Set<string>();
  if (explicitInstructorId) instructorIdSet.add(explicitInstructorId);

  if (effectiveBatchId) {
    try {
      const { data: bData } = await supabaseAdmin
        .from('batches')
        .select('instructor_id, batch_code, course_id, courses(id, name, code)')
        .eq('id', effectiveBatchId)
        .maybeSingle();
      if (bData) {
        if (bData.instructor_id && instructorIdSet.size === 0) instructorIdSet.add(bData.instructor_id);
        if (!meta.batchName) meta.batchName = bData.batch_code;
        if (!effectiveCourseId && bData.course_id) effectiveCourseId = bData.course_id;
        const bCourse: any = bData.courses;
        if (bCourse && !meta.courseName) meta.courseName = bCourse.name;
      }
    } catch {}
  }

  if (matrixInstructor && instructorIdSet.size === 0 && effectiveBatchId) {
    try {
      const { data: schedRows } = await supabaseAdmin
        .from('schedules')
        .select('instructor_id, substitute_instructor_id')
        .eq('batch_id', effectiveBatchId)
        .neq('status', 'CANCELLED')
        .limit(5);
      for (const s of schedRows || []) {
        if (s.instructor_id) instructorIdSet.add(s.instructor_id);
        if (s.substitute_instructor_id) instructorIdSet.add(s.substitute_instructor_id);
      }
    } catch {}
  }

  if (matrixInstructor && instructorIdSet.size === 0 && effectiveCourseId) {
    try {
      const { data: schedCourseRows } = await supabaseAdmin
        .from('schedules')
        .select('instructor_id, substitute_instructor_id')
        .eq('course_id', effectiveCourseId)
        .neq('status', 'CANCELLED')
        .limit(5);
      for (const s of schedCourseRows || []) {
        if (s.instructor_id) instructorIdSet.add(s.instructor_id);
        if (s.substitute_instructor_id) instructorIdSet.add(s.substitute_instructor_id);
      }
      if (instructorIdSet.size === 0) {
        const { data: ciRows } = await supabaseAdmin
          .from('course_instructors')
          .select('instructor_id')
          .eq('course_id', effectiveCourseId)
          .limit(5);
        for (const ci of ciRows || []) {
          if (ci.instructor_id) instructorIdSet.add(ci.instructor_id);
        }
      }
    } catch {}
  }

  const resolvedInstructorIds = Array.from(instructorIdSet);

  if (traineeId && !meta.traineeName) {
    try {
      const { data: tp } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', traineeId)
        .maybeSingle();
      if (tp) {
        const fullName = `${tp.first_name || ''} ${tp.last_name || ''}`.trim();
        meta.traineeName = fullName || tp.email || 'Maritime Trainee';
        meta.traineeEmail = tp.email;
      }
    } catch {}
  }

  if (resolvedInstructorIds.length > 0 && !meta.instructorName) {
    try {
      const { data: ip } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', resolvedInstructorIds[0])
        .maybeSingle();
      if (ip) {
        const fullName = `${ip.first_name || ''} ${ip.last_name || ''}`.trim();
        meta.instructorName = fullName || ip.email || 'Instructor';
      }
    } catch {}
  }

  if (effectiveCourseId && !meta.courseName) {
    try {
      const { data: cData } = await supabaseAdmin
        .from('courses')
        .select('name, code')
        .eq('id', effectiveCourseId)
        .maybeSingle();
      if (cData?.name) meta.courseName = cData.name;
    } catch {}
  }

  // Fallbacks
  const traineeName = meta.traineeName || 'Trainee';
  const instructorName = meta.instructorName || 'Instructor';
  const courseName = meta.courseName || 'Maritime Training Program';
  const batchName = meta.batchName || 'Cohort';
  const srn = meta.srn || 'SRN';
  const amount = meta.amount ? `PHP ${Number(meta.amount).toLocaleString()}` : '';
  const reason = meta.reason || '';

  const enabledRolesCount =
    (matrixSuperAdmin ? 1 : 0) +
    (matrixAdmin ? 1 : 0) +
    (matrixInstructor ? 1 : 0) +
    (matrixTrainee ? 1 : 0);

  // Helper to generate strictly role-separated copy & portal-verified actionUrl
  const getRoleNotification = (role: PortalUserRole) => {
    const override = roleOverrides?.[role];
    const allowSingleRoleCustomOverride =
      enabledRolesCount <= 1 || isTargetSelfEvent || Boolean(targetUserId && targetRole === role);

    let t = override?.title ?? (allowSingleRoleCustomOverride ? customTitle : undefined);
    let m = override?.message ?? (allowSingleRoleCustomOverride ? customMessage : undefined);
    let u = override?.actionUrl ?? (allowSingleRoleCustomOverride ? actionUrl : undefined);

    if (!t || !m || !u) {
      switch (event) {
        case 'NEW_TRAINEE_REGISTRATION':
          t = t || 'Welcome to NEWSIM';
          m = m || 'Your trainee account has been registered successfully. Explore courses to get started.';
          u = u || '/my-courses';
          break;

        case 'GOOGLE_REGISTRATION':
          t = t || 'Complete Your Profile';
          m = m || "Please add your Seafarer's Registration Number in Settings before enrolling in a course.";
          u = u || '/settings';
          break;

        case 'SRN_REQUIRED':
          t = t || 'SRN Required';
          m = m || "Please enter your Seafarer's Registration Number before applying for enrollment.";
          u = u || '/settings';
          break;

        case 'SRN_UPDATED':
          t = t || 'SRN Saved';
          m = m || `Your Seafarer's Registration Number (${srn}) has been updated successfully.`;
          u = u || '/settings';
          break;

        case 'SRN_VALIDATION_FAILED':
          t = t || 'Invalid SRN';
          m = m || 'The SRN entered is invalid or already associated with another trainee account.';
          u = u || '/settings';
          break;

        case 'MFA_UPDATED':
          t = t || 'Two-Factor Authentication Updated';
          m = m || meta.detail || 'Your Two-Factor Authentication (TOTP) or recovery codes configuration was updated.';
          u = u || (
            role === 'SUPER_ADMIN'
              ? '/super-admin/settings'
              : role === 'ADMIN'
                ? '/admin/settings'
                : role === 'INSTRUCTOR'
                  ? '/profile'
                  : '/settings'
          );
          break;

        case 'PASSWORD_CHANGED':
          t = t || 'Password Updated';
          m = m || 'Your account password was changed successfully. Contact support immediately if you did not authorize this change.';
          u = u || (
            role === 'SUPER_ADMIN'
              ? '/super-admin/settings'
              : role === 'ADMIN'
                ? '/admin/settings'
                : role === 'INSTRUCTOR'
                  ? '/profile'
                  : '/settings'
          );
          break;

        case 'ACCOUNT_REACTIVATED':
          t = t || 'Account Reactivated';
          m = m || 'Your account has been reactivated by administration. You may now sign in normally.';
          u = u || (
            role === 'SUPER_ADMIN'
              ? '/super-admin/settings'
              : role === 'ADMIN'
                ? '/admin/settings'
                : role === 'INSTRUCTOR'
                  ? '/profile'
                  : '/settings'
          );
          break;

        case 'SESSION_REVOKED':
          if (role === 'SUPER_ADMIN' && !meta.isSelfTarget) {
            t = t || 'Session Terminated';
            m = m || `Security action terminated active session${meta.targetEmail ? ` for ${meta.targetEmail}` : ''}.`;
            u = u || '/super-admin/security';
          } else {
            t = t || 'Active Session Revoked';
            m = m || 'One of your active login sessions was revoked by security administration.';
            u = u || (
              role === 'SUPER_ADMIN'
                ? '/super-admin/security'
                : role === 'ADMIN'
                  ? '/admin/settings'
                  : role === 'INSTRUCTOR'
                    ? '/profile'
                    : '/settings'
            );
          }
          break;

        case 'ACCOUNT_SECURITY_EVENT':
          if (role === 'SUPER_ADMIN') {
            t = t || 'Account Security Incident';
            m = m || meta.securityMessage || `Security protection triggered for ${meta.targetEmail || traineeName || 'an account'}.`;
            u = u || '/super-admin/security';
          } else {
            t = t || 'Account Security Notice';
            m = m || meta.securityMessage || 'A security event occurred on your account. Review your security settings.';
            u = u || (role === 'ADMIN' ? '/admin/settings' : role === 'INSTRUCTOR' ? '/profile' : '/settings');
          }
          break;

        case 'ROLE_PERMISSIONS_UPDATED':
          t = t || 'RBAC Policy Updated';
          m = m || `Role permissions policy for ${meta.targetRole || 'portal role'} was updated.`;
          u = u || '/super-admin/roles-permissions';
          break;

        case 'ADMIN_ACCOUNT_CREATED':
          t = t || 'New Administrator Provisioned';
          m = m || `Administrator account created for ${meta.adminName || meta.adminEmail || 'new admin'}.`;
          u = u || '/super-admin/admins';
          break;

        case 'NEW_ENROLLMENT':
          if (role === 'TRAINEE') {
            t = t || 'Enrollment Application Submitted';
            m = m || `Your application for ${courseName} - Batch ${batchName} has been received.`;
            u = u || '/enrollment';
          } else {
            t = t || 'New Enrollment Application';
            m = m || `${traineeName} applied for ${courseName} - ${batchName}.`;
            u = u || '/admin/enrollments';
          }
          break;

        case 'ENROLLMENT_PAYMENT_PENDING':
          if (role === 'TRAINEE') {
            t = t || 'Payment Pending';
            m = m || `Please proceed with payment for ${courseName} to secure your seat.`;
            u = u || '/payments';
          } else {
            t = t || 'Enrollment Awaiting Payment';
            m = m || `${traineeName}'s enrollment for ${batchName} is awaiting payment.`;
            u = u || '/admin/payments';
          }
          break;

        case 'PAYMENT_SUBMITTED':
          if (role === 'TRAINEE') {
            t = t || 'Payment Submitted';
            m = m || `Your payment of ${amount || 'tuition'} via ${meta.method || 'PayMongo'} is being verified.`;
            u = u || '/payments';
          } else {
            t = t || 'Payment Verification Required';
            m = m || `${traineeName} submitted payment for ${courseName}.`;
            u = u || '/admin/payments';
          }
          break;

        case 'PAYMENT_CONFIRMED':
          if (role === 'TRAINEE') {
            t = t || 'Payment Confirmed';
            m = m || `Your payment for ${courseName} has been confirmed. You are officially enrolled.`;
            u = u || '/payments';
          } else {
            t = t || 'Payment Confirmed';
            m = m || `Payment of ${amount || 'tuition'} confirmed for ${traineeName}.`;
            u = u || '/admin/payments';
          }
          break;

        case 'ENROLLMENT_ACTIVATED':
          if (role === 'TRAINEE') {
            t = t || 'Enrollment Activated';
            m = m || `Your enrollment for ${courseName} is now active. You may now access training modules.`;
            u = u || '/my-courses';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'New Trainee Enrolled';
            m = m || `${traineeName} has joined your batch ${batchName} for ${courseName}.`;
            u = u || '/trainees';
          } else {
            t = t || 'Enrollment Activated';
            m = m || `${traineeName} has been activated in ${batchName}.`;
            u = u || '/admin/enrollments';
          }
          break;

        case 'ENROLLMENT_REJECTED':
          if (role === 'TRAINEE') {
            t = t || 'Enrollment Not Approved';
            m = m || `Your enrollment for ${courseName} was not approved: ${reason || 'Application requirements not met'}.`;
            u = u || '/enrollment';
          } else {
            t = t || 'Enrollment Rejected';
            m = m || `Enrollment rejected for ${traineeName} in ${batchName}.`;
            u = u || '/admin/enrollments';
          }
          break;

        case 'ENROLLMENT_CANCELLED':
          if (role === 'TRAINEE') {
            t = t || 'Enrollment Cancelled';
            m = m || `Your enrollment in ${courseName} (${batchName}) has been cancelled.`;
            u = u || '/enrollment';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Trainee Withdrawn from Batch';
            m = m || `${traineeName}'s enrollment in ${batchName} (${courseName}) was cancelled.`;
            u = u || '/trainees';
          } else {
            t = t || 'Enrollment Cancelled';
            m = m || `${traineeName}'s enrollment in ${courseName} (${batchName}) was cancelled.`;
            u = u || '/admin/enrollments';
          }
          break;

        case 'ENROLLMENT_COMPLETED':
          if (role === 'TRAINEE') {
            t = t || 'Course Enrollment Completed';
            m = m || `You have completed your training requirements for ${courseName}.`;
            u = u || '/certificates';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Trainee Completed Course';
            m = m || `${traineeName} has completed ${courseName} (${batchName}).`;
            u = u || '/trainees';
          } else {
            t = t || 'Enrollment Completed';
            m = m || `${traineeName} completed ${courseName} (${batchName}).`;
            u = u || '/admin/enrollments';
          }
          break;

        case 'PREREQUISITE_FAILED':
          if (role === 'TRAINEE') {
            t = t || 'Prerequisite Required';
            m = m || `Enrollment blocked: You have not completed the prerequisite for ${courseName}.`;
            u = u || '/enrollment';
          } else {
            t = t || 'Prerequisite Check Failed';
            m = m || `${traineeName} was blocked from enrolling in ${courseName} due to missing prerequisite.`;
            u = u || '/admin/enrollments';
          }
          break;

        case 'BATCH_CREATED':
          t = t || 'New Batch Created';
          m = m || `Batch ${batchName} for ${courseName} has been scheduled.`;
          u = u || '/admin/batches';
          break;

        case 'BATCH_ALMOST_FULL':
          t = t || 'Batch Nearing Capacity';
          m = m || `Batch ${batchName} has reached near-maximum capacity (${meta.currentCount || 20}/${meta.maxCount || 24} trainees).`;
          u = u || '/admin/batches';
          break;

        case 'BATCH_FULL':
          if (role === 'TRAINEE') {
            t = t || 'Batch Full';
            m = m || 'The selected batch is full. Please select an alternate schedule.';
            u = u || '/enrollment';
          } else {
            t = t || 'Batch Full';
            m = m || `Batch ${batchName} is now full (${meta.maxCount || 24}/${meta.maxCount || 24}). Overbooking locked.`;
            u = u || '/admin/batches';
          }
          break;

        case 'BATCH_STARTING_SOON':
          if (role === 'TRAINEE') {
            t = t || 'Training Starts Soon';
            m = m || `Your batch ${batchName} for ${courseName} begins shortly. Check your schedule.`;
            u = u || '/schedules';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Assigned Batch Starting Soon';
            m = m || `Your assigned batch ${batchName} for ${courseName} begins shortly.`;
            u = u || '/schedules';
          } else {
            t = t || 'Batch Starting Soon';
            m = m || `Batch ${batchName} (${courseName}) is scheduled to begin shortly.`;
            u = u || '/admin/schedules';
          }
          break;

        case 'BATCH_STARTED':
          if (role === 'TRAINEE') {
            t = t || 'Training Started';
            m = m || `Batch ${batchName} for ${courseName} is now underway. Open your learning modules.`;
            u = u || '/learning';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Batch Training Started';
            m = m || `Batch ${batchName} for ${courseName} has commenced.`;
            u = u || '/schedules';
          } else {
            t = t || 'Batch Started';
            m = m || `Batch ${batchName} (${courseName}) has started.`;
            u = u || '/admin/schedules';
          }
          break;

        case 'BATCH_COMPLETED':
          if (role === 'TRAINEE') {
            t = t || 'Batch Training Completed';
            m = m || `Batch ${batchName} for ${courseName} has concluded.`;
            u = u || '/certificates';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Batch Concluded';
            m = m || `Batch ${batchName} (${courseName}) has completed. Finalize grades and endorsements.`;
            u = u || '/trainees';
          } else {
            t = t || 'Batch Completed';
            m = m || `Batch ${batchName} (${courseName}) has completed.`;
            u = u || '/admin/certificates';
          }
          break;

        case 'BATCH_CANCELLED':
          if (role === 'TRAINEE') {
            t = t || 'Batch Schedule Cancelled';
            m = m || `Batch ${batchName} for ${courseName} has been cancelled by administration.`;
            u = u || '/schedules';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Assigned Batch Cancelled';
            m = m || `Your batch ${batchName} (${courseName}) has been cancelled.`;
            u = u || '/schedules';
          } else {
            t = t || 'Batch Cancelled';
            m = m || `Batch ${batchName} has been cancelled.`;
            u = u || '/admin/schedules';
          }
          break;

        case 'SCHEDULE_CHANGED':
          if (role === 'TRAINEE') {
            t = t || 'Schedule Update';
            m = m || `The schedule for ${courseName} - Batch ${batchName} has changed.`;
            u = u || '/schedules';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Teaching Schedule Updated';
            m = m || `Schedule for your batch ${batchName} (${courseName}) has been updated.`;
            u = u || '/schedules';
          } else {
            t = t || 'Schedule Modified';
            m = m || `Batch ${batchName} schedule was updated.`;
            u = u || '/admin/schedules';
          }
          break;

        case 'SESSION_CANCELLED':
          if (role === 'TRAINEE') {
            t = t || 'Training Session Cancelled';
            m = m || `A training session for ${courseName} (${batchName}) has been cancelled.`;
            u = u || '/schedules';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Session Cancelled';
            m = m || `A scheduled session for ${courseName} (${batchName}) has been cancelled.`;
            u = u || '/schedules';
          } else {
            t = t || 'Training Session Cancelled';
            m = m || `Session for ${courseName} (${batchName}) was cancelled.`;
            u = u || '/admin/schedules';
          }
          break;

        case 'VENUE_CHANGED':
          if (role === 'TRAINEE') {
            t = t || 'Training Venue Changed';
            m = m || `Room/venue updated for ${courseName} (${batchName})${meta.room ? ` to ${meta.room}` : ''}.`;
            u = u || '/schedules';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Session Venue Updated';
            m = m || `Venue updated for ${courseName} (${batchName})${meta.room ? ` to ${meta.room}` : ''}.`;
            u = u || '/schedules';
          } else {
            t = t || 'Session Venue Changed';
            m = m || `Venue changed for ${courseName} (${batchName})${meta.room ? ` to ${meta.room}` : ''}.`;
            u = u || '/admin/schedules';
          }
          break;

        case 'INSTRUCTOR_ASSIGNED':
          if (role === 'INSTRUCTOR') {
            t = t || 'New Teaching Assignment';
            m = m || `You have been assigned to instruct ${courseName} (${batchName}).`;
            u = u || '/schedules';
          } else {
            t = t || 'Instructor Assigned';
            m = m || `${instructorName} assigned to ${courseName} (${batchName}).`;
            u = u || '/admin/schedules';
          }
          break;

        case 'INSTRUCTOR_ASSIGNMENT_CHANGED':
          if (role === 'INSTRUCTOR') {
            t = t || 'Teaching Assignment Updated';
            m = m || `Your instructor assignment for ${courseName} (${batchName}) has been updated.`;
            u = u || '/schedules';
          } else {
            t = t || 'Instructor Assignment Changed';
            m = m || `Instructor assignment updated for ${courseName} (${batchName}).`;
            u = u || '/admin/schedules';
          }
          break;

        case 'INSTRUCTOR_CONFLICT':
          t = t || 'Instructor Schedule Conflict';
          m = m || `Schedule conflict detected for ${instructorName} on ${courseName} (${batchName}).`;
          u = u || '/admin/schedules';
          break;

        case 'SUBSTITUTE_ASSIGNED':
          if (role === 'INSTRUCTOR') {
            t = t || 'Substitute Session Assignment';
            m = m || `You have been assigned as substitute instructor for ${courseName}${meta.sessionDate ? ` on ${meta.sessionDate}` : ''}.`;
            u = u || '/schedules';
          } else {
            t = t || 'Substitute Instructor Assigned';
            m = m || `${meta.substituteName || instructorName} assigned as substitute for ${courseName}.`;
            u = u || '/admin/schedules';
          }
          break;

        case 'LEAVE_REQUEST_SUBMITTED':
          t = t || 'Instructor Leave Request';
          m = m || `${instructorName} submitted a leave request (${meta.startDate || 'upcoming'}${meta.endDate ? ` to ${meta.endDate}` : ''}).`;
          u = u || '/admin/leaves';
          break;

        case 'LEAVE_APPROVED':
          t = t || 'Leave Request Approved';
          m = m || `Your leave request${meta.startDate ? ` (${meta.startDate}${meta.endDate ? ` to ${meta.endDate}` : ''})` : ''} has been approved.`;
          u = u || '/leave';
          break;

        case 'LEAVE_REJECTED':
          t = t || 'Leave Request Not Approved';
          m = m || `Your leave request${meta.startDate ? ` (${meta.startDate}${meta.endDate ? ` to ${meta.endDate}` : ''})` : ''} was rejected${reason ? `: ${reason}` : '.'}`;
          u = u || '/leave';
          break;

        case 'ATTENDANCE_RECORDED':
          t = t || 'Attendance Recorded';
          m = m || `Your attendance for ${courseName} (${meta.sessionDate || 'today'}) was marked as ${meta.status || 'PRESENT'}.`;
          u = u || '/attendance';
          break;

        case 'TRAINEE_LATE':
          if (role === 'TRAINEE') {
            t = t || 'Late Arrival Recorded';
            m = m || `You were marked late for ${courseName} (${meta.sessionDate || "today's session"}).`;
            u = u || '/attendance';
          } else {
            t = t || 'Trainee Late';
            m = m || `${traineeName} arrived late for ${courseName} (${batchName}).`;
            u = u || (role === 'INSTRUCTOR' ? '/attendance' : '/admin/attendance');
          }
          break;

        case 'TRAINEE_ABSENT':
          if (role === 'TRAINEE') {
            t = t || 'Absence Recorded';
            m = m || `You were marked absent for ${courseName} (${meta.sessionDate || "today's session"}). Regular attendance is required for STCW certification.`;
            u = u || '/attendance';
          } else {
            t = t || 'Trainee Absent';
            m = m || `${traineeName} was absent for ${courseName} (${batchName}).`;
            u = u || (role === 'INSTRUCTOR' ? '/attendance' : '/admin/attendance');
          }
          break;

        case 'LOW_ATTENDANCE':
          if (role === 'TRAINEE') {
            t = t || 'Attendance Warning';
            m = m || `Your attendance rate in ${courseName} is below minimum STCW requirements. Attend upcoming sessions to stay eligible.`;
            u = u || '/attendance';
          } else {
            t = t || 'Low Trainee Attendance Alert';
            m = m || `${traineeName} has dropped below the minimum attendance threshold in ${courseName}.`;
            u = u || (role === 'INSTRUCTOR' ? '/attendance' : '/admin/attendance');
          }
          break;

        case 'DAILY_LESSON_READY':
          t = t || "Your Lesson Today is Ready - Don't Miss Out!";
          m = m || `Day ${meta.dayNumber || ''}: ${meta.moduleTitle || courseName} is ready today${meta.scheduledDate ? ` (${meta.scheduledDate})` : ''}. Complete your reading and module quiz before 11:59 PM.`;
          u = u || (effectiveCourseId ? `/learning?courseId=${effectiveCourseId}` : '/learning');
          break;

        case 'TRAINEE_FALLING_BEHIND':
          if (role === 'TRAINEE') {
            t = t || `Notice: Module Marked as FAILED - ${meta.moduleTitle || courseName}`;
            m = m || `You did not complete Day ${meta.dayNumber || ''} (${meta.moduleTitle || courseName}) on its scheduled date (${meta.scheduledDate || 'today'}). Under STCW daily progression guidelines, this module is automatically marked as failed.`;
            u = u || (effectiveCourseId ? `/learning?courseId=${effectiveCourseId}` : '/learning');
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Trainee Missed Daily Module';
            m = m || `${traineeName} missed Day ${meta.dayNumber || ''} (${meta.moduleTitle || courseName}) scheduled for ${meta.scheduledDate || 'today'}.`;
            u = u || '/progress';
          } else {
            t = t || 'Trainee Daily Module Failure';
            m = m || `${traineeName} missed Day ${meta.dayNumber || ''} (${meta.moduleTitle || courseName}) under STCW daily progression.`;
            u = u || '/admin/enrollments';
          }
          break;

        case 'MODULE_COMPLETED':
          if (role === 'TRAINEE') {
            t = t || 'Module Completed';
            m = m || `You completed ${meta.moduleTitle || 'a training module'} in ${courseName}.`;
            u = u || '/progress';
          } else {
            t = t || 'Trainee Completed Module';
            m = m || `${traineeName} completed ${meta.moduleTitle || 'a module'} in ${courseName}.`;
            u = u || '/progress';
          }
          break;

        case 'PRACTICAL_COMPLETED':
          if (role === 'TRAINEE') {
            t = t || 'Practical Evaluation Recorded';
            m = m || `Your practical assessment for ${courseName} has been recorded.`;
            u = u || '/progress';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Practical Assessment Completed';
            m = m || `Practical evaluation completed for ${traineeName} in ${courseName}.`;
            u = u || '/grades';
          } else {
            t = t || 'Practical Assessment Logged';
            m = m || `${traineeName} completed practical evaluation for ${courseName}.`;
            u = u || '/admin/certificates';
          }
          break;

        case 'TRAINING_COMPLETED':
          if (role === 'TRAINEE') {
            t = t || 'Course Training Completed';
            m = m || `Congratulations! You have completed all training modules for ${courseName}.`;
            u = u || '/certificates';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Trainee Ready for Endorsement';
            m = m || `${traineeName} completed training requirements for ${courseName}.`;
            u = u || '/trainees';
          } else {
            t = t || 'Training Requirements Completed';
            m = m || `${traineeName} completed training requirements for ${courseName}.`;
            u = u || '/admin/certificates';
          }
          break;

        case 'ASSESSMENT_ASSIGNED':
          t = t || 'New Assessment Assigned';
          m = m || `A new assessment (${meta.assessmentTitle || courseName}) is available for your course.`;
          u = u || '/assessments';
          break;

        case 'ASSESSMENT_SUBMITTED':
          if (role === 'TRAINEE') {
            t = t || 'Assessment Submitted';
            m = m || `Your ${meta.assessmentTitle || 'assessment'} for ${courseName} has been submitted.`;
            u = u || '/assessments';
          } else {
            t = t || 'Assessment Pending Review';
            m = m || `${traineeName} submitted ${meta.assessmentTitle || 'assessment'} in ${courseName} for grading.`;
            u = u || '/assessments';
          }
          break;

        case 'ASSESSMENT_PENDING_GRADING':
          t = t || 'Assessment Pending Grading';
          m = m || `${traineeName}'s submission for ${meta.assessmentTitle || courseName} requires manual grading.`;
          u = u || '/assessments';
          break;

        case 'ASSESSMENT_GRADED':
          t = t || 'Assessment Graded';
          m = m || `Your assessment for ${courseName} has been graded: ${meta.score !== undefined ? `${meta.score}%` : 'Graded'} (${meta.passed ? 'PASSED' : 'COMPLETED'}).`;
          u = u || '/grades';
          break;

        case 'PRACTICAL_ASSESSMENT_REQUIRED':
          if (role === 'TRAINEE') {
            t = t || 'Practical Assessment Required';
            m = m || `Please complete your practical assessment for ${courseName}.`;
            u = u || '/assessments';
          } else {
            t = t || 'Practical Assessment Needed';
            m = m || `${traineeName} is ready for practical rubric grading in ${courseName}.`;
            u = u || '/assessments';
          }
          break;

        case 'CERTIFICATION_ENDORSEMENT_REQUIRED':
          t = t || 'Certificate Endorsement Required';
          m = m || `${traineeName} has completed ${courseName} and awaits your instructor endorsement.`;
          u = u || '/trainees';
          break;

        case 'CERTIFICATION_ENDORSED':
          if (role === 'TRAINEE') {
            t = t || 'Endorsement Complete';
            m = m || `Instructor ${instructorName} has endorsed your completion of ${courseName}.`;
            u = u || '/certificates';
          } else {
            t = t || 'Endorsement Submitted';
            m = m || `Instructor endorsed ${traineeName} for ${courseName}.`;
            u = u || '/admin/certificates';
          }
          break;

        case 'CERTIFICATION_UNDER_REVIEW':
          if (role === 'TRAINEE') {
            t = t || 'Certificate Under Review';
            m = m || `Your certificate application for ${courseName} is currently under administrative review.`;
            u = u || '/certificates';
          } else {
            t = t || 'Certificate Pending Review';
            m = m || `Certificate issuance for ${traineeName} (${courseName}) is under review.`;
            u = u || '/admin/certificates';
          }
          break;

        case 'CERTIFICATION_APPROVED':
          if (role === 'TRAINEE') {
            t = t || 'Certificate Issued';
            m = m || `Your certificate for ${courseName} has been approved and issued! View your certificate.`;
            u = u || '/certificates';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Certificate Issued';
            m = m || `Certificate issued for ${traineeName} in ${courseName}.`;
            u = u || '/trainees';
          } else {
            t = t || 'Certificate Approved';
            m = m || `Certificate ${meta.certNumber || ''} approved for ${traineeName}.`;
            u = u || '/admin/certificates';
          }
          break;

        case 'CERTIFICATE_PREVIEW_AVAILABLE':
          t = t || 'Certificate Ready to Preview';
          m = m || `Your digital certificate preview for ${courseName} is now available.`;
          u = u || '/certificates';
          break;

        case 'CERTIFICATE_READY_FOR_RELEASE':
          if (role === 'TRAINEE') {
            t = t || 'Certificate Ready for Release';
            m = m || `Your physical/official certificate for ${courseName} is ready for release.`;
            u = u || '/certificates';
          } else {
            t = t || 'Certificate Ready for Release';
            m = m || `${traineeName}'s certificate for ${courseName} is ready for release.`;
            u = u || '/admin/certificates';
          }
          break;

        case 'CERTIFICATION_REQUIREMENT_MISSING':
          if (role === 'TRAINEE') {
            t = t || 'Certificate Requirement Missing';
            m = m || `Certificate cannot be issued: ${reason || 'Attendance or assessment requirements incomplete'}.`;
            u = u || '/certificates';
          } else if (role === 'INSTRUCTOR') {
            t = t || 'Trainee Missing Certification Requirement';
            m = m || `${traineeName} is missing requirements for ${courseName}: ${reason || 'Attendance or assessment incomplete'}.`;
            u = u || '/trainees';
          } else {
            t = t || 'Certificate Requirement Missing';
            m = m || `Certificate requirement missing for ${traineeName}: ${reason || 'Attendance or assessment incomplete'}.`;
            u = u || '/admin/certificates';
          }
          break;

        case 'SECURITY_ALERT':
          t = t || 'Critical Security Alert';
          m = m || meta.securityMessage || 'A security incident was detected and logged for Super Admin review.';
          u = u || '/super-admin/security';
          break;

        case 'SYSTEM_ERROR':
          t = t || 'System Health Alert';
          m = m || meta.errorMessage || 'A critical platform error occurred. Inspect audit logs.';
          u = u || '/super-admin/audit-logs';
          break;

        default:
          t = t || 'Portal Notification';
          m = m || 'A new update occurred in your portal.';
          u = u || (
            role === 'SUPER_ADMIN'
              ? '/super-admin/notifications'
              : role === 'ADMIN'
                ? '/admin/notifications'
                : '/notifications'
          );
          break;
      }
    }

    return {
      title: override?.title || t || 'Portal Notification',
      message: override?.message || m || 'A new update occurred in your portal.',
      actionUrl: override?.actionUrl || u || (role === 'SUPER_ADMIN' ? '/super-admin/notifications' : role === 'ADMIN' ? '/admin/notifications' : '/notifications'),
      category: override?.category || category,
      priority: override?.priority || priority,
    };
  };

  const insertPromises: Promise<any>[] = [];

  // 4A. Personal/Target-Scoped Events (never broadcast across unrelated users or portals)
  if (isTargetSelfEvent) {
    const scopedUserId = targetUserId || explicitSuperAdminId || explicitAdminId || explicitInstructorId || traineeId;
    if (scopedUserId) {
      let resolvedTargetRole: PortalUserRole | null = targetRole || null;
      if (!resolvedTargetRole) {
        if (explicitSuperAdminId) resolvedTargetRole = 'SUPER_ADMIN';
        else if (explicitAdminId) resolvedTargetRole = 'ADMIN';
        else if (explicitInstructorId) resolvedTargetRole = 'INSTRUCTOR';
        else if (traineeId) resolvedTargetRole = 'TRAINEE';
        else {
          try {
            const { data: tp } = await supabaseAdmin
              .from('profiles')
              .select('role')
              .eq('id', scopedUserId)
              .maybeSingle();
            resolvedTargetRole = tp?.role ? normalizePortalRole(tp.role) : null;
          } catch {}
        }
      }

      if (resolvedTargetRole) {
        const payload = getRoleNotification(resolvedTargetRole);
        insertPromises.push(
          createNotificationRecord({
            recipient_id: scopedUserId,
            title: payload.title,
            message: payload.message,
            type: event,
            category: payload.category,
            priority: payload.priority,
            entity_type: entityType || 'USER',
            entity_id: entityId || scopedUserId,
            action_url: payload.actionUrl,
          })
        );
      }
    }

    // Optional explicit escalation for severe account lockouts/incidents to SUPER_ADMIN only
    if (event === 'ACCOUNT_SECURITY_EVENT' && meta.escalateToSuperAdmin === true && resolvedSuperAdminIds.length > 0) {
      const saPayload = getRoleNotification('SUPER_ADMIN');
      for (const saId of resolvedSuperAdminIds) {
        if (saId === (targetUserId || explicitSuperAdminId)) continue;
        insertPromises.push(
          createNotificationRecord({
            recipient_id: saId,
            title: saPayload.title,
            message: saPayload.message,
            type: 'SECURITY_ALERT',
            category: 'SECURITY',
            priority: 'HIGH',
            entity_type: entityType || 'SECURITY_EVENT',
            entity_id: entityId || targetUserId,
            action_url: '/super-admin/security',
          })
        );
      }
    }
  } else {
    // 4B. Portal-Separated Matrix Dispatch
    // Trainee recipient
    if (matrixTrainee && traineeId) {
      const payload = getRoleNotification('TRAINEE');
      insertPromises.push(
        createNotificationRecord({
          recipient_id: traineeId,
          title: payload.title,
          message: payload.message,
          type: event,
          category: payload.category,
          priority: payload.priority,
          entity_type: entityType,
          entity_id: entityId,
          action_url: payload.actionUrl,
        })
      );
    }

    // Instructor recipients
    if (matrixInstructor && resolvedInstructorIds.length > 0) {
      const payload = getRoleNotification('INSTRUCTOR');
      for (const instId of resolvedInstructorIds) {
        insertPromises.push(
          createNotificationRecord({
            recipient_id: instId,
            title: payload.title,
            message: payload.message,
            type: event,
            category: payload.category,
            priority: payload.priority,
            entity_type: entityType,
            entity_id: entityId,
            action_url: payload.actionUrl,
          })
        );
      }
    }

    // Admin recipients (filtered by portal & financial/module RBAC isolation)
    if (matrixAdmin && resolvedAdmins.length > 0) {
      const payload = getRoleNotification('ADMIN');
      for (const adminMeta of resolvedAdmins) {
        const isEligible = isNotificationAllowedForPortal(
          { type: event, category: payload.category, title: payload.title, action_url: payload.actionUrl },
          'ADMIN',
          {
            canViewPayments: adminMeta.canViewPayments,
            permissions: adminMeta.permissions,
            position: adminMeta.position,
          }
        );
        if (!isEligible) continue;
        insertPromises.push(
          createNotificationRecord({
            recipient_id: adminMeta.id,
            title: payload.title,
            message: payload.message,
            type: event,
            category: payload.category,
            priority: payload.priority,
            entity_type: entityType,
            entity_id: entityId,
            action_url: payload.actionUrl,
          })
        );
      }
    }

    // Super Admin recipients (governance & critical security only)
    if (matrixSuperAdmin && resolvedSuperAdminIds.length > 0) {
      const payload = getRoleNotification('SUPER_ADMIN');
      for (const saId of resolvedSuperAdminIds) {
        insertPromises.push(
          createNotificationRecord({
            recipient_id: saId,
            title: payload.title,
            message: payload.message,
            type: event,
            category: payload.category,
            priority: payload.priority,
            entity_type: entityType,
            entity_id: entityId,
            action_url: payload.actionUrl,
          })
        );
      }
    }
  }

  const results = await Promise.allSettled(insertPromises);
  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value !== null).length;

  return { count: successCount };
}

/**
 * Fetch notifications for a user with strict portal separation and role-specific formatting
 */
export async function getUserNotifications(
  recipientId: string,
  userRole: PortalUserRole = 'TRAINEE',
  options?: { isRead?: boolean; limit?: number } & PortalNotificationFilterOptions
): Promise<FormattedNotification[]> {
  const role = normalizePortalRole(userRole);
  const requestedLimit = Math.min(Math.max(options?.limit || 50, 1), 200);
  const fetchLimit = Math.min(requestedLimit * 2, 250);

  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false });

  if (options?.isRead !== undefined) {
    query = query.eq('is_read', options.isRead);
  }

  query = query.limit(fetchLimit);

  const { data, error } = await query;
  if (error) throw error;

  const allowedRows = (data || []).filter((row: any) =>
    isNotificationAllowedForPortal(row, role, {
      canViewPayments: options?.canViewPayments,
      permissions: options?.permissions,
      position: options?.position,
      recipientId,
    })
  );

  return allowedRows
    .slice(0, requestedLimit)
    .map((row: any) => formatNotificationItem(row, role));
}

export async function getUnreadNotificationCount(
  recipientId: string,
  userRole?: PortalUserRole,
  options?: PortalNotificationFilterOptions
): Promise<number> {
  if (!userRole) {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (error) {
      console.warn('getUnreadNotificationCount notice:', error);
      return 0;
    }

    return count || 0;
  }

  const role = normalizePortalRole(userRole);
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('id, recipient_id, type, category, title, message, action_url')
    .eq('recipient_id', recipientId)
    .eq('is_read', false)
    .limit(200);

  if (error) {
    console.warn('getUnreadNotificationCount scoped notice:', error);
    return 0;
  }

  return (data || []).filter((row: any) =>
    isNotificationAllowedForPortal(row, role, {
      canViewPayments: options?.canViewPayments,
      permissions: options?.permissions,
      position: options?.position,
      recipientId,
    })
  ).length;
}

export async function getNotificationById(id: string) {
  const { data, error } = await supabaseAdmin.from('notifications').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listNotifications(recipient_id: string, filters?: { is_read?: boolean }) {
  let query = supabaseAdmin.from('notifications').select('*').eq('recipient_id', recipient_id);
  if (filters?.is_read !== undefined) query = query.eq('is_read', filters.is_read);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createNotification(input: any) {
  return createNotificationRecord(input);
}

export async function markAsRead(id: string, recipientId?: string) {
  let query = supabaseAdmin.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
  if (recipientId) {
    query = query.eq('recipient_id', recipientId);
  }
  const { data, error } = await query.select().single();
  if (error && error.code === '42703') {
    // If read_at column not yet added in SQL, fallback without read_at
    const { data: fbData, error: fbErr } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();
    if (fbErr) throw fbErr;
    return fbData;
  }
  if (error) throw error;
  return data;
}

export async function markAllAsRead(recipient_id: string) {
  let query = supabaseAdmin
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('recipient_id', recipient_id);

  const { error } = await query;
  if (error && error.code === '42703') {
    const { error: fbErr } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', recipient_id);
    if (fbErr) throw fbErr;
    return;
  }
  if (error) throw error;
}

export async function deleteNotification(id: string, recipientId?: string) {
  let query = supabaseAdmin.from('notifications').delete().eq('id', id);
  if (recipientId) {
    query = query.eq('recipient_id', recipientId);
  }
  const { error } = await query;
  if (error) throw error;
}
