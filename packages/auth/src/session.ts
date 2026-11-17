import jwt from 'jsonwebtoken';
import { db, SessionRecord, UserRecord, supabaseAdmin } from '@newsim/database';
import { NextRequest, NextResponse } from 'next/server';
import { isUserTokenRevoked } from './revocation';
import { touchUserActivity } from './lockout';
import { getJwtSecret } from './jwt-secret';

export const INACTIVITY_EXPIRED_MESSAGE = "Your session has expired due to inactivity. Please log in again.";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  userName: string;
  sessionId: string;
  rememberMe?: boolean;
  lastActiveAt?: number;
  inactivityTimeoutSeconds?: number;
  iat?: number;
  exp?: number;
}

/**
 * Returns allowed inactivity timeout in milliseconds based on role.
 * Super Admin: 7 days
 * Admin: 7 days
 * Instructor: 7 days
 * Trainee: 30 days
 */
export function getInactivityTimeoutMs(role?: string | null): number {
  const norm = (role || '').toString().trim().toUpperCase().replace(/[-\s]+/g, '_');
  if (norm === 'TRAINEE' || norm === 'STUDENT') {
    return 30 * 24 * 60 * 60 * 1000; // 30 days
  }
  return 7 * 24 * 60 * 60 * 1000; // 7 days
}

export function isPassiveRequest(req: NextRequest): boolean {
  if (req.headers.get('x-passive-request') === '1' || req.headers.get('x-passive-request') === 'true') {
    return true;
  }
  const path = req.nextUrl?.pathname || '';
  if (
    path.includes('/notifications') ||
    path.includes('/sidebar-counts') ||
    path.includes('/favicon.ico') ||
    path.includes('/_next')
  ) {
    return true;
  }
  return false;
}

export function createSessionToken(
  user: UserRecord,
  ip = '127.0.0.1',
  userAgent = 'Browser',
  rememberMe = false
): { token: string; session: SessionRecord } {
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const normRole = (user.role || '').toString().toUpperCase().replace(/[-\s]+/g, '_');
  const isTrainee = normRole === 'TRAINEE' || normRole === 'STUDENT';

  const inactivityMs = isTrainee ? 30 * 24 * 3600000 : 7 * 24 * 3600000;
  const inactivityTimeoutSeconds = Math.floor(inactivityMs / 1000);

  // If rememberMe is true: persistent session lasting inactivity timeout (7d or 30d)
  // If rememberMe is false: standard 8-hour non-persistent session
  const sessionLifetimeMs = rememberMe ? inactivityMs : 8 * 3600000;
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);

  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    userName: `${user.firstName} ${user.lastName}`,
    sessionId,
    rememberMe: !!rememberMe,
    lastActiveAt: Date.now(),
    inactivityTimeoutSeconds,
  };

  const expiresIn = rememberMe ? (isTrainee ? '30d' : '7d') : '8h';
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn });

  // Infer device from user agent
  let device = 'Desktop';
  if (/mobile/i.test(userAgent)) device = 'Mobile Device';
  else if (/ipad|tablet/i.test(userAgent)) device = 'Tablet';
  else if (/macintosh|mac os/i.test(userAgent)) device = 'macOS Desktop';
  else if (/windows/i.test(userAgent)) device = 'Windows PC';
  else if (/linux/i.test(userAgent)) device = 'Linux Workstation';

  const session: SessionRecord = {
    id: sessionId,
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    userName: `${user.firstName} ${user.lastName}`,
    token,
    ipAddress: ip,
    userAgent,
    device,
    lastActiveAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    revoked: false,
    createdAt: new Date().toISOString(),
  };

  db.createSession(session);

  // Also touch last_activity_at in profiles upon session creation
  touchUserActivity(user.id, null);

  return { token, session };
}

