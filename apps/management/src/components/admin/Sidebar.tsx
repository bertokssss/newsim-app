'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BookOpen,
  FileSpreadsheet,
  CalendarCheck2,
  CalendarDays,
  CalendarOff,
  CreditCard,
  ShieldCheck,
  Scale,
  BarChart3,
  Bell,
  Settings,
  Anchor,
  X,
} from 'lucide-react';
import { cn, filterNavGroupsByPermissions } from '@newsim/utils';
import { UserAvatar, fetchCachedAuthMe } from '@newsim/ui';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  unreadCount?: number;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  permissions?: string[] | null;
  userRole?: string | null;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

interface SidebarCounts {
  trainees: number;
  instructors: number;
  courses: number;
  enrollments: number;
  pendingPayments: number;
  certificates: number;
  unreadNotifications: number;
  hasFinancialAccess?: boolean;
  permissions?: string[] | null;
}

interface SidebarCountsResponse {
  success?: boolean;
  data?: Partial<SidebarCounts>;
  error?: string;
  message?: string;
}

const DEFAULT_COUNTS: SidebarCounts = {
  trainees: 0,
  instructors: 0,
  courses: 0,
  enrollments: 0,
  pendingPayments: 0,
  certificates: 0,
  unreadNotifications: 0,
  hasFinancialAccess: false,
  permissions: null,
};

