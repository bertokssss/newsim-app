import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isSessionExpiredDueToInactivity, INACTIVITY_EXPIRED_MESSAGE } from './session';
import { UserRecord } from '@newsim/database';

export interface SuperAdminAuthResult {
  authorized: boolean;
  user?: UserRecord;
  sessionId?: string;
  error?: string;
  statusCode?: number;
}

export function normalizeRole(role?: string | null): string {
  if (!role) return '';
  return role.toString().trim().toUpperCase().replace(/[-\s]+/g, '_');
}

export function normalizeStatus(status?: string | null): string {
  if (!status) return 'ACTIVE';
  return status.toString().trim().toUpperCase();
}

export function isSuperAdminRole(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'SUPER_ADMIN' || norm === 'SUPERADMIN';
}

export function isAdminRole(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return (
    norm === 'ADMIN' ||
    norm === 'ADMINISTRATOR' ||
    norm === 'SUPER_ADMIN' ||
    norm === 'SUPERADMIN'
  );
}

export function isInstructorRole(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return (
    norm === 'INSTRUCTOR' ||
    norm === 'TEACHER' ||
    norm === 'TRAINER' ||
    norm === 'SUPER_ADMIN' ||
    norm === 'SUPERADMIN'
  );
}

export function isTraineeRole(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return (
    norm === 'TRAINEE' ||
    norm === 'STUDENT'
  );
}