export function verifySessionToken(token: string): (JWTPayload & { activeUser: UserRecord }) | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;

    // Reject tokens issued before a Super Admin revoked this user's sessions (persisted cross-portal)
    if (isUserTokenRevoked(decoded.userId, decoded.iat)) return null;

    const session = db.getSessionByToken(token);
    // If a session record exists in memory and is explicitly revoked, reject
    if (session && session.revoked) return null;

    // Check inactivity-based session expiration for Remember Me sessions
    if (decoded.rememberMe) {
      const allowedInactivityMs = getInactivityTimeoutMs(decoded.role);
      const lastActiveMs = session?.lastActiveAt
        ? new Date(session.lastActiveAt).getTime()
        : (decoded.lastActiveAt || (decoded.iat ? decoded.iat * 1000 : 0));

      if (lastActiveMs && (Date.now() - lastActiveMs) > allowedInactivityMs) {
        // Session expired due to inactivity!
        if (session) session.revoked = true;
        return null;
      }
    }

    let user = db.getUserById(decoded.userId);

    // If not found in local DB, reconstruct activeUser from decoded JWT payload or session
    if (!user) {
      user = {
        id: decoded.userId || session?.userId,
        email: decoded.email || session?.userEmail || '',
        username: decoded.email || session?.userEmail || '',
        passwordHash: '',
        role: ((decoded.role || session?.userRole || 'TRAINEE').toString().toUpperCase().replace(/[-\s]+/g, '_')) as "SUPER_ADMIN" | "ADMIN" | "INSTRUCTOR" | "TRAINEE",
        firstName: (decoded.userName || session?.userName || '').split(' ')[0] || '',
        lastName: (decoded.userName || session?.userName || '').split(' ').slice(1).join(' ') || '',
        mfaEnabled: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        mustChangePassword: false,
        createdAt: session?.createdAt || new Date().toISOString(),
        updatedAt: session?.createdAt || new Date().toISOString(),
      } as UserRecord;
    } else {
      user = {
        ...user,
        role: (user.role || decoded.role || session?.userRole || 'TRAINEE').toString().toUpperCase().replace(/[-\s]+/g, '_') as any,
        status: (user.status || 'ACTIVE').toString().toUpperCase() as any,
      };
    }

    if (!user || user.status.toUpperCase() !== 'ACTIVE') return null;

    // Update last active in memory if session exists
    if (session) {
      session.lastActiveAt = new Date().toISOString();
    }

    return { ...decoded, activeUser: user as UserRecord };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = 'session_token';
export const ROLE_COOKIE_NAME = 'user_role';
export const SUPER_ADMIN_COOKIE_NAME = 'super_admin_session_token';
export const ADMIN_COOKIE_NAME = 'admin_session_token';
export const INSTRUCTOR_COOKIE_NAME = 'instructor_session_token';
export const TRAINEE_COOKIE_NAME = 'trainee_session_token';

function resolveTargetHint(req: NextRequest, roleHint?: string): string {
  let targetHint = (roleHint || '').toUpperCase().replace(/[-\s]+/g, '_');
  if (!targetHint) {
    const path = req.nextUrl?.pathname || '';
    const referer = req.headers.get('referer') || '';
    if (path.includes('/super-admin') || referer.includes('/super-admin')) {
      targetHint = 'SUPER_ADMIN';
    } else if (path.includes('/admin') || referer.includes('/admin')) {
      targetHint = 'ADMIN';
    } else if (path.includes('/instructor') || referer.includes('/instructor')) {
      targetHint = 'INSTRUCTOR';
    } else if (path.includes('/trainee') || referer.includes('/trainee')) {
      targetHint = 'TRAINEE';
    }
  }
  return targetHint;
}

