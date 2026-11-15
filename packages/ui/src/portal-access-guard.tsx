'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import {
  canAccessPortalRoute,
  getRequiredPermissionForRoute,
  type PortalType,
} from '@newsim/utils';

export interface PortalAccessGuardProps {
  portal: PortalType;
  pathname: string | null;
  permissions: string[] | null;
  userRole?: string | null;
  dashboardHref: string;
  children: React.ReactNode;
}

/**
 * Enforces RBAC module permissions at the portal route boundary so disabled
 * or unassigned modules cannot be bypassed via direct URL navigation.
 */
export function PortalAccessGuard({
  portal,
  pathname,
  permissions,
  userRole,
  dashboardHref,
  children,
}: PortalAccessGuardProps) {
  const currentPath = pathname || '';
  const requiredPermission = getRequiredPermissionForRoute(portal, currentPath);

  if (!requiredPermission) {
    return <>{children}</>;
  }

  if (permissions === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
          <p className="text-sm font-medium">Verifying module privileges...</p>
        </div>
      </div>
    );
  }

  const allowed = canAccessPortalRoute(portal, currentPath, permissions, userRole);

  if (!allowed) {
    return (
      <div className="min-h-[65vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-rose-200/80 dark:border-rose-500/20 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-xl shadow-lg p-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Module Access Restricted
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Your role or assigned module privileges do not include permission to view or operate this module.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
            Required privilege: {requiredPermission}
          </div>
          <div className="mt-6">
            <Link
              href={dashboardHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
