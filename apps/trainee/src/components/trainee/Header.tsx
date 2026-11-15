'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Menu,
  Search,
  Bell,
  User,
  LogOut,
  PlayCircle,
  ShieldCheck,
  ChevronDown,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  ThemeToggle,
  LogoutConfirmationModal,
  HeaderClock,
  fetchCachedAuthMe,
  NEWSIM_NOTIFICATIONS_SYNC_EVENT,
  type NotificationsSyncedDetail,
} from '@newsim/ui';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
  onOpenSearch?: () => void;
  unreadNotificationsCount?: number;
}

export function Header({
  onMobileMenuToggle,
  onOpenSearch,
  unreadNotificationsCount = 0,
}: HeaderProps) {
  const router = useRouter();
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<{
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    srn?: string | null;
    avatarUrl?: string | null;
  } | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

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

  const fetchRecentNotifications = () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    fetch('/api/trainee/notifications')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setNotifications(json.data.slice(0, 5));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    const onSynced = (e: Event) => {
      const detail = (e as CustomEvent<NotificationsSyncedDetail>).detail;
      if (detail?.endpoint === '/api/trainee/notifications') {
        setNotifications(detail.notifications.slice(0, 5));
      }
    };
    window.addEventListener(NEWSIM_NOTIFICATIONS_SYNC_EVENT, onSynced);
    return () => window.removeEventListener(NEWSIM_NOTIFICATIONS_SYNC_EVENT, onSynced);
  }, []);

  useEffect(() => {
    if (notifDropdownOpen) {
      fetchRecentNotifications();
    }
  }, [notifDropdownOpen]);

  const unreadCount = unreadNotificationsCount || notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/trainee/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  const handleNotificationClick = async (n: any) => {
    setNotifDropdownOpen(false);
    if (!n.isRead) {
      try {
        await fetch('/api/trainee/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: n.id }),
        });
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
      } catch {}
    }
    router.push(n.link || '/notifications');
  };

  useEffect(() => {
    let active = true;
    const loadProfile = (force = false) => {
      fetchCachedAuthMe('/api/auth/me?portal=trainee', { force })
        .then((json) => {
          if (active && json?.success && json.user) {
            setUserProfile(json.user);
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

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  const displayName = userProfile?.firstName
    ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim()
    : userProfile?.name || 'Trainee User';
  const displayEmail = userProfile?.email || 'trainee@newsim.com';
  const displayRole = userProfile
    ? userProfile.srn
      ? `ID: ${userProfile.srn}`
      : 'ID: SRN NOT SET'
    : 'ID: Loading...';
  const displayInitials = userProfile?.firstName
    ? `${userProfile.firstName[0]}${userProfile.lastName ? userProfile.lastName[0] : ''}`.toUpperCase()
    : 'TR';

  return (
    <header className="sticky top-0 z-30 h-16 pt-[env(safe-area-inset-top,0px)] bg-white/90 dark:bg-[#07111C]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/90 px-3 sm:px-6 flex items-center justify-between transition-colors duration-200 shadow-xs relative select-none">
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
          <span className="hidden sm:inline truncate">Search courses, lessons, assessments...</span>
          <span className="sm:hidden text-[11px]">Search...</span>
          <kbd className="hidden sm:inline-block ml-auto px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-900 text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Live Running Time, Theme Toggle, Notifications, Trainee Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Live Running Time Clock */}
        <HeaderClock />

        {/* Theme Selector */}
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
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden z-50 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0c1a2c] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">Trainee Dispatch</span>
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
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">No recent notifications.</div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer ${!notif.isRead ? 'bg-sky-50/30 dark:bg-sky-950/20' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        {notif.severity === 'CRITICAL' && <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                        {notif.severity === 'WARNING' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                        {(!notif.severity || notif.severity === 'INFO') && <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{notif.title}</div>
                          <p className="text-slate-600 dark:text-slate-400 text-[11px] line-clamp-2 mt-0.5">{notif.message}</p>
                          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0c1a2c] text-center">
                <Link
                  href="/notifications"
                  onClick={() => setNotifDropdownOpen(false)}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-semibold block py-1 transition-colors"
                >
                  View All Trainee Alerts →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Trainee User Profile Menu */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all group focus:outline-none cursor-pointer"
          >
            <div className="inline-flex h-8 w-8 select-none items-center justify-center overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-700/60 shadow-2xs text-xs font-bold text-sky-700 dark:text-sky-300 font-mono">
              {userProfile?.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                displayInitials
              )}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                {displayName}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-medium">{displayRole}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden z-50 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0c1a2c]">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{displayName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">{displayEmail}</div>
              </div>

              <div className="py-2 px-1 text-xs space-y-0.5">
                <Link
                  href="/profile"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors font-medium"
                >
                  <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>My Profile</span>
                </Link>
                <Link
                  href="/learning"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors font-medium"
                >
                  <PlayCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Learning Player</span>
                </Link>
                <Link
                  href="/certificates"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors font-medium"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Certificates</span>
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
        portalName="Maritime Trainee Portal"
        userName={displayName}
        title="Sign Out of Trainee Portal"
        description="Are you sure you want to end your seafarer learning session? Any quiz or assessment in progress will need to be resumed on next login."
      />
    </header>
  );
}
