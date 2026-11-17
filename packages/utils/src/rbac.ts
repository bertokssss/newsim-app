export type RbacRole = 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR' | 'TRAINEE';

export interface RbacPermissionDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Role-specific label/description overrides when a permission ID appears in multiple portals */
  roleDescriptions?: Partial<Record<RbacRole, { name?: string; category?: string; description?: string }>>;
  allowedRoles: RbacRole[];
  mandatoryForRoles?: RbacRole[];
  isFinancial?: boolean;
}

export interface AdminRolePreset {
  id: string;
  label: string;
  position: string;
  description: string;
  permissions: string[];
}

export const FINANCIAL_PERMISSION_IDS = new Set([
  'PAYMENT_VIEW',
  'PAYMENT_VERIFY',
  'FINANCIAL_REPORTS',
  'FINANCIAL_ACCESS',
]);

export function isFinancialPermissionId(permission?: string | null): boolean {
  const norm = (permission || '').toUpperCase().trim();
  if (!norm) return false;
  return (
    FINANCIAL_PERMISSION_IDS.has(norm) ||
    norm.startsWith('PAYMENT_') ||
    norm.startsWith('FINANCIAL_')
  );
}

/**
 * Single authoritative RBAC permission catalog for NEWSIM.
 * Every permission maps strictly to real, functional portal modules.
 */