function formatCount(value: number): string {
  return value.toLocaleString('en-PH');
}

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
  unreadCount = 0,
  open: openProp,
  setOpen: setOpenProp,
  permissions: permissionsProp,
  userRole = 'ADMIN',
}: SidebarProps) {
  const pathname = usePathname();

  const [internalOpen, setInternalOpen] = useState(false);

  const [counts, setCounts] =
    useState<SidebarCounts>(DEFAULT_COUNTS);

  const [countsLoading, setCountsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const loadProfile = (force = false) => {
      fetchCachedAuthMe('/api/auth/me?portal=admin', { force })
        .then((data) => {
          if (active && data?.success && data.user) {
            setCurrentUser(data.user);
          }
        })
        .catch(() => {});
    };
    loadProfile(false);
    const onUpdated = () => loadProfile(true);
    window.addEventListener('profile-updated', onUpdated);
    return () => {
      active = false;
      window.removeEventListener('profile-updated', onUpdated);
    };
  }, []);

  const isExpanded =
    openProp !== undefined ? openProp : internalOpen;

  const setIsExpanded =
    setOpenProp !== undefined
      ? setOpenProp
      : setInternalOpen;

  // Lock body scroll when mobile sidebar is open (prevents iOS background bounce)
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  /*
   * ============================================================
   * LOAD LIVE SIDEBAR COUNTS
   * ============================================================
   *
   * All database counting is performed by the server API.
   * The sidebar only consumes the returned numbers.
   */
  useEffect(() => {
    let cancelled = false;

    const loadSidebarCounts = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        setCountsLoading(true);

        const response = await fetch('/api/admin/sidebar-counts', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        });

        let json: SidebarCountsResponse | null = null;

        try {
          json = (await response.json()) as SidebarCountsResponse;
        } catch {
          if (!cancelled) {
            setCounts(DEFAULT_COUNTS);
          }
          return;
        }

        if (!response.ok || !json?.success) {
          if (!cancelled) {
            setCounts(DEFAULT_COUNTS);
          }
          return;
        }

        if (!cancelled && json?.data) {
          setCounts({
            trainees: Number(json.data.trainees ?? 0),
            instructors: Number(json.data.instructors ?? 0),
            courses: Number(json.data.courses ?? 0),
            enrollments: Number(json.data.enrollments ?? 0),
            pendingPayments: Number(json.data.pendingPayments ?? 0),
            certificates: Number(json.data.certificates ?? 0),
            unreadNotifications: Number(json.data.unreadNotifications ?? unreadCount),
            hasFinancialAccess: json.data.hasFinancialAccess !== false,
            permissions: Array.isArray(json.data.permissions) ? json.data.permissions : null,
          });
        }
      } catch (error) {
        /*
         * Keep the sidebar usable even if the count endpoint
         * temporarily fails or network is disconnected.
         */
        if (!cancelled) {
          setCounts(DEFAULT_COUNTS);
        }
      } finally {
        if (!cancelled) {
          setCountsLoading(false);
        }
      }
    };

    void loadSidebarCounts();

    /*
     * Refresh counts every 30 seconds.
     *
     * This means that if a trainee registers, an instructor
     * is added, or a payment is verified, the sidebar will
     * eventually update without requiring a full page refresh.
     */
    const interval = window.setInterval(
      loadSidebarCounts,
      30_000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // Update counts.unreadNotifications reactively when unreadCount prop changes
  useEffect(() => {
    if (unreadCount !== undefined) {
      setCounts((prev) => ({
        ...prev,
        unreadNotifications: unreadCount,
      }));
    }
  }, [unreadCount]);

  /*
   * ============================================================
   * SIDEBAR NAVIGATION
   * ============================================================
   */
  const navGroups: NavGroup[] = [
    {
      group: 'COMMAND CENTER',
      items: [
        {
          name: 'Dashboard',
          href: '/admin/dashboard',
          icon: LayoutDashboard,
        },
      ],
    },

    {
      group: 'TRAINING OPERATIONS',
      items: [
        {
          name: 'Instructors',
          href: '/admin/instructors',
          icon: UserCheck,
          badge: countsLoading
            ? '...'
            : formatCount(counts.instructors),
        },

        {
          name: 'Courses',
          href: '/admin/courses',
          icon: BookOpen,
          badge: countsLoading
            ? '...'
            : formatCount(counts.courses),
        },

        {
          name: 'Enrollments',
          href: '/admin/enrollments',
          icon: FileSpreadsheet,
          badge: countsLoading
            ? '...'
            : formatCount(counts.enrollments),
        },

        {
          name: 'Grading Policies',
          href: '/admin/grading-policies',
          icon: Scale,
        },

        {
          name: 'Attendance',
          href: '/admin/attendance',
          icon: CalendarCheck2,
        },

        {
          name: 'Schedules',
          href: '/admin/schedules',
          icon: CalendarDays,
        },

        {
          name: 'Instructor Leaves',
          href: '/admin/leaves',
          icon: CalendarOff,
        },
      ],
    },

    {
      group: counts.hasFinancialAccess ? 'FINANCIAL & CERTIFICATION' : 'CERTIFICATION OPERATIONS',
      items: [
        ...(counts.hasFinancialAccess
          ? [
              {
                name: 'Payments',
                href: '/admin/payments',
                icon: CreditCard,
                badge: countsLoading
                  ? '...'
                  : formatCount(counts.pendingPayments),
                badgeColor: 'bg-emerald-500',
              },
            ]
          : []),

        {
          name: 'Certificates',
          href: '/admin/certificates',
          icon: ShieldCheck,
          badge: countsLoading
            ? '...'
            : formatCount(counts.certificates),
        },
      ],
    },

    {
      group: 'INSIGHTS & ACCOUNT',
      items: [
        {
          name: 'Reports',
          href: '/admin/reports',
          icon: BarChart3,
        },

        {
          name: 'Notifications',
          href: '/admin/notifications',
          icon: Bell,
          badge:
            !countsLoading &&
            counts.unreadNotifications > 0
              ? formatCount(counts.unreadNotifications)
              : unreadCount > 0
                ? formatCount(unreadCount)
                : undefined,
          badgeColor: 'bg-teal-500',
        },

        {
          name: 'Settings',
          href: '/admin/settings',
          icon: Settings,
        },
      ],
    },
  ];

  const visibleNavGroups = filterNavGroupsByPermissions(
    'ADMIN',
    navGroups,
    permissionsProp ?? counts.permissions,
    userRole || 'ADMIN'
  )
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.href !== '/admin/payments' || counts.hasFinancialAccess !== false
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {/* ========================================================
          MOBILE DRAWER BACKDROP
      ========================================================= */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ========================================================
          DESKTOP EXPANDABLE SIDEBAR
      ========================================================= */}
      <motion.aside
        animate={{
          width: isExpanded ? '280px' : '72px',
        }}
        transition={{
          duration: 0.3,
          ease: [0.16, 1, 0.3, 1],
        }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 bg-white/95 dark:bg-[#07111C]/95 border-r border-slate-200/80 dark:border-slate-800/90 hidden lg:flex lg:flex-col overflow-hidden shadow-xl dark:shadow-2xl transition-colors duration-200 select-none"
        )}
      >
        {/* Brand Banner */}
        <div className="h-16 px-4 flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800/90 bg-slate-50/50 dark:bg-[#07111C] shrink-0 backdrop-blur-md">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-md dark:shadow-[0_0_20px_rgba(14,165,233,0.5)] border border-white/20 shrink-0">
            <Anchor className="w-5 h-5 text-white dark:text-black stroke-[2.5]" />
          </div>

          <motion.div
            animate={{
              opacity: isExpanded ? 1 : 0,
              display: isExpanded ? 'block' : 'none',
            }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden whitespace-nowrap"
          >
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 dark:text-white tracking-wider text-base font-heading">
                NEWSIM
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-mono font-bold border border-sky-400/40">
                OPERATIONS
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-sky-600 dark:text-sky-400 font-bold">
              Training Administration
            </p>
          </motion.div>
        </div>

        {/* Navigation Link Groups */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4 space-y-6">
          {visibleNavGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              {isExpanded ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-3 mb-1 text-[10px] font-bold tracking-widest uppercase text-sky-600 dark:text-sky-400 font-mono whitespace-nowrap"
                >
                  {group.group}
                </motion.div>
              ) : (
                <div className="h-[1px] bg-slate-200 dark:bg-white/5 my-2 mx-1" />
              )}

              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={!isExpanded ? item.name : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative",
                          isActive
                            ? "bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-white border border-sky-400/40 shadow-sm dark:shadow-[0_0_15px_rgba(14,165,233,0.2)] font-bold"
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-5 h-5 shrink-0 transition-colors",
                            isActive
                              ? "text-sky-600 dark:text-sky-400"
                              : "text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                          )}
                        />

                        {/* Animated Label */}
                        <motion.span
                          animate={{
                            display: isExpanded ? "inline-block" : "none",
                            opacity: isExpanded ? 1 : 0,
                          }}
                          transition={{ duration: 0.15 }}
                          className="whitespace-nowrap overflow-hidden text-ellipsis flex-1"
                        >
                          {item.name}
                        </motion.span>

                        {/* Badge Count */}
                        {item.badge && (
                          <motion.span
                            animate={{
                              display: isExpanded ? "inline-block" : "none",
                              opacity: isExpanded ? 1 : 0,
                            }}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0",
                              isActive
                                ? "bg-sky-500 text-white dark:text-black"
                                : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white border border-slate-200 dark:border-white/20"
                            )}
                          >
                            {item.badge}
                          </motion.span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Admin Privileged Footer */}
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/90 bg-slate-50 dark:bg-[#07111C] shrink-0">
          <div className="p-2 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar
                src={currentUser?.avatarUrl}
                firstName={currentUser?.firstName}
                lastName={currentUser?.lastName}
                fallback="AD"
                alt={
                  currentUser
                    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Administrator'
                    : 'Administrator'
                }
                className="w-8 h-8 rounded-lg border border-sky-400/40 shadow-sm shrink-0"
                fallbackClassName="bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs"
              />
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="truncate"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentUser
                      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Administrator'
                      : 'Administrator'}
                  </div>
                  <div className="text-[10px] text-sky-600 dark:text-sky-400 font-mono font-semibold">Operations Center</div>
                </motion.div>
              )}
            </div>
            {isExpanded && (
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 dark:bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] shrink-0" title="Operations Live" />
            )}
          </div>
        </div>
      </motion.aside>

      {/* ========================================================
          MOBILE DRAWER SIDEBAR (Accessible on mobile screens)
      ========================================================= */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 bottom-0 left-0 z-50 h-[100dvh] w-72 max-w-[85vw] bg-white/95 dark:bg-[#07111C]/95 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between pt-[max(1rem,env(safe-area-inset-top,1rem))] pb-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))] px-4 text-slate-900 dark:text-white shadow-2xl"
            >
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500 text-white dark:text-black flex items-center justify-center font-bold">
                      <Anchor className="w-4 h-4" />
                    </div>
                    <span className="font-extrabold text-slate-900 dark:text-white font-heading">NEWSIM</span>
                  </div>
                  <button onClick={onMobileClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" aria-label="Close sidebar">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="py-4 space-y-4 overflow-y-auto flex-1 pb-4">
                  {visibleNavGroups.map((group) => (
                    <div key={group.group}>
                      <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase font-mono mb-2 px-2">
                        {group.group}
                      </div>
                      <ul className="space-y-1">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive =
                            pathname === item.href ||
                            (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={onMobileClose}
                                className={cn(
                                  "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold min-h-[44px]",
                                  isActive
                                    ? "bg-sky-500 text-white dark:text-black font-bold"
                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                )}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Icon className="w-4 h-4" />
                                  <span>{item.name}</span>
                                </div>
                                {item.badge && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-white/20 text-[10px] font-mono">
                                    {item.badge}
                                  </span>
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  Logged in as <strong className="text-slate-900 dark:text-white">Administrator</strong>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