function getCandidateCookieNames(targetHint: string, req?: NextRequest): string[] {
  const referer = req?.headers?.get?.('referer') || '';
  const path = req?.nextUrl?.pathname || '';
  const isSuperAdminContext = referer.includes('/super-admin') || path.includes('/super-admin');

  const candidates: string[] = [];
  if (targetHint === 'SUPER_ADMIN' || targetHint === 'SUPERADMIN') {
    candidates.push(SUPER_ADMIN_COOKIE_NAME, SESSION_COOKIE_NAME);
  } else if (targetHint === 'ADMIN' || targetHint === 'ADMINISTRATOR' || targetHint === 'MANAGEMENT') {
    if (isSuperAdminContext) {
      candidates.push(SUPER_ADMIN_COOKIE_NAME, ADMIN_COOKIE_NAME, SESSION_COOKIE_NAME);
    } else {
      candidates.push(ADMIN_COOKIE_NAME, SUPER_ADMIN_COOKIE_NAME, SESSION_COOKIE_NAME);
    }
  } else if (targetHint === 'INSTRUCTOR') {
    candidates.push(INSTRUCTOR_COOKIE_NAME, SUPER_ADMIN_COOKIE_NAME, SESSION_COOKIE_NAME);
  } else if (targetHint === 'TRAINEE') {
    candidates.push(TRAINEE_COOKIE_NAME, SESSION_COOKIE_NAME);
  } else {
    candidates.push(SESSION_COOKIE_NAME, SUPER_ADMIN_COOKIE_NAME, ADMIN_COOKIE_NAME);
  }
  return candidates;
}

export function getSessionFromRequest(
  req: NextRequest,
  roleHint?: string
): (JWTPayload & { activeUser: UserRecord }) | null {
  // 1. Check authorization header first
  const authHeader = req.headers.get('authorization');
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (token) {
    const verified = verifySessionToken(token);
    if (verified) {
      if (!isPassiveRequest(req)) {
        touchUserActivity(verified.userId, null);
      }
      return verified;
    }
  }

  // 2. Infer role hint if not provided
  const targetHint = resolveTargetHint(req, roleHint);

  // 3. Assemble candidate cookies in prioritized order
  const candidates = getCandidateCookieNames(targetHint, req);

  for (const cookieName of candidates) {
    const cookieVal = req.cookies.get(cookieName)?.value;
    if (cookieVal) {
      const verified = verifySessionToken(cookieVal);
      if (verified) {
        const userRole = (verified.activeUser.role || '').toUpperCase().replace(/[-\s]+/g, '_');
        // If checking for Super Admin, strictly reject non-superadmin tokens to try next cookie
        if ((targetHint === 'SUPER_ADMIN' || targetHint === 'SUPERADMIN') && userRole !== 'SUPER_ADMIN' && userRole !== 'SUPERADMIN') {
          continue;
        }
        // If checking for Admin, reject non-admin/non-superadmin tokens to try next cookie
        if ((targetHint === 'ADMIN' || targetHint === 'ADMINISTRATOR') && !['ADMIN', 'ADMINISTRATOR', 'SUPER_ADMIN', 'SUPERADMIN'].includes(userRole)) {
          continue;
        }
        // If checking for Instructor, reject non-instructor/non-superadmin tokens to try next cookie
        if (targetHint === 'INSTRUCTOR' && !['INSTRUCTOR', 'TEACHER', 'TRAINER', 'SUPER_ADMIN', 'SUPERADMIN'].includes(userRole)) {
          continue;
        }
        // If checking for Trainee, reject non-trainee tokens to try next cookie
        if (targetHint === 'TRAINEE' && !['TRAINEE', 'STUDENT'].includes(userRole)) {
          continue;
        }

        // Meaningful activity tracking: touch user activity in database throttled
        if (!isPassiveRequest(req)) {
          touchUserActivity(verified.userId, null);
        }

        return verified;
      }
    }
  }

  return null;
}

/**
 * Checks whether an incoming request contains a Remember Me session that has expired
 * specifically due to inactivity (exceeding 7 days for staff, or 30 days for trainees).
 */