export function verifySuperAdminRequest(
  req: NextRequest,
  requiredPermission?: string
): SuperAdminAuthResult {
  const session = getSessionFromRequest(req, 'SUPER_ADMIN');

  if (!session) {
    if (isSessionExpiredDueToInactivity(req, 'SUPER_ADMIN')) {
      return {
        authorized: false,
        error: INACTIVITY_EXPIRED_MESSAGE,
        statusCode: 401,
      };
    }
    return {
      authorized: false,
      error: 'Authentication required. Please sign in with valid credentials.',
      statusCode: 401,
    };
  }

  const { activeUser, sessionId } = session;

  const status = normalizeStatus(activeUser.status);
  if (status !== 'ACTIVE') {
    return {
      authorized: false,
      error: `Account is currently ${status.toLowerCase()}. Access denied.`,
      statusCode: 403,
    };
  }

  if (!isSuperAdminRole(activeUser.role)) {
    return {
      authorized: false,
      error: 'Forbidden. This action requires Super Admin privileges.',
      statusCode: 403,
    };
  }

  if (requiredPermission) {
    const isPaymentPerm = [
      'PAYMENT_VIEW',
      'PAYMENT_VERIFY',
      'PAYMENT_REFUND',
      'FINANCIAL_REPORTS',
      'FINANCIAL_ACCESS',
    ].includes(requiredPermission.toUpperCase());

    if (isPaymentPerm) {
      return {
        authorized: false,
        error: `Financial privacy restriction: Super Admin accounts are restricted from '${requiredPermission}'.`,
        statusCode: 403,
      };
    }

    if (activeUser.permissions && !activeUser.permissions.includes('ALL')) {
      if (!activeUser.permissions.includes(requiredPermission)) {
        return {
          authorized: false,
          error: `Insufficient permission: Missing required privilege '${requiredPermission}'.`,
          statusCode: 403,
        };
      }
    }
  }

  return {
    authorized: true,
    user: {
      ...activeUser,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
    sessionId,
  };
}

export function verifyAdminRequest(
  req: NextRequest,
  requiredPermission?: string
): SuperAdminAuthResult {
  const session = getSessionFromRequest(req, 'ADMIN');

  if (!session) {
    if (isSessionExpiredDueToInactivity(req, 'ADMIN')) {
      return {
        authorized: false,
        error: INACTIVITY_EXPIRED_MESSAGE,
        statusCode: 401,
      };
    }
    return {
      authorized: false,
      error: 'Authentication required. Please sign in with valid credentials.',
      statusCode: 401,
    };
  }

  const { activeUser, sessionId } = session;

  const status = normalizeStatus(activeUser.status);
  if (status !== 'ACTIVE') {
    return {
      authorized: false,
      error: `Account is currently ${status.toLowerCase()}. Access denied.`,
      statusCode: 403,
    };
  }

  if (!isAdminRole(activeUser.role)) {
    return {
      authorized: false,
      error: 'Forbidden. This action requires Administrator privileges.',
      statusCode: 403,
    };
  }

  if (requiredPermission) {
    const isPaymentPerm = [
      'PAYMENT_VIEW',
      'PAYMENT_VERIFY',
      'PAYMENT_REFUND',
      'FINANCIAL_REPORTS',
      'FINANCIAL_ACCESS',
    ].includes(requiredPermission.toUpperCase());

    if (isPaymentPerm && isSuperAdminRole(activeUser.role)) {
      return {
        authorized: false,
        error: `Financial privacy restriction: Super Admin accounts are restricted from '${requiredPermission}'.`,
        statusCode: 403,
      };
    }

    if (activeUser.permissions && !activeUser.permissions.includes('ALL')) {
      if (!activeUser.permissions.includes(requiredPermission)) {
        return {
          authorized: false,
          error: `Insufficient permission: Missing required privilege '${requiredPermission}'.`,
          statusCode: 403,
        };
      }
    }
  }

  const normRole = normalizeRole(activeUser.role);
  return {
    authorized: true,
    user: {
      ...activeUser,
      role: normRole === 'SUPER_ADMIN' || normRole === 'SUPERADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
      status: 'ACTIVE',
    },
    sessionId,
  };
}

export function verifyInstructorRequest(
  req: NextRequest,
  requiredPermission?: string
): SuperAdminAuthResult {
  const session = getSessionFromRequest(req, 'INSTRUCTOR');

  if (!session) {
    if (isSessionExpiredDueToInactivity(req, 'INSTRUCTOR')) {
      return {
        authorized: false,
        error: INACTIVITY_EXPIRED_MESSAGE,
        statusCode: 401,
      };
    }
    return {
      authorized: false,
      error: 'Authentication required. Please sign in with valid credentials.',
      statusCode: 401,
    };
  }

  const { activeUser, sessionId } = session;

  const status = normalizeStatus(activeUser.status);
  if (status !== 'ACTIVE') {
    return {
      authorized: false,
      error: `Account is currently ${status.toLowerCase()}. Access denied.`,
      statusCode: 403,
    };
  }

  if (!isInstructorRole(activeUser.role)) {
    return {
      authorized: false,
      error: 'Forbidden. This action requires Instructor privileges.',
      statusCode: 403,
    };
  }

  if (requiredPermission && activeUser.permissions && !activeUser.permissions.includes('ALL')) {
    if (!activeUser.permissions.includes(requiredPermission)) {
      return {
        authorized: false,
        error: `Insufficient permission: Missing required privilege '${requiredPermission}'.`,
        statusCode: 403,
      };
    }
  }

  const normRole = normalizeRole(activeUser.role);
  return {
    authorized: true,
    user: {
      ...activeUser,
      role: normRole === 'SUPER_ADMIN' || normRole === 'SUPERADMIN' ? 'SUPER_ADMIN' : 'INSTRUCTOR',
      status: 'ACTIVE',
    },
    sessionId,
  };
}

export function hasFinancialPermission(user?: UserRecord | null): boolean {
  if (!user) return false;
  const role = normalizeRole(user.role);
  // Super Admin is explicitly restricted from routine financial transactions & payment amounts
  if (role === 'SUPER_ADMIN' || role === 'SUPERADMIN') return false;
  if (role !== 'ADMIN' && role !== 'ADMINISTRATOR') return false;

  const perms = user.permissions || [];
  return (
    perms.includes('ALL') ||
    perms.includes('PAYMENT_VIEW') ||
    perms.includes('PAYMENT_VERIFY') ||
    perms.includes('FINANCIAL_REPORTS') ||
    perms.includes('FINANCIAL_ACCESS')
  );
}

export function verifyAdminFinancialRequest(
  req: NextRequest,
  requiredPermission = 'PAYMENT_VIEW'
): SuperAdminAuthResult {
  const session = getSessionFromRequest(req, 'ADMIN');

  if (!session) {
    if (isSessionExpiredDueToInactivity(req, 'ADMIN')) {
      return {
        authorized: false,
        error: INACTIVITY_EXPIRED_MESSAGE,
        statusCode: 401,
      };
    }
    return {
      authorized: false,
      error: 'Authentication required. Please sign in with valid administrator credentials.',
      statusCode: 401,
    };
  }

  const { activeUser, sessionId } = session;

  const status = normalizeStatus(activeUser.status);
  if (status !== 'ACTIVE') {
    return {
      authorized: false,
      error: `Account is currently ${status.toLowerCase()}. Access denied.`,
      statusCode: 403,
    };
  }

  const role = normalizeRole(activeUser.role);
  // Explicitly deny Super Admin from financial transactions per specification
  if (role === 'SUPER_ADMIN' || role === 'SUPERADMIN') {
    return {
      authorized: false,
      error: 'Financial privacy restriction: Technical Super Administrators do not have access to payment records.',
      statusCode: 403,
    };
  }

  if (role !== 'ADMIN' && role !== 'ADMINISTRATOR') {
    return {
      authorized: false,
      error: 'Forbidden. This action requires Administrator financial privileges.',
      statusCode: 403,
    };
  }

  if (!hasFinancialPermission(activeUser)) {
    return {
      authorized: false,
      error: `Insufficient permission: Missing required financial privilege '${requiredPermission}'. Only authorized billing staff may view or verify payments.`,
      statusCode: 403,
    };
  }

  return {
    authorized: true,
    user: {
      ...activeUser,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    sessionId,
  };
}

export function verifyTraineeRequest(
  req: NextRequest,
  requiredPermission?: string
): SuperAdminAuthResult {
  const session = getSessionFromRequest(req, 'TRAINEE');

  if (!session) {
    if (isSessionExpiredDueToInactivity(req, 'TRAINEE')) {
      return {
        authorized: false,
        error: INACTIVITY_EXPIRED_MESSAGE,
        statusCode: 401,
      };
    }
    return {
      authorized: false,
      error: 'Authentication required. Please sign in to access trainee records.',
      statusCode: 401,
    };
  }

  const { activeUser, sessionId } = session;

  const status = normalizeStatus(activeUser.status);
  if (status !== 'ACTIVE') {
    return {
      authorized: false,
      error: `Account is currently ${status.toLowerCase()}. Access denied.`,
      statusCode: 403,
    };
  }

  if (!isTraineeRole(activeUser.role)) {
    return {
      authorized: false,
      error: 'Forbidden. This action requires Trainee privileges.',
      statusCode: 403,
    };
  }

  if (
    requiredPermission &&
    activeUser.permissions &&
    !activeUser.permissions.includes('ALL') &&
    !activeUser.permissions.includes('TRAINEE_ACCESS') &&
    !activeUser.permissions.includes(requiredPermission)
  ) {
    return {
      authorized: false,
      error: `Insufficient permission: Missing required privilege '${requiredPermission}'.`,
      statusCode: 403,
    };
  }

  return {
    authorized: true,
    user: {
      ...activeUser,
      role: 'TRAINEE',
      status: 'ACTIVE',
    },
    sessionId,
  };
}

export function createUnauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

export function createForbiddenResponse(message = 'Forbidden: Access denied'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}


