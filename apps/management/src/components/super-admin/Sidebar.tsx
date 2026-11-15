'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BarChart3,
  FileSpreadsheet,
  ShieldCheck,
  ScrollText,
  KeyRound,
  Bell,
  Settings,
  Anchor,
  Radio,
  X
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

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
  unreadCount = 0,
  open: openProp,
  setOpen: setOpenProp,
  permissions: permissionsProp,
  userRole = 'SUPER_ADMIN',
}: SidebarProps) {
  const pathname = usePathname();
  const [internalOpen, setInternalOpen] = useState(false);
  const [counts, setCounts] = useState<{
    admins: number;
    instructors: number;
    trainees: number;
    permissions: string[] | null;
  }>({
    admins: 0,
    instructors: 0,
    trainees: 0,
    permissions: null,
  });
  const [countsLoading, setCountsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    const loadProfile = (force = false) => {
      fetchCachedAuthMe('/api/auth/me?portal=super-admin', { force })
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

  const isExpanded = openProp !== undefined ? openProp : internalOpen;
  const setIsExpanded = setOpenProp !== undefined ? setOpenProp : setInternalOpen;

  // Lock body scroll when mobile drawer is open (prevents iOS rubber-band background scroll)
  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  React.useEffect(() => {
    let cancelled = false;

    const loadSidebarCounts = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        setCountsLoading(true);
        const res = await fetch('/api/super-admin/sidebar-counts', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const json = await res.json();
        if (json.success && !cancelled) {
          setCounts({
            admins: json.data.admins || 0,
            instructors: json.data.instructors || 0,
            trainees: json.data.trainees || 0,
            permissions: Array.isArray(json.data.permissions) ? json.data.permissions : null,
          });
        }
      } catch (error) {
        console.error('Failed to fetch sidebar counts:', error);
      } finally {
        if (!cancelled) setCountsLoading(false);
      }
    };

    void loadSidebarCounts();
    const interval = window.setInterval(loadSidebarCounts, 30_000);
    const handleRefresh = () => {
      void loadSidebarCounts();
    };
    window.addEventListener('newsim:permissions-updated', handleRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('newsim:permissions-updated', handleRefresh);
    };
  }, []);

  const formatCount = (count: number) => (count > 99 ? '99+' : count.toString());

  const navGroups: NavGroup[] = [
    {
      group: 'COMMAND CENTER',
      items: [
        { name: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'ACCOUNT MANAGEMENT',
      items: [
        { name: 'Admin Accounts', href: '/super-admin/admins', icon: Users, badge: countsLoading ? '...' : formatCount(counts.admins) },
        { name: 'Instructor Accounts', href: '/super-admin/instructor-accounts', icon: UserCheck, badge: countsLoading ? '...' : formatCount(counts.instructors) },
        { name: 'Trainee Accounts', href: '/super-admin/trainee-accounts', icon: Users, badge: countsLoading ? '...' : formatCount(counts.trainees) },
      ],
    },
    {
      group: 'SYSTEM OVERSIGHT',
      items: [
        { name: 'Analytics', href: '/super-admin/analytics', icon: BarChart3 },
        { name: 'Reports', href: '/super-admin/reports', icon: FileSpreadsheet },
      ],
    },
    {
      group: 'SECURITY & GOVERNANCE',
      items: [
        { name: 'Security', href: '/super-admin/security', icon: ShieldCheck },
        { name: 'Audit Logs', href: '/super-admin/audit-logs', icon: ScrollText },
        { name: 'Roles & Permissions', href: '/super-admin/roles-permissions', icon: KeyRound },
      ],
    },
    {
      group: 'SYSTEM',
      items: [
        { name: 'Notifications', href: '/super-admin/notifications', icon: Bell, badge: unreadCount > 0 ? String(unreadCount) : undefined, badgeColor: 'bg-sky-500' },
        { name: 'Settings', href: '/super-admin/settings', icon: Settings },
      ],
    },
  ];

  const visibleNavGroups = filterNavGroupsByPermissions(
    'SUPER_ADMIN',
    navGroups,
    permissionsProp ?? counts.permissions,
    userRole || 'SUPER_ADMIN'
  );

  return (
    <>
      {/* Mobile Drawer Backdrop & Overlay */}
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

      {/* Desktop Expandable Animated Sidebar */}
      <motion.aside
        animate={{
          width: isExpanded ? '280px' : '72px',
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
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
              <span className="font-extrabold text-slate-900 dark:text-white tracking-wider text-base font-heading">NEWSIM</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-mono font-bold border border-sky-400/40">
                PRO
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-sky-600 dark:text-sky-400 font-bold">
              Super Admin Console
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
                  const isActive = pathname === item.href || (item.href !== '/super-admin/dashboard' && pathname.startsWith(item.href));

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
                            isActive ? "text-sky-600 dark:text-sky-400" : "text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
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

        {/* Super Admin Privileged Footer */}
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/90 bg-slate-50 dark:bg-[#07111C] shrink-0">
          <div className="p-2 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar
                src={currentUser?.avatarUrl}
                firstName={currentUser?.firstName}
                lastName={currentUser?.lastName}
                fallback="SA"
                alt={
                  currentUser
                    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Super Admin'
                    : 'Super Admin'
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
                      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Super Admin'
                      : 'Super Admin'}
                  </div>
                  <div className="text-[10px] text-sky-600 dark:text-sky-400 font-mono font-semibold">Master Governance</div>
                </motion.div>
              )}
            </div>
            {isExpanded && (
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 dark:bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] shrink-0" title="Full Governance Privileges Active" />
            )}
          </div>
        </div>
      </motion.aside>

      {/* Mobile Drawer (Accessible on mobile screens) */}
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
                          const isActive = pathname === item.href;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={onMobileClose}
                                className={cn(
                                  "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold min-h-[44px]",
                                  isActive ? "bg-sky-500 text-white dark:text-black font-bold" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
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
                  Logged in as <strong className="text-slate-900 dark:text-white">Super Admin</strong>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