export function isSessionExpiredDueToInactivity(req: NextRequest, roleHint?: string): boolean {
  const tokens: string[] = [];
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) tokens.push(authHeader.substring(7));

  for (const cookieName of getCandidateCookieNames(resolveTargetHint(req, roleHint), req)) {
    const cookieVal = req.cookies.get(cookieName)?.value;
    if (cookieVal) tokens.push(cookieVal);
  }

  for (const token of tokens) {
    try {
      const decoded = jwt.verify(token, getJwtSecret(), { ignoreExpiration: true }) as JWTPayload;
      if (decoded && decoded.rememberMe) {
        const timeoutMs = getInactivityTimeoutMs(decoded.role);
        const session = db.getSessionByToken(token);
        const lastActiveMs = session?.lastActiveAt
          ? new Date(session.lastActiveAt).getTime()
          : (decoded.lastActiveAt || (decoded.iat ? decoded.iat * 1000 : 0));

        if (lastActiveMs && (Date.now() - lastActiveMs) > timeoutMs) {
          return true;
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return false;
}

/**
 * Returns the decoded payload of the first token on the request that is otherwise valid
 * but has been revoked by a Super Admin.
 */
export function getRevokedSessionFromRequest(req: NextRequest, roleHint?: string): JWTPayload | null {
  const tokens: string[] = [];
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) tokens.push(authHeader.substring(7));

  for (const cookieName of getCandidateCookieNames(resolveTargetHint(req, roleHint), req)) {
    const cookieVal = req.cookies.get(cookieName)?.value;
    if (cookieVal) tokens.push(cookieVal);
  }

  for (const token of tokens) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
      if (isUserTokenRevoked(decoded.userId, decoded.iat)) return decoded;
    } catch {
      // Invalid / expired token — not a revocation
    }
  }
  return null;
}

export function setSessionCookies(
  res: NextResponse,
  token: string,
  role: string,
  rememberMe = false
) {
  const normRole = (role || '').toUpperCase().replace(/[-\s]+/g, '_');
  const isTrainee = normRole === 'TRAINEE' || normRole === 'STUDENT';
  const maxAge = rememberMe ? (isTrainee ? 30 * 86400 : 7 * 86400) : undefined;

  const cookieBase = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    ...(maxAge !== undefined ? { maxAge } : {}),
  };

  // Set the primary session token
  res.cookies.set(SESSION_COOKIE_NAME, token, cookieBase);

  // Set dedicated role token so separate roles never overwrite each other
  if (normRole === 'SUPER_ADMIN' || normRole === 'SUPERADMIN') {
    res.cookies.set(SUPER_ADMIN_COOKIE_NAME, token, cookieBase);
  } else if (normRole === 'ADMIN' || normRole === 'ADMINISTRATOR') {
    res.cookies.set(ADMIN_COOKIE_NAME, token, cookieBase);
  } else if (normRole === 'INSTRUCTOR') {
    res.cookies.set(INSTRUCTOR_COOKIE_NAME, token, cookieBase);
  } else if (normRole === 'TRAINEE') {
    res.cookies.set(TRAINEE_COOKIE_NAME, token, cookieBase);
  }

  res.cookies.set(ROLE_COOKIE_NAME, role, {
    httpOnly: false, // Accessible for routing hints in middleware / UI
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(maxAge !== undefined ? { maxAge } : {}),
  });
}

export function clearSessionCookies(res: NextResponse, roleToClear?: string) {
  const norm = (roleToClear || '').toUpperCase().replace(/[-\s]+/g, '_');

  const deleteCookie = (name: string, httpOnly = true) => {
    try {
      res.cookies.delete(name);
    } catch {}
    res.cookies.set(name, '', {
      httpOnly,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  };

  if (norm === 'SUPER_ADMIN' || norm === 'SUPERADMIN') {
    deleteCookie(SUPER_ADMIN_COOKIE_NAME);
  } else if (norm === 'ADMIN' || norm === 'ADMINISTRATOR') {
    deleteCookie(ADMIN_COOKIE_NAME);
  } else if (norm === 'INSTRUCTOR') {
    deleteCookie(INSTRUCTOR_COOKIE_NAME);
  } else if (norm === 'TRAINEE') {
    deleteCookie(TRAINEE_COOKIE_NAME);
  } else {
    // Clear all role-specific cookies
    deleteCookie(SUPER_ADMIN_COOKIE_NAME);
    deleteCookie(ADMIN_COOKIE_NAME);
    deleteCookie(INSTRUCTOR_COOKIE_NAME);
    deleteCookie(TRAINEE_COOKIE_NAME);
  }

  // Always clear general session and role cookies
  deleteCookie(SESSION_COOKIE_NAME);
  deleteCookie(ROLE_COOKIE_NAME, false);
}