export const RBAC_PERMISSIONS: RbacPermissionDefinition[] = [
  // ── SUPER ADMIN PORTAL ──────────────────────────────────────────────
  {
    id: 'ADMIN_VIEW',
    name: 'View Admin Accounts',
    category: 'ADMIN ACCOUNTS',
    description: 'View branch administrator directory, statuses, and assigned module privileges.',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'ADMIN_CREATE',
    name: 'Create Admin Accounts',
    category: 'ADMIN ACCOUNTS',
    description: 'Provision new administrator accounts with least-privilege operational permissions.',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'ADMIN_UPDATE',
    name: 'Manage & Update Admins',
    category: 'ADMIN ACCOUNTS',
    description: 'Activate, suspend, reset MFA, or adjust per-admin operational permissions.',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'ADMIN_DELETE',
    name: 'Delete Admin Accounts',
    category: 'ADMIN ACCOUNTS',
    description: 'Permanently decommission administrator accounts with step-up verification.',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'INSTRUCTOR_CREATE',
    name: 'Create Instructor Accounts',
    category: 'INSTRUCTOR ACCOUNTS',
    description: 'Invite and onboard new maritime training instructors.',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'INSTRUCTOR_UPDATE',
    name: 'Update Instructor Accounts',
    category: 'INSTRUCTOR ACCOUNTS',
    description: 'Activate, suspend, reset MFA, or update instructor account records.',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'INSTRUCTOR_DELETE',
    name: 'Delete Instructor Accounts',
    category: 'INSTRUCTOR ACCOUNTS',
    description: 'Permanently delete instructor accounts from platform authentication.',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'TRAINEE_CREATE',
    name: 'Create Trainee Accounts',
    category: 'TRAINEE ACCOUNTS',
    description: 'Manually register trainee accounts directly from Super Admin Governance.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'TRAINEE_UPDATE',
    name: 'Update Trainee Accounts',
    category: 'TRAINEE ACCOUNTS',
    description: 'Activate, suspend, unlock, or resend onboarding invitations for trainees.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'TRAINEE_DELETE',
    name: 'Delete Trainee Accounts',
    category: 'TRAINEE ACCOUNTS',
    description: 'Permanently remove trainee authentication and profile records.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'REPORT_EXPORT',
    name: 'Export System Reports',
    category: 'ANALYTICS & REPORTS',
    description: 'Export CSV/audit datasets for governance, account lifecycle, and security logs.',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'SECURITY_VIEW',
    name: 'Monitor Active Sessions & Security',
    category: 'SECURITY & SESSIONS',
    description: 'View active sessions, security posture alerts, and MFA compliance status.',
    allowedRoles: ['SUPER_ADMIN'],
    mandatoryForRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'SESSION_REVOKE',
    name: 'Revoke Active Sessions',
    category: 'SECURITY & SESSIONS',
    description: 'Force-terminate active user sessions across management, instructor, and trainee portals.',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'AUDIT_LOG_VIEW',
    name: 'View Master Audit Logs',
    category: 'AUDIT & GOVERNANCE',
    description: 'Inspect immutable platform-wide audit trails across all portals.',
    allowedRoles: ['SUPER_ADMIN'],
    mandatoryForRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'ROLE_PERMISSION_VIEW',
    name: 'View Roles & Permissions',
    category: 'ROLES & PERMISSIONS',
    description: 'Inspect RBAC role policies across Super Admin, Admin, Instructor, and Trainee.',
    allowedRoles: ['SUPER_ADMIN'],
    mandatoryForRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'ROLE_PERMISSION_UPDATE',
    name: 'Update Roles & Permissions',
    category: 'ROLES & PERMISSIONS',
    description: 'Modify portal module permissions with step-up authentication.',
    allowedRoles: ['SUPER_ADMIN'],
    mandatoryForRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'SYSTEM_SETTINGS_VIEW',
    name: 'View System Settings',
    category: 'SYSTEM SETTINGS',
    description: 'View global authentication, lockout, session timeout, and institution branding policies.',
    allowedRoles: ['SUPER_ADMIN'],
    mandatoryForRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'SYSTEM_SETTINGS_UPDATE',
    name: 'Update System Settings',
    category: 'SYSTEM SETTINGS',
    description: 'Modify global security thresholds, session timeouts, and system settings.',
    allowedRoles: ['SUPER_ADMIN'],
  },

  // ── SHARED / ROLE-SCOPED MODULES ─────────────────────────────────────
  {
    id: 'INSTRUCTOR_VIEW',
    name: 'View Instructors',
    category: 'INSTRUCTOR ACCOUNTS',
    description: 'View instructor accounts, qualifications, and assigned schedules.',
    roleDescriptions: {
      SUPER_ADMIN: {
        name: 'View Instructor Accounts',
        category: 'INSTRUCTOR ACCOUNTS',
        description: 'View all instructor accounts, statuses, and onboarding invitations.',
      },
      ADMIN: {
        name: 'View Instructors Roster',
        category: 'INSTRUCTORS ROSTER',
        description: 'Access branch instructor roster, specializations, and schedule workload.',
      },
    },
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'TRAINEE_VIEW',
    name: 'View Trainees',
    category: 'TRAINEE ACCOUNTS',
    description: 'View trainee directory and progress.',
    roleDescriptions: {
      SUPER_ADMIN: {
        name: 'View Trainee Accounts',
        category: 'TRAINEE ACCOUNTS',
        description: 'Inspect global trainee accounts, account statuses, and training history.',
      },
      ADMIN: {
        name: 'View Trainees Directory',
        category: 'TRAINEE ACCOUNTS',
        description: 'Inspect enrolled trainee accounts, contact information, and training records.',
      },
      INSTRUCTOR: {
        name: 'View Assigned Trainees & Progress',
        category: 'TRAINEES & PROGRESS',
        description: 'Access assigned course trainee rosters and training progression tracking.',
      },
    },
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
  },
  {
    id: 'REPORT_VIEW',
    name: 'View Analytics & Reports',
    category: 'ANALYTICS & REPORTS',
    description: 'View platform analytics and operational reports.',
    roleDescriptions: {
      SUPER_ADMIN: {
        name: 'View Analytics & Governance Reports',
        category: 'ANALYTICS & REPORTS',
        description: 'Access executive analytics trends and non-financial system governance reports.',
      },
      ADMIN: {
        name: 'View Operational Reports',
        category: 'REPORTS',
        description: 'Generate and download operational training reports (billing reports remain billing-restricted).',
      },
    },
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },

  // ── ADMIN PORTAL MODULES ─────────────────────────────────────────────
  {
    id: 'COURSE_VIEW',
    name: 'View Courses',
    category: 'COURSES & CURRICULUM',
    description: 'View training courses, packages, batches, and learning materials.',
    roleDescriptions: {
      SUPER_ADMIN: {
        name: 'Manage Maritime Curriculum & Courses',
        category: 'COURSES & BATCHES',
        description: 'Manage master maritime training courses, curriculum packages, and class batches.',
      },
      ADMIN: {
        name: 'View Courses, Packages & Batches',
        category: 'COURSES & BATCHES',
        description: 'Access the center course catalog, packages, batches, and curriculum setup.',
      },
      INSTRUCTOR: {
        name: 'View Assigned Courses',
        category: 'MY COURSES & MATERIALS',
        description: 'Access assigned maritime courses, modules, and course materials.',
      },
      TRAINEE: {
        name: 'Access Enrolled Courses & Learning',
        category: 'MY COURSES & LEARNING',
        description: 'View enrolled courses and open unlocked daily learning modules.',
      },
    },
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'TRAINEE'],
  },
  {
    id: 'COURSE_MANAGE',
    name: 'Manage Courses & Batches',
    category: 'COURSES & BATCHES',
    description: 'Create and edit courses, curriculum modules, learning materials, packages, and batches.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'ENROLLMENT_VIEW',
    name: 'View Enrollments',
    category: 'ENROLLMENTS',
    description: 'View trainee enrollments and cohort admissions.',
    roleDescriptions: {
      ADMIN: {
        name: 'View Trainee Enrollments',
        category: 'ENROLLMENTS & TRAINEES',
        description: 'View trainee enrollment applications, cohort placements, and status history.',
      },
      TRAINEE: {
        name: 'Catalog & Course Enrollment',
        category: 'ENROLLMENT',
        description: 'Browse open training batches and submit course enrollment applications.',
      },
    },
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'TRAINEE'],
  },
  {
    id: 'ENROLLMENT_MANAGE',
    name: 'Manage Enrollments',
    category: 'ENROLLMENTS & TRAINEES',
    description: 'Approve, update, assign batches, and review trainee enrollment applications.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'ASSESSMENT_VIEW',
    name: 'View Assessments',
    category: 'ASSESSMENTS & GRADING',
    description: 'View assessments and rubrics.',
    roleDescriptions: {
      ADMIN: {
        name: 'View Grading Policies & Assessments',
        category: 'GRADING & ASSESSMENTS',
        description: 'View STCW assessment question banks, practical rubrics, and grading policies.',
      },
      INSTRUCTOR: {
        name: 'View Assessments & Rubrics',
        category: 'ASSESSMENTS & RUBRICS',
        description: 'View assigned course assessments, submissions, and practical evaluation rubrics.',
      },
      TRAINEE: {
        name: 'Take Assessments & Quizzes',
        category: 'ASSESSMENTS',
        description: 'Access and submit assigned course quizzes and examinations.',
      },
    },
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'TRAINEE'],
  },
  {
    id: 'ASSESSMENT_MANAGE',
    name: 'Manage Grading Policies & Assessments',
    category: 'GRADING & ASSESSMENTS',
    description: 'Configure course assessments, question banks, rubrics, and passing thresholds.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'ATTENDANCE_VIEW',
    name: 'View Attendance',
    category: 'ATTENDANCE',
    description: 'View attendance logs.',
    roleDescriptions: {
      ADMIN: {
        name: 'View Attendance Logs',
        category: 'ATTENDANCE',
        description: 'Inspect daily training attendance logs across scheduled sessions.',
      },
      INSTRUCTOR: {
        name: 'View Class Attendance',
        category: 'ATTENDANCE',
        description: 'View roll-call attendance sheets for assigned training sessions.',
      },
      TRAINEE: {
        name: 'View Own Attendance & Progress',
        category: 'ATTENDANCE & PROGRESS',
        description: 'Track personal attendance records and overall training completion progress.',
      },
    },
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'TRAINEE'],
  },
  {
    id: 'ATTENDANCE_MANAGE',
    name: 'Record & Update Attendance',
    category: 'ATTENDANCE',
    description: 'Record or override center attendance logs across training schedules.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'SCHEDULE_VIEW',
    name: 'View Schedules',
    category: 'SCHEDULES',
    description: 'View training timetables.',
    roleDescriptions: {
      ADMIN: {
        name: 'View Class & Simulator Schedules',
        category: 'SCHEDULES',
        description: 'View center classroom and simulator training timetables.',
      },
      INSTRUCTOR: {
        name: 'View Teaching Schedules',
        category: 'SCHEDULES',
        description: 'View assigned instructor classroom and simulator session schedules.',
      },
      TRAINEE: {
        name: 'View Personal Training Schedule',
        category: 'SCHEDULES',
        description: 'View upcoming classroom and simulator sessions for enrolled batches.',
      },
    },
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'TRAINEE'],
  },
  {
    id: 'SCHEDULE_MANAGE',
    name: 'Manage Schedules & Substitutes',
    category: 'SCHEDULES',
    description: 'Create, reschedule, cancel sessions, and assign substitute instructors.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'LEAVE_VIEW',
    name: 'View Instructor Leaves',
    category: 'INSTRUCTOR LEAVES',
    description: 'View submitted instructor leave applications and calendar impact.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'LEAVE_MANAGE',
    name: 'Approve or Reject Leaves',
    category: 'INSTRUCTOR LEAVES',
    description: 'Review and approve or decline instructor leave requests.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'PAYMENT_VIEW',
    name: 'View Payments',
    category: 'PAYMENTS & BILLING',
    description: 'View payment records.',
    roleDescriptions: {
      ADMIN: {
        name: 'View Payments & Invoices (Billing Staff Only)',
        category: 'PAYMENTS & BILLING',
        description: 'View tuition payment queues, PayMongo references, and billing summaries (excluded for IT Support).',
      },
      TRAINEE: {
        name: 'View Tuition & Online Payments',
        category: 'PAYMENTS',
        description: 'View own enrollment invoices and settle tuition fees via PayMongo.',
      },
    },
    allowedRoles: ['ADMIN', 'TRAINEE'],
    isFinancial: true,
  },
  {
    id: 'PAYMENT_VERIFY',
    name: 'Verify & Reconcile Payments',
    category: 'PAYMENTS & BILLING',
    description: 'Approve, verify, or reject trainee tuition payment submissions (Billing Staff Only).',
    allowedRoles: ['ADMIN'],
    isFinancial: true,
  },
  {
    id: 'CERTIFICATE_VIEW',
    name: 'View Certificates',
    category: 'CERTIFICATES',
    description: 'View issued certificates.',
    roleDescriptions: {
      ADMIN: {
        name: 'View Certificates Registry',
        category: 'CERTIFICATES',
        description: 'Inspect issued STCW certificates, QR verification records, and graduate eligibility.',
      },
      TRAINEE: {
        name: 'View & Claim Certificates',
        category: 'CERTIFICATES',
        description: 'View, claim, and download earned STCW training certificates.',
      },
    },
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'TRAINEE'],
  },
  {
    id: 'CERTIFICATE_MANAGE',
    name: 'Issue & Revoke Certificates',
    category: 'CERTIFICATES',
    description: 'Generate, approve, or revoke trainee maritime certificates.',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },

  // ── INSTRUCTOR-SPECIFIC ACTIONS ──────────────────────────────────────
  {
    id: 'MATERIAL_MANAGE',
    name: 'Manage Course Materials',
    category: 'MY COURSES & MATERIALS',
    description: 'Upload and remove supplementary learning materials for assigned courses.',
    allowedRoles: ['INSTRUCTOR'],
  },
  {
    id: 'ASSESSMENT_GRADE',
    name: 'Grade Practical Assessments',
    category: 'ASSESSMENTS & RUBRICS',
    description: 'Submit rubric scores and evaluate trainee practical assessments.',
    allowedRoles: ['INSTRUCTOR'],
  },
  {
    id: 'GRADE_VIEW',
    name: 'View Grades',
    category: 'GRADES',
    description: 'View grade records.',
    roleDescriptions: {
      INSTRUCTOR: {
        name: 'View Trainee Gradebook',
        category: 'GRADES',
        description: 'Inspect theory, practical, and overall weighted scores for assigned trainees.',
      },
      TRAINEE: {
        name: 'View Own Grades',
        category: 'GRADES',
        description: 'Inspect personal assessment results and final course grades.',
      },
    },
    allowedRoles: ['INSTRUCTOR', 'TRAINEE'],
  },
  {
    id: 'GRADE_FINALIZE',
    name: 'Submit & Finalize Grades',
    category: 'GRADES',
    description: 'Record final course grades and pass/fail competency remarks.',
    allowedRoles: ['INSTRUCTOR'],
  },
  {
    id: 'ATTENDANCE_RECORD',
    name: 'Record & Finalize Attendance',
    category: 'ATTENDANCE',
    description: 'Mark trainee attendance statuses and finalize session roll calls.',
    allowedRoles: ['INSTRUCTOR'],
  },
  {
    id: 'LEAVE_REQUEST',
    name: 'Submit & View Leave Requests',
    category: 'LEAVE REQUESTS',
    description: 'Submit time-off applications and inspect approval status.',
    allowedRoles: ['INSTRUCTOR'],
  },
];

