'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Anchor,
  LayoutDashboard,
  BookOpen,
  PlayCircle,
  Award,
  TrendingUp,
  FileSpreadsheet,
  CreditCard,
  ShieldCheck,
  CalendarDays,
  CalendarCheck2,
  GraduationCap,
  Bell,
  User,
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
  icon: React.ElementType;
  badge?: string | number;
  highlight?: boolean;
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
  userRole = 'TRAINEE',
}: SidebarProps) {
  const pathname = usePathname();
  const [internalOpen, setInternalOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

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

  const [userProfile, setUserProfile] = useState<{
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    srn?: string | null;
    avatarUrl?: string | null;
    role?: string;
    permissions?: string[];
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    const loadProfile = (force = false) => {
      fetchCachedAuthMe('/api/auth/me?portal=trainee', { force })
        .then((data) => {
          if (active && data?.success && data.user) {
            setUserProfile(data.user);
          }
        })
        .catch(() => {});
    };
    loadProfile(false);
    const onUpdated = () => loadProfile(true);
    window.addEventListener('profile-updated', onUpdated);
    window.addEventListener('newsim:permissions-updated', onUpdated);
    return () => {
      active = false;
      window.removeEventListener('profile-updated', onUpdated);
      window.removeEventListener('newsim:permissions-updated', onUpdated);
    };
  }, []);

  const navigation: NavGroup[] = [
    {
      group: 'COMMAND CENTER',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'LEARNING & TRAINING',
      items: [
        { name: 'My Courses', href: '/my-courses', icon: BookOpen },
        { name: 'Learning Player', href: '/learning', icon: PlayCircle },
        { name: 'Assessments', href: '/assessments', icon: Award },
        { name: 'Grades', href: '/grades', icon: GraduationCap },
        { name: 'Attendance', href: '/attendance', icon: CalendarCheck2 },
        { name: 'Progress', href: '/progress', icon: TrendingUp },
      ],
    },
    {
      group: 'ADMINISTRATIVE',
      items: [
        { name: 'Enrollment', href: '/enrollment', icon: FileSpreadsheet },
        { name: 'Payments', href: '/payments', icon: CreditCard },
        { name: 'Certificates', href: '/certificates', icon: ShieldCheck },
      ],
    },
    {
      group: 'SCHEDULE & SYSTEM',
      items: [
        { name: 'Schedule', href: '/schedules', icon: CalendarDays },
        {
          name: 'Notifications',
          href: '/notifications',
          icon: Bell,
          badge: unreadCount > 0 ? unreadCount : undefined,
          highlight: unreadCount > 0,
        },
        { name: 'Profile', href: '/profile', icon: User },
      ],
    },
  ];

  const effectivePermissions =
    permissionsProp !== undefined
      ? permissionsProp
      : Array.isArray(userProfile?.permissions)
        ? userProfile.permissions
        : null;
  const visibleNavigation = filterNavGroupsByPermissions(
    'TRAINEE',
    navigation,
    effectivePermissions,
    userRole || userProfile?.role || 'TRAINEE'
  );

  const renderNavContent = (expanded: boolean, isMobile: boolean) => (
    <div className="flex flex-col h-full bg-white/95 dark:bg-[#07111C]/95 border-r border-slate-200/80 dark:border-slate-800/90 text-slate-700 dark:text-slate-200 relative overflow-hidden select-none shadow-xl dark:shadow-2xl transition-colors duration-200">
      {/* Header / Brand Logo */}
      <div className={cn(
        "flex items-center justify-between px-4 border-b border-slate-200/80 dark:border-slate-800/90 bg-slate-50/50 dark:bg-[#07111C] relative z-20 shrink-0 overflow-hidden backdrop-blur-md",
        isMobile ? "pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] pb-3 h-auto" : "h-16"
      )}>
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-md dark:shadow-[0_0_20px_rgba(14,165,233,0.5)] border border-white/20 shrink-0">
            <Anchor className="w-5 h-5 text-white dark:text-black stroke-[2.5]" />
          </div>

          <AnimatePresence mode="wait">
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col min-w-0"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-wider text-slate-900 dark:text-white font-heading truncate">
                    NEWSIM
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-mono text-[10px] font-bold tracking-wide uppercase border border-sky-400/40">
                    SEAFARER
                  </span>
                </div>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold uppercase tracking-widest truncate">
                  Trainee Portal
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        {/* Mobile Close Button Only */}
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Feed */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4 space-y-6">
        {visibleNavigation.map((group) => (
          <div key={group.group} className="space-y-1">
            {expanded ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-3 text-[10px] font-mono font-bold tracking-widest text-sky-600 dark:text-sky-400 uppercase mb-1 whitespace-nowrap"
              >
                {group.group}
              </motion.div>
            ) : (
              <div className="h-[1px] bg-slate-200 dark:bg-white/5 my-2 mx-1" />
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => isMobile && onMobileClose?.()}
                    onMouseEnter={() => setHoveredItem(item.name)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 outline-none',
                      isActive
                        ? 'bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-white border border-sky-400/40 shadow-sm dark:shadow-[0_0_15px_rgba(14,165,233,0.2)] font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
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

                    {expanded && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="truncate font-sans flex-1"
                      >
                        {item.name}
                      </motion.span>
                    )}

                    {/* Badge / Pill */}
                    {expanded && item.badge && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0',
                          isActive
                            ? 'bg-sky-500 text-white dark:text-black'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white border border-slate-200 dark:border-white/20'
                        )}
                      >
                        {item.badge}
                      </motion.span>
                    )}

                    {/* Tooltip on Collapsed Desktop View when hovered */}
                    {!expanded && !isMobile && hoveredItem === item.name && (
                      <div className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-sans whitespace-nowrap shadow-2xl z-50 pointer-events-none border border-white/10 animate-in fade-in zoom-in-95 duration-150">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.badge && (
                            <span className="px-1.5 py-0.2 rounded bg-sky-500 text-[10px] text-white font-mono">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Profile */}
      <div className={cn("p-3 border-t border-slate-200/80 dark:border-slate-800/90 bg-slate-50 dark:bg-[#07111C] shrink-0", isMobile && "pb-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))]")}>
        <div className="p-2 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-sky-500/10 dark:bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-xs shadow-sm shrink-0 font-mono">
              {userProfile?.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : userProfile?.firstName
                ? `${userProfile.firstName[0]}${userProfile.lastName ? userProfile.lastName[0] : ''}`.toUpperCase()
                : 'TR'}
            </div>
            {expanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="truncate"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {userProfile?.firstName
                    ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim()
                    : (userProfile?.name || 'Trainee User')}
                </div>
                <div className="text-[10px] text-sky-600 dark:text-sky-400 font-mono font-semibold truncate">
                  {userProfile?.srn ? `ID: ${userProfile.srn}` : 'ID: SRN NOT SET'}
                </div>
              </motion.div>
            )}
          </div>
          {expanded && (
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 dark:bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] shrink-0" title="Trainee Active" />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Expandable Animated Sidebar on Hover */}
      <motion.aside
        animate={{
          width: isExpanded ? '280px' : '72px',
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 hidden lg:flex flex-col bg-white/95 dark:bg-[#07111C]/95 border-r border-slate-200/80 dark:border-slate-800/90 select-none overflow-hidden shadow-xl dark:shadow-2xl transition-colors duration-200'
        )}
      >
        {renderNavContent(isExpanded, false)}
      </motion.aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 bottom-0 left-0 h-[100dvh] w-72 max-w-[85vw] shadow-2xl z-50"
            >
              {renderNavContent(true, true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
