'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Users,
  UserCheck,
  GraduationCap,
  FileText,
  ArrowRight,
  Loader2,
  Compass,
} from 'lucide-react';
import Link from 'next/link';
import { canAccessPortalRoute, resolveNavigationPermissions } from '@newsim/utils';
import { UserAvatar } from '@newsim/ui';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  link: string;
  category: string;
  status?: string;
  avatarUrl?: string | null;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissions?: string[] | null;
  userRole?: string | null;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  permissions = null,
  userRole = 'SUPER_ADMIN',
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    admins: SearchResultItem[];
    instructors: SearchResultItem[];
    trainees: SearchResultItem[];
    auditLogs: SearchResultItem[];
  }>({
    admins: [],
    instructors: [],
    trainees: [],
    auditLogs: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ admins: [], instructors: [], trainees: [], auditLogs: [] });
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/super-admin/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (data.success && data.data) {
          setResults({
            admins: data.data.admins || [],
            instructors: data.data.instructors || [],
            trainees: data.data.trainees || [],
            auditLogs: data.data.auditLogs || [],
          });
        }
      } catch (err) {
        console.error('SuperAdmin search query failed', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Super Admin portal functionalities and pages (scoped to governance & security)
  const SUPER_ADMIN_PAGES = [
    { id: 'p1', title: 'Executive Dashboard', subtitle: 'View high-level system metrics and platform overviews', link: '/super-admin/dashboard' },
    { id: 'p2', title: 'Administrators Directory', subtitle: 'Manage branch admins, account statuses, and privilege roles', link: '/super-admin/admins' },
    { id: 'p3', title: 'Instructor Accounts', subtitle: 'View and manage all active system instructors and credentials', link: '/super-admin/instructor-accounts' },
    { id: 'p4', title: 'Trainee Accounts', subtitle: 'Master trainee directory, account status, and credential records', link: '/super-admin/trainee-accounts' },
    { id: 'p5', title: 'Analytics & Trends', subtitle: 'Maritime training growth, enrollment demand, and simulator throughput', link: '/super-admin/analytics' },
    { id: 'p6', title: 'Compliance & System Reports', subtitle: 'Audit exports, enrollment summaries, and platform compliance reports', link: '/super-admin/reports' },
    { id: 'p7', title: 'Security & Active Sessions', subtitle: 'MFA enforcement, active session termination, and lockout policies', link: '/super-admin/security' },
    { id: 'p8', title: 'Master Security Audit Logs', subtitle: 'Track global system actions, administrator events, and compliance history', link: '/super-admin/audit-logs' },
    { id: 'p9', title: 'Roles & Permissions', subtitle: 'Access control governance, RBAC policy matrix, and authorization rights', link: '/super-admin/roles-permissions' },
    { id: 'p10', title: 'System Notifications & Alerts', subtitle: 'Platform broadcasts, urgent incident notices, and broadcast alerts', link: '/super-admin/notifications' },
    { id: 'p11', title: 'Platform Settings & Preferences', subtitle: 'Configure platform preferences, branding, and system defaults', link: '/super-admin/settings' },
  ];

  const effectivePermissions = resolveNavigationPermissions(
    'SUPER_ADMIN',
    permissions,
    userRole || 'SUPER_ADMIN'
  );
  const permittedPages = SUPER_ADMIN_PAGES.filter((p) =>
    canAccessPortalRoute('SUPER_ADMIN', p.link, effectivePermissions, userRole || 'SUPER_ADMIN')
  );

  const filteredPages = query.trim()
    ? permittedPages.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const hasResults =
    results.admins.length > 0 ||
    results.instructors.length > 0 ||
    results.trainees.length > 0 ||
    results.auditLogs.length > 0 ||
    filteredPages.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-20">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -15 }}
            className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10 text-slate-900 dark:text-white"
          >
            {/* Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0c1a2c]">
              <Search className="w-5 h-5 text-sky-500 shrink-0 mr-3" />
              <input
                type="text"
                placeholder="Search administrators, instructors, trainees, audit logs..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-sky-500 mr-2" />}
              <button
                onClick={onClose}
                className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Results Container */}
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              {!query.trim() && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">
                  Type a name, email, role, or governance feature to search the Super Admin console.
                </div>
              )}

              {query.trim() && !hasResults && !isLoading && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">
                  No matching records found for &ldquo;<span className="text-slate-900 dark:text-white font-medium">{query}</span>&rdquo;.
                </div>
              )}

              {/* Portal Functionalities / System Features Group */}
              {filteredPages.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400 mb-2">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Portal Features & Functionalities ({filteredPages.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredPages.map((item) => (
                      <Link
                        key={item.id}
                        href={item.link}
                        onClick={onClose}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-700 transition-colors group border border-transparent hover:border-fuchsia-500/30"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-300 transition-colors">
                            {item.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Admins Group (Supabase) */}
              {results.admins.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-2">
                    <Users className="w-3.5 h-3.5" />
                    <span>Administrators ({results.admins.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.admins.map((item) => (
                      <Link
                        key={item.id}
                        href={item.link}
                        onClick={onClose}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-700 transition-colors group border border-transparent hover:border-sky-500/30"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            src={item.avatarUrl}
                            name={item.title}
                            alt={item.title || 'Administrator'}
                            className="w-8 h-8 rounded-lg"
                            fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors truncate">
                              {item.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                              item.status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.status}
                          </span>
                          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructors Group (Supabase) */}
              {results.instructors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-2">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Instructors ({results.instructors.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.instructors.map((item) => (
                      <Link
                        key={item.id}
                        href={item.link}
                        onClick={onClose}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-700 transition-colors group border border-transparent hover:border-teal-500/30"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            src={item.avatarUrl}
                            name={item.title}
                            alt={item.title || 'Instructor'}
                            className="w-8 h-8 rounded-lg"
                            fallbackClassName="bg-teal-500/15 text-teal-600 dark:text-teal-400 text-[10px] font-bold"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors truncate">
                              {item.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Trainees Group (Supabase) */}
              {results.trainees.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Trainees ({results.trainees.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.trainees.map((item) => (
                      <Link
                        key={item.id}
                        href={item.link}
                        onClick={onClose}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-700 transition-colors group border border-transparent hover:border-emerald-500/30"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            src={item.avatarUrl}
                            name={item.title}
                            alt={item.title || 'Trainee'}
                            className="w-8 h-8 rounded-lg"
                            fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors truncate">
                              {item.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Logs Group (Supabase) */}
              {results.auditLogs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Audit Events ({results.auditLogs.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.auditLogs.map((item) => (
                      <Link
                        key={item.id}
                        href={item.link}
                        onClick={onClose}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-700 transition-colors group border border-transparent hover:border-indigo-500/30"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            src={item.avatarUrl}
                            name={item.subtitle || item.title}
                            alt={item.subtitle || item.title || 'Actor'}
                            className="w-7 h-7 rounded-lg"
                            fallbackClassName="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-mono font-medium text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors truncate">
                              {item.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#0c1a2c] border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px]">ESC</kbd> to close</span>
              <span className="font-mono text-[10px]">Global Command Search</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
