'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  Bell,
  Shield,
  Activity,
  LogOut,
  Settings,
  KeyRound,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck
} from 'lucide-react';
import * as Avatar from '@radix-ui/react-avatar';
import {
  ThemeToggle,
  LogoutConfirmationModal,
  HeaderClock,
  fetchCachedAuthMe,
  NEWSIM_NOTIFICATIONS_SYNC_EVENT,
  type NotificationsSyncedDetail,
} from '@newsim/ui';

interface HeaderProps {
  onMobileMenuToggle: () => void;
  onOpenSearch: () => void;
  unreadNotificationsCount?: number;
}

export function Header({
  onMobileMenuToggle,
  onOpenSearch,
  unreadNotificationsCount = 0,
}: HeaderProps) {
  const router = useRouter();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Fetch current user (shared single-flight cache)
  useEffect(() => {
    let active = true;
    const loadUser = (force = false) => {
      fetchCachedAuthMe('/api/auth/me?portal=super-admin', { force })
        .then((data) => {
          if (active && data?.success && data.user) {
            setCurrentUser(data.user);
          }
        })
        .catch(() => {});
    };
    loadUser(false);
    const onUpdated = () => loadUser(true);
    window.addEventListener('profile-updated', onUpdated);
    return () => {
      active = false;
      window.removeEventListener('profile-updated', onUpdated);
    };
  }, []);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setNotifDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    fetch('/api/super-admin/notifications')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setRecentNotifications(data.data.slice(0, 5));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    const onSynced = (e: Event) => {
      const detail = (e as CustomEvent<NotificationsSyncedDetail>).detail;
      if (detail?.endpoint === '/api/super-admin/notifications') {
        setRecentNotifications(detail.notifications.slice(0, 5));
      }
    };
    window.addEventListener(NEWSIM_NOTIFICATIONS_SYNC_EVENT, onSynced);
    return () => window.removeEventListener(NEWSIM_NOTIFICATIONS_SYNC_EVENT, onSynced);
  }, []);

  useEffect(() => {
    if (notifDropdownOpen && recentNotifications.length === 0) {
      fetchNotifications();
    }
  }, [notifDropdownOpen]);

  const unreadCount = recentNotifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/super-admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_ALL_READ' }),
      });
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  const handleNotificationClick = async (notif: any) => {
    setNotifDropdownOpen(false);
    if (!notif.isRead) {
      try {
        await fetch('/api/super-admin/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'MARK_READ', notificationId: notif.id }),
        });
        setRecentNotifications((prev) =>
          prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
        );
      } catch {}
    }
    router.push(notif.link || '/super-admin/notifications');
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout?role=super_admin', { method: 'POST' });
    } catch {
      // Continue anyway
    } finally {
      router.push('/login?role=super-admin');
      router.refresh();
    }
  };

  const displayName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Super Admin' : 'Super Admin';
  const displayEmail = currentUser?.email || '';
  const displayRole = currentUser?.role || 'SUPER_ADMIN';
  const displayInitials = currentUser && (currentUser.firstName || currentUser.lastName)
    ? `${(currentUser.firstName?.[0] || '').toUpperCase()}${(currentUser.lastName?.[0] || '').toUpperCase()}`
    : 'SA';

  return (
    <header className="sticky top-0 z-30 h-16 pt-[env(safe-area-inset-top,0px)] bg-white/90 dark:bg-[#07111C]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/90 px-3 sm:px-6 flex items-center justify-between transition-colors duration-200 shadow-xs relative">
      {/* Left: Mobile Trigger & Search Trigger */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 lg:hidden focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Trigger Bar */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all w-auto sm:w-72 md:w-80 text-left group shadow-xs min-h-[38px] cursor-pointer"
        >
          <Search className="w-4 h-4 text-slate-400 group-hover:text-sky-500 transition-colors shrink-0" />
          <span className="hidden sm:inline truncate">Search system, users, courses...</span>
          <span className="sm:hidden text-[11px]">Search...</span>
          <kbd className="hidden sm:inline-block ml-auto px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-900 text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Live Running Time, Theme Toggle, Notifications, Super Admin Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Live Running Time Clock */}
        <HeaderClock />

        {/* Theme Selector (Dark, Light, System) */}
        <ThemeToggle />

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifDropdownRef}>
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-sky-600 text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden z-50 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0c1a2c] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">System Alerts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 font-mono font-medium border border-sky-200 dark:border-sky-800">
                    {unreadCount} new
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentNotifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">No recent notifications.</div>
                ) : (
                  recentNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer ${!notif.isRead ? 'bg-sky-50/30 dark:bg-sky-950/20' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        {notif.severity === 'CRITICAL' && <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                        {notif.severity === 'WARNING' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                        {notif.severity === 'INFO' && <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{notif.title}</div>
                          <p className="text-slate-600 dark:text-slate-400 text-[11px] line-clamp-2 mt-0.5">{notif.message}</p>
                          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                            {new Date(notif.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0c1a2c] text-center">
                <Link
                  href="/super-admin/notifications"
                  onClick={() => setNotifDropdownOpen(false)}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-semibold block py-1 transition-colors"
                >
                  View All System Alerts →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Super Admin User Profile Menu */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all group focus:outline-none cursor-pointer"
          >
            <Avatar.Root className="inline-flex h-8 w-8 select-none items-center justify-center overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-700/60 shadow-2xs">
              {currentUser?.avatarUrl ? (
                <Avatar.Image src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : null}
              <Avatar.Fallback className="text-xs font-bold text-sky-700 dark:text-sky-300 font-mono">
                {displayInitials}
              </Avatar.Fallback>
            </Avatar.Root>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                {displayName}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-medium">{displayRole}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
          </button>

          {/* User Menu Dropdown */}
          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden z-50 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0c1a2c]">
                <div className="text-sm font-bold text-slate-900 dark:text-white">{displayName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">{displayEmail}</div>
              </div>

              <div className="py-2 px-1 text-xs space-y-0.5">
                <Link
                  href="/super-admin/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors font-medium"
                >
                  <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Account & System Settings</span>
                </Link>

                <Link
                  href="/super-admin/security"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors font-medium"
                >
                  <Shield className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Security & Active Sessions</span>
                </Link>

                <Link
                  href="/super-admin/audit-logs"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors font-medium"
                >
                  <Activity className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Master Audit Logs</span>
                </Link>
              </div>

              <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0c1a2c]">
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    setShowLogoutModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-xs font-semibold text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out Securely</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => {
          if (!isLoggingOut) setShowLogoutModal(false);
        }}
        onConfirm={handleLogout}
        isLoading={isLoggingOut}
        portalName="Super Admin Portal"
        userName={displayName}
        title="Sign Out of Super Admin Portal"
        description="Are you sure you want to end your administrative governance session? All elevated controls will require re-authentication."
      />
    </header>
  );
}