export const ADMIN_ROLE_PRESETS: AdminRolePreset[] = [
  {
    id: 'OPERATIONS_ADMIN',
    label: 'Operations Admin (Non-Billing)',
    position: 'Operations Administrator',
    description: 'Manages courses, enrollments, schedules, attendance, grading policies, leaves, certificates, and reports without financial access.',
    permissions: [
      'INSTRUCTOR_VIEW',
      'COURSE_VIEW',
      'COURSE_MANAGE',
      'ENROLLMENT_VIEW',
      'ENROLLMENT_MANAGE',
      'ASSESSMENT_VIEW',
      'ASSESSMENT_MANAGE',
      'ATTENDANCE_VIEW',
      'ATTENDANCE_MANAGE',
      'SCHEDULE_VIEW',
      'SCHEDULE_MANAGE',
      'LEAVE_VIEW',
      'LEAVE_MANAGE',
      'CERTIFICATE_VIEW',
      'CERTIFICATE_MANAGE',
      'REPORT_VIEW',
    ],
  },
  {
    id: 'FINANCE_OFFICER',
    label: 'Finance & Billing Officer',
    position: 'FINANCE_OFFICER',
    description: 'Authorized billing personnel with payment verification, tuition reconciliation, enrollment review, and report access.',
    permissions: [
      'INSTRUCTOR_VIEW',
      'COURSE_VIEW',
      'ENROLLMENT_VIEW',
      'ENROLLMENT_MANAGE',
      'PAYMENT_VIEW',
      'PAYMENT_VERIFY',
      'CERTIFICATE_VIEW',
      'REPORT_VIEW',
    ],
  },
  {
    id: 'IT_SUPPORT',
    label: 'IT Support (Read-Only Non-Financial)',
    position: 'IT_SUPPORT',
    description: 'Technical support admin with read-only course, instructor, enrollment, schedule, and certificate inspection (no payments or mutations).',
    permissions: [
      'INSTRUCTOR_VIEW',
      'COURSE_VIEW',
      'ENROLLMENT_VIEW',
      'ASSESSMENT_VIEW',
      'ATTENDANCE_VIEW',
      'SCHEDULE_VIEW',
      'LEAVE_VIEW',
      'CERTIFICATE_VIEW',
    ],
  },
];

