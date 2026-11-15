import bcrypt from 'bcrypt';
import crypto from 'crypto';

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR' | 'TRAINEE';
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE' | 'LOCKED';
  phone?: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  recoveryCodes?: string; // JSON array of sha256 hashes
  failedLoginAttempts: number;
  lockoutUntil?: string;
  lastLoginAt?: string;
  mustChangePassword: boolean;
  invitationToken?: string;
  createdAt: string;
  updatedAt: string;

  // Profile data
  firstName: string;
  lastName: string;
  department?: string;
  specialization?: string;
  employeeId?: string;
  assignedCenterId?: string;
  permissions?: string[]; // Granular permissions
}

export interface SessionRecord {
  id: string;
  userId: string;
  userEmail: string;
  userRole: string;
  userName: string;
  token: string;
  ipAddress: string;
  userAgent: string;
  device: string;
  lastActiveAt: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
}

export interface TrainingCenterRecord {
  id: string;
  name: string;
  code: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  capacity: number;
  status: 'ACTIVE' | 'INACTIVE';
  programsOffered: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  actorId?: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  status: 'SUCCESS' | 'FAILED';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface SecurityEventRecord {
  id: string;
  timestamp: string;
  eventType: 'FAILED_LOGIN' | 'ACCOUNT_LOCKOUT' | 'MFA_FAILURE' | 'SESSION_REVOKED' | 'SUSPICIOUS_ACTIVITY' | 'PERMISSION_CHANGE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  targetUser?: string;
  ipAddress: string;
  userAgent: string;
  description: string;
  resolved: boolean;
  createdAt: string;
}

export interface SystemNotificationRecord {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  type: 'SECURITY' | 'ADMIN' | 'SYSTEM' | 'TRAINING';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface SystemSettingRecord {
  id: string;
  key: string;
  value: string;
  category: 'GENERAL' | 'SECURITY' | 'AUTHENTICATION' | 'NOTIFICATIONS' | 'SYSTEM';
  description: string;
  updatedBy?: string;
  updatedAt: string;
}

// Operational Entities for Admin
export interface TraineeRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  srn: string; // Seafarer Registration Number
  rank: string;
  vesselType: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'COMPLETED';
  centerId: string;
  centerName: string;
  enrollmentsCount: number;
  attendanceRate: string;
  certificatesCount: number;
  dateOfBirth?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRecord {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  durationHours: number;
  trainingDays: number;
  capacity: number;
  fee: number;
  prerequisites: string[];
  instructorId: string;
  instructorName: string;
  centerId: string;
  centerName: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentRecord {
  id: string;
  code: string;
  title: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  type: 'QUIZ' | 'WRITTEN' | 'PRACTICAL' | 'FINAL';
  totalPoints: number;
  passingScore: number;
  durationMinutes: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  submissionsCount: number;
  passedCount: number;
  failedCount: number;
  averageScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentRecord {
  id: string;
  enrollmentNo: string;
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  centerId: string;
  centerName: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'PAYMENT_PENDING' | 'ENROLLED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
  paymentStatus: 'PENDING' | 'PROCESSING' | 'VERIFIED' | 'REJECTED';
  paymentAmount: number;
  appliedAt: string;
  enrolledAt?: string;
  completedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  sessionCode: string;
  courseId: string;
  courseTitle: string;
  traineeId: string;
  traineeName: string;
  instructorId: string;
  instructorName: string;
  room: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface ScheduleRecord {
  id: string;
  sessionCode: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  instructorId: string;
  instructorName: string;
  centerId: string;
  centerName: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  enrolledCount: number;
  status: 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  paymentNo: string;
  enrollmentId: string;
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
  courseTitle: string;
  amount: number;
  method: 'QR_PH' | 'GCASH' | 'MAYA' | 'BANK_TRANSFER' | 'CASH';
  referenceNumber: string;
  status: 'PENDING' | 'PROCESSING' | 'VERIFIED' | 'REJECTED' | 'REFUNDED';
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface CertificateRecord {
  id: string;
  certificateNo: string;
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  issueDate: string;
  expiryDate: string;
  completionDate: string;
  status: 'READY' | 'ISSUED' | 'PENDING' | 'REVOKED';
  qrVerificationCode: string;
  instructorName: string;
  centerName: string;
  issuedBy?: string;
  issuedAt?: string;
  reissuedCount: number;
}

export interface AdminNotificationRecord {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  type: 'ENROLLMENT' | 'PAYMENT' | 'ATTENDANCE' | 'CERTIFICATE' | 'SCHEDULE' | 'SYSTEM';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface LearningMaterialRecord {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  moduleName: string;
  title: string;
  description: string;
  fileType: 'PDF' | 'DOCUMENT' | 'PRESENTATION' | 'VIDEO' | 'SIMULATOR_CONFIG' | 'LINK';
  fileSize: string;
  url: string;
  instructorId: string;
  instructorName: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentSubmissionRecord {
  id: string;
  assessmentId: string;
  assessmentCode: string;
  assessmentTitle: string;
  courseId: string;
  courseTitle: string;
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
  traineeSrn: string;
  score: number;
  maxScore: number;
  passingScore: number;
  percentage: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'RETURNED' | 'RETAKE';
  result: 'PASSED' | 'FAILED' | 'PENDING';
  attempt: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
  gradedBy?: string;
  previousScore?: number;
  gradeChangeReason?: string;
}

export interface TraineeProgressRecord {
  id: string;
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
  srn: string;
  rank: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  instructorId: string;
  progressPercent: number;
  modulesCompleted: number;
  totalModules: number;
  attendanceRate: string;
  averageGrade: number;
  assessmentsCompleted: number;
  totalAssessments: number;
  status: 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'COMPLETED';
  lastActiveAt: string;
}

export interface LessonRecord {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  moduleName: string;
  moduleOrder: number;
  lessonOrder: number;
  title: string;
  description: string;
  contentType: 'TEXT' | 'VIDEO' | 'PRESENTATION' | 'SIMULATOR_GUIDE';
  contentBody: string;
  videoUrl?: string;
  readingMinutes: number;
  isCompleted: boolean;
  completedAt?: string;
  traineeId?: string;
}

export interface AttendanceCorrectionRecord {
  id: string;
  traineeId: string;
  traineeName: string;
  attendanceId: string;
  date: string;
  sessionCode: string;
  courseTitle: string;
  currentStatus: string;
  requestedStatus: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

// In-Memory Database Singleton Store
class InMemoryDatabase {
  private users: Map<string, UserRecord> = new Map();
  private sessions: Map<string, SessionRecord> = new Map();
  private trainingCenters: Map<string, TrainingCenterRecord> = new Map();
  private auditLogs: AuditLogRecord[] = [];
  private securityEvents: SecurityEventRecord[] = [];
  private notifications: SystemNotificationRecord[] = [];
  private settings: Map<string, SystemSettingRecord> = new Map();
  private rolePermissions: Map<string, Set<string>> = new Map();


  private initialized = false;

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    if (this.initialized) return;
    this.initialized = true;

    // Demo/mock seed data has been removed. All application data is sourced
    // exclusively from Supabase; this in-memory store only holds runtime state
    // (e.g. active sessions) created during the server process lifetime.
  }

  // --- User Operations ---
  public getUsers(): UserRecord[] {
    return Array.from(this.users.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getUserById(id: string): UserRecord | undefined {
    return this.users.get(id);
  }

  public getUserByEmailOrUsername(identifier: string): UserRecord | undefined {
    const clean = identifier.trim().toLowerCase();
    return Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === clean || u.username?.toLowerCase() === clean
    );
  }

  public createUser(user: UserRecord): UserRecord {
    this.users.set(user.id, user);
    return user;
  }

  public updateUser(id: string, updates: Partial<UserRecord>): UserRecord | undefined {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.users.set(id, updated);
    return updated;
  }

  // --- Session Operations ---
  public getSessions(userId?: string): SessionRecord[] {
    const all = Array.from(this.sessions.values()).filter((s) => !s.revoked && new Date(s.expiresAt) > new Date());
    if (userId) return all.filter((s) => s.userId === userId);
    return all.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  public getSessionByToken(token: string): SessionRecord | undefined {
    const session = Array.from(this.sessions.values()).find((s) => s.token === token && !s.revoked);
    if (!session) return undefined;
    if (new Date(session.expiresAt) <= new Date()) return undefined;
    return session;
  }

  public createSession(session: SessionRecord): SessionRecord {
    this.sessions.set(session.id, session);
    return session;
  }

  public revokeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.revoked = true;
    this.sessions.set(sessionId, session);
    return true;
  }

  public revokeOtherSessionsForUser(userId: string, currentSessionId: string): number {
    let count = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId && id !== currentSessionId && !session.revoked) {
        session.revoked = true;
        this.sessions.set(id, session);
        count++;
      }
    }
    return count;
  }

  // --- Training Centers ---
  public getTrainingCenters(): TrainingCenterRecord[] {
    return Array.from(this.trainingCenters.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  public getTrainingCenterById(id: string): TrainingCenterRecord | undefined {
    return this.trainingCenters.get(id);
  }

  public createTrainingCenter(center: TrainingCenterRecord): TrainingCenterRecord {
    this.trainingCenters.set(center.id, center);
    return center;
  }

  public updateTrainingCenter(id: string, updates: Partial<TrainingCenterRecord>): TrainingCenterRecord | undefined {
    const existing = this.trainingCenters.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.trainingCenters.set(id, updated);
    return updated;
  }

  // --- Audit Logs ---
  public getAuditLogs(): AuditLogRecord[] {
    return [...this.auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public addAuditLog(log: Omit<AuditLogRecord, 'id' | 'timestamp'>): AuditLogRecord {
    const newLog: AuditLogRecord = {
      ...log,
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(newLog);
    if (this.auditLogs.length > 2000) {
      this.auditLogs.pop();
    }
    return newLog;
  }

  // --- Security Events ---
  public getSecurityEvents(): SecurityEventRecord[] {
    return [...this.securityEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public addSecurityEvent(event: Omit<SecurityEventRecord, 'id' | 'timestamp' | 'createdAt'>): SecurityEventRecord {
    const newEvent: SecurityEventRecord = {
      ...event,
      id: `sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.securityEvents.unshift(newEvent);
    return newEvent;
  }

  public resolveSecurityEvent(id: string): boolean {
    const event = this.securityEvents.find((e) => e.id === id);
    if (!event) return false;
    event.resolved = true;
    return true;
  }

  // --- System Notifications ---
  public getNotifications(): SystemNotificationRecord[] {
    return [...this.notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public markNotificationAsRead(id: string): boolean {
    const n = this.notifications.find((item) => item.id === id);
    if (!n) return false;
    n.isRead = true;
    return true;
  }

  public markAllNotificationsAsRead(): void {
    this.notifications.forEach((n) => (n.isRead = true));
  }

  public deleteNotification(id: string): boolean {
    const index = this.notifications.findIndex((item) => item.id === id);
    if (index === -1) return false;
    this.notifications.splice(index, 1);
    return true;
  }

  public addNotification(note: Omit<SystemNotificationRecord, 'id' | 'createdAt'>): SystemNotificationRecord {
    const newNote: SystemNotificationRecord = {
      ...note,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(newNote);
    return newNote;
  }

  // --- Settings ---
  public getSettings(): SystemSettingRecord[] {
    return Array.from(this.settings.values());
  }

  public getSetting(key: string): SystemSettingRecord | undefined {
    return this.settings.get(key);
  }

  public updateSetting(key: string, value: string, updatedBy?: string): SystemSettingRecord | undefined {
    const existing = this.settings.get(key);
    if (!existing) return undefined;
    existing.value = value;
    existing.updatedBy = updatedBy;
    existing.updatedAt = new Date().toISOString();
    this.settings.set(key, existing);
    return existing;
  }

  // --- Role Permissions ---
  public getRolePermissions(): Record<string, string[]> {
    const res: Record<string, string[]> = {};
    for (const [role, perms] of this.rolePermissions.entries()) {
      res[role] = Array.from(perms);
    }
    return res;
  }

  public updateRolePermissions(role: string, permissions: string[]): boolean {
    if (role === 'SUPER_ADMIN') {
      permissions = Array.from(
        new Set([
          ...permissions,
          'ROLE_PERMISSION_VIEW',
          'ROLE_PERMISSION_UPDATE',
          'SECURITY_VIEW',
          'SYSTEM_SETTINGS_UPDATE',
          'AUDIT_LOG_VIEW'
        ])
      );
    }
    this.rolePermissions.set(role, new Set(permissions));
    return true;
  }

}

// Global Singleton Instance (Lazy-initialized via Proxy so importing @newsim/database never seeds until accessed)
const globalForDb = globalThis as unknown as { newsimDatabase?: InMemoryDatabase };

function getOrCreateDb(): InMemoryDatabase {
  if (!globalForDb.newsimDatabase) {
    globalForDb.newsimDatabase = new InMemoryDatabase();
  }
  return globalForDb.newsimDatabase;
}

export const db: InMemoryDatabase = new Proxy({} as InMemoryDatabase, {
  get(_target, prop, receiver) {
    const instance = getOrCreateDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  set(_target, prop, value, receiver) {
    const instance = getOrCreateDb();
    return Reflect.set(instance, prop, value, receiver);
  },
});
