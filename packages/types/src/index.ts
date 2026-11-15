export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR' | 'TRAINEE';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE' | 'LOCKED';

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  recoveryCodes?: string;
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
  permissions?: string[];
  
  // Trainee-specific fields
  srn?: string;
  rank?: string;
  vesselType?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContact?: string;
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

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  userName: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