export function normalizeRbacRole(role?: string | null): RbacRole {
  const norm = (role || '').toString().trim().toUpperCase().replace(/[-\s]+/g, '_');
  if (norm === 'SUPER_ADMIN' || norm === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (norm === 'ADMIN' || norm === 'ADMINISTRATOR') return 'ADMIN';
  if (norm === 'INSTRUCTOR' || norm === 'TEACHER' || norm === 'TRAINER') return 'INSTRUCTOR';
  return 'TRAINEE';
}

export function getPermissionsCatalogForRole(role: string): Array<RbacPermissionDefinition & { mandatory: boolean }> {
  const normRole = normalizeRbacRole(role);
  return RBAC_PERMISSIONS.filter((p) => p.allowedRoles.includes(normRole)).map((def) => {
    const override = def.roleDescriptions?.[normRole];
    return {
      ...def,
      name: override?.name || def.name,
      category: override?.category || def.category,
      description: override?.description || def.description,
      mandatory: !!def.mandatoryForRoles?.includes(normRole),
    };
  });
}

export function getMandatoryPermissionsForRole(role: string): string[] {
  const normRole = normalizeRbacRole(role);
  return RBAC_PERMISSIONS.filter((p) => p.mandatoryForRoles?.includes(normRole)).map((p) => p.id);
}

export function getDefaultPermissionsForRole(role: string): string[] {
  const normRole = normalizeRbacRole(role);
  // All role-scoped modules default to enabled; individual admins still require explicit billing assignment for financial access unless general default.
  return getPermissionsCatalogForRole(normRole).map((p) => p.id);
}

export function sanitizePermissionsForRole(role: string, permissions: string[]): string[] {
  const normRole = normalizeRbacRole(role);
  const allowedSet = new Set(getPermissionsCatalogForRole(normRole).map((p) => p.id));
  const mandatory = getMandatoryPermissionsForRole(normRole);

  const normalizedInput = Array.isArray(permissions)
    ? permissions.map((p) => String(p).toUpperCase().trim()).filter(Boolean)
    : [];

  // Map common legacy names into canonical IDs for the target role if allowed
  const resultSet = new Set<string>();
  for (const perm of normalizedInput) {
    if (normRole === 'SUPER_ADMIN' && isFinancialPermissionId(perm)) {
      continue;
    }
    if (allowedSet.has(perm)) {
      resultSet.add(perm);
      continue;
    }
    if (perm === 'ATTENDANCE_MONITOR' && allowedSet.has('ATTENDANCE_MANAGE')) {
      resultSet.add('ATTENDANCE_MANAGE');
    } else if ((perm === 'FINANCIAL_REPORTS' || perm === 'FINANCIAL_ACCESS') && allowedSet.has('PAYMENT_VIEW')) {
      resultSet.add('PAYMENT_VIEW');
    }
  }

  for (const reqPerm of mandatory) {
    if (normRole !== 'SUPER_ADMIN' || !isFinancialPermissionId(reqPerm)) {
      resultSet.add(reqPerm);
    }
  }

  return Array.from(resultSet);
}

/**
 * Checks if a resolved permission list grants a required module permission,
 * including safe same-module Manage -> View hierarchy and strict financial isolation.
 */
export function hasModulePermission(
  permissions: string[] | undefined | null,
  requiredPermission: string,
  role?: string | null
): boolean {
  const req = (requiredPermission || '').toUpperCase().trim();
  if (!req) return true;

  const normRole = role ? normalizeRbacRole(role) : undefined;

  // Hard security rule: Super Admin is permanently barred from financial operations
  if (normRole === 'SUPER_ADMIN' && isFinancialPermissionId(req)) {
    return false;
  }

  const list = Array.isArray(permissions)
    ? permissions.map((p) => String(p).toUpperCase().trim()).filter(Boolean)
    : [];

  if (list.length === 0) return false;

  // Legacy 'ALL' only covers permissions valid for that role (never financial for Super Admin)
  if (list.includes('ALL')) {
    if (normRole) {
      return getPermissionsCatalogForRole(normRole).some((p) => p.id === req);
    }
    return !isFinancialPermissionId(req);
  }

  if (list.includes(req)) return true;

  // Hierarchical / same-module compatibility rules
  const implies: Record<string, string[]> = {
    COURSE_VIEW: ['COURSE_MANAGE'],
    ENROLLMENT_VIEW: ['ENROLLMENT_MANAGE', ...(normRole === 'ADMIN' ? ['USER_VIEW'] : [])],
    ASSESSMENT_VIEW: ['ASSESSMENT_MANAGE', 'ASSESSMENT_GRADE'],
    GRADE_VIEW: ['GRADE_FINALIZE'],
    ATTENDANCE_VIEW: ['ATTENDANCE_MANAGE', 'ATTENDANCE_MONITOR', 'ATTENDANCE_RECORD'],
    ATTENDANCE_MANAGE: ['ATTENDANCE_MONITOR'],
    SCHEDULE_VIEW: ['SCHEDULE_MANAGE'],
    LEAVE_VIEW: ['LEAVE_MANAGE'],
    CERTIFICATE_VIEW: ['CERTIFICATE_MANAGE'],
    PAYMENT_VIEW: ['PAYMENT_VERIFY', 'FINANCIAL_REPORTS', 'FINANCIAL_ACCESS'],
    REPORT_VIEW: ['REPORT_EXPORT'],
  };

  const candidates = implies[req];
  if (candidates && candidates.some((c) => list.includes(c))) {
    return true;
  }

  return false;
}

export type PortalType = 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR' | 'TRAINEE';

const ROUTE_PERMISSION_MAP: Record<PortalType, Array<{ prefix: string; permission: string }>> = {
  SUPER_ADMIN: [
    { prefix: '/super-admin/admins', permission: 'ADMIN_VIEW' },
    { prefix: '/super-admin/instructor-accounts', permission: 'INSTRUCTOR_VIEW' },
    { prefix: '/super-admin/trainee-accounts', permission: 'TRAINEE_VIEW' },
    { prefix: '/super-admin/trainees', permission: 'TRAINEE_VIEW' },
    { prefix: '/super-admin/courses', permission: 'COURSE_VIEW' },
    { prefix: '/super-admin/instructors', permission: 'INSTRUCTOR_VIEW' },
    { prefix: '/super-admin/analytics', permission: 'REPORT_VIEW' },
    { prefix: '/super-admin/reports', permission: 'REPORT_VIEW' },
    { prefix: '/super-admin/security', permission: 'SECURITY_VIEW' },
    { prefix: '/super-admin/audit-logs', permission: 'AUDIT_LOG_VIEW' },
    { prefix: '/super-admin/roles-permissions', permission: 'ROLE_PERMISSION_VIEW' },
    { prefix: '/super-admin/settings', permission: 'SYSTEM_SETTINGS_VIEW' },
  ],
  ADMIN: [
    { prefix: '/admin/trainees', permission: 'TRAINEE_VIEW' },
    { prefix: '/admin/instructors', permission: 'INSTRUCTOR_VIEW' },
    { prefix: '/admin/courses', permission: 'COURSE_VIEW' },
    { prefix: '/admin/batches', permission: 'COURSE_VIEW' },
    { prefix: '/admin/enrollments', permission: 'ENROLLMENT_VIEW' },
    { prefix: '/admin/grading-policies', permission: 'ASSESSMENT_VIEW' },
    { prefix: '/admin/assessments', permission: 'ASSESSMENT_VIEW' },
    { prefix: '/admin/attendance', permission: 'ATTENDANCE_VIEW' },
    { prefix: '/admin/schedules', permission: 'SCHEDULE_VIEW' },
    { prefix: '/admin/leaves', permission: 'LEAVE_VIEW' },
    { prefix: '/admin/payments', permission: 'PAYMENT_VIEW' },
    { prefix: '/admin/certificates', permission: 'CERTIFICATE_VIEW' },
    { prefix: '/admin/reports', permission: 'REPORT_VIEW' },
  ],
  INSTRUCTOR: [
    { prefix: '/my-courses', permission: 'COURSE_VIEW' },
    { prefix: '/learning-materials', permission: 'COURSE_VIEW' },
    { prefix: '/trainees', permission: 'TRAINEE_VIEW' },
    { prefix: '/progress', permission: 'TRAINEE_VIEW' },
    { prefix: '/assessments', permission: 'ASSESSMENT_VIEW' },
    { prefix: '/grades', permission: 'GRADE_VIEW' },
    { prefix: '/attendance', permission: 'ATTENDANCE_VIEW' },
    { prefix: '/schedules', permission: 'SCHEDULE_VIEW' },
    { prefix: '/leave', permission: 'LEAVE_REQUEST' },
  ],
  TRAINEE: [
    { prefix: '/my-courses', permission: 'COURSE_VIEW' },
    { prefix: '/learning', permission: 'COURSE_VIEW' },
    { prefix: '/enrollment', permission: 'ENROLLMENT_VIEW' },
    { prefix: '/assessments', permission: 'ASSESSMENT_VIEW' },
    { prefix: '/grades', permission: 'GRADE_VIEW' },
    { prefix: '/attendance', permission: 'ATTENDANCE_VIEW' },
    { prefix: '/progress', permission: 'ATTENDANCE_VIEW' },
    { prefix: '/schedules', permission: 'SCHEDULE_VIEW' },
    { prefix: '/schedule', permission: 'SCHEDULE_VIEW' },
    { prefix: '/payments', permission: 'PAYMENT_VIEW' },
    { prefix: '/certificates', permission: 'CERTIFICATE_VIEW' },
  ],
};

export function getRequiredPermissionForRoute(portal: PortalType, pathname: string): string | null {
  const path = (pathname || '').split('?')[0];
  const entries = ROUTE_PERMISSION_MAP[portal] || [];
  const match = entries.find((entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`));
  return match ? match.permission : null;
}

export function canAccessPortalRoute(
  portal: PortalType,
  pathname: string,
  permissions: string[] | undefined | null,
  role?: string | null
): boolean {
  const required = getRequiredPermissionForRoute(portal, pathname);
  if (!required) return true;
  return hasModulePermission(permissions, required, role);
}

/**
 * Resolves permissions for sidebar and command-palette navigation display.
 * Explicit resolved arrays enforce exact RBAC permissions; null/undefined
 * initial client state falls back to non-financial defaults so core links do
 * not disappear before auth hydration without ever exposing financial routes.
 */
export function resolveNavigationPermissions(
  portal: PortalType,
  permissions: string[] | undefined | null,
  role?: string | null
): string[] {
  if (Array.isArray(permissions)) {
    return permissions;
  }
  return getDefaultPermissionsForRole(role || portal).filter(
    (perm) => !isFinancialPermissionId(perm)
  );
}

/**
 * Filters sidebar navigation groups using live module permissions and drops empty groups.
 */
export function filterNavGroupsByPermissions<
  TItem extends { href: string },
  TGroup extends { items: TItem[] }
>(
  portal: PortalType,
  groups: TGroup[],
  permissions: string[] | undefined | null,
  role?: string | null
): TGroup[] {
  const effectivePermissions = resolveNavigationPermissions(portal, permissions, role);
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canAccessPortalRoute(portal, item.href, effectivePermissions, role)
      ),
    }))
    .filter((group) => group.items.length > 0);
}
