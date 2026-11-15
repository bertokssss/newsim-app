'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/instructor/Sidebar';
import { Header } from '@/components/instructor/Header';
import { PortalAccessGuard, fetchCachedAuthMe, invalidateAuthMeCache } from '@newsim/ui';

const GlobalSearchModal = dynamic(
  () => import('@/components/instructor/GlobalSearchModal').then((m) => m.GlobalSearchModal),
  { ssr: false }
);
const NotificationToaster = dynamic(
  () => import('@newsim/ui').then((m) => m.NotificationToaster),
  { ssr: false }
);

export function InstructorLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname === '/login' ||
    pathname.startsWith('/(auth)') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms');

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Fetch active RBAC permissions for the Instructor portal (single-flight + 60s cached)
  useEffect(() => {
    if (isAuthPage) return;
    let active = true;
    const loadPermissions = async (force = false) => {
      try {
        const data = await fetchCachedAuthMe('/api/auth/me?portal=instructor', { force });
        if (!active || !data) return;
        if (data.success && data.user) {
          setPermissions(Array.isArray(data.user.permissions) ? data.user.permissions : []);
          setUserRole(data.user.role || 'INSTRUCTOR');
        } else {
          setPermissions([]);
        }
      } catch {
        // Keep previous state on transient network error
      }
    };
    loadPermissions(false);
    const handleForceRefresh = () => {
      invalidateAuthMeCache();
      void loadPermissions(true);
    };
    const handleFocus = () => {
      void loadPermissions(false);
    };
    window.addEventListener('newsim:permissions-updated', handleForceRefresh);
    window.addEventListener('profile-updated', handleForceRefresh);
    window.addEventListener('focus', handleFocus);
    return () => {
      active = false;
      window.removeEventListener('newsim:permissions-updated', handleForceRefresh);
      window.removeEventListener('profile-updated', handleForceRefresh);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthPage]);

  // Responsive desktop detection
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global shortcut (Cmd+K / Ctrl+K) to open search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-[#08101E] text-slate-900 dark:text-[#F8FAFC] flex flex-col antialiased selection:bg-sky-500 selection:text-white overflow-x-hidden transition-colors duration-200 relative">
      {/* Subtle Enterprise Ambient Mesh Wash (GPU-light radial gradient) */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'radial-gradient(60% 40% at 100% 0%, rgba(14, 165, 233, 0.045), transparent), radial-gradient(50% 40% at 0% 100%, rgba(99, 102, 241, 0.035), transparent)',
        }}
      />

      {/* Instructor Animated Expanding Sidebar */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        open={sidebarExpanded}
        setOpen={setSidebarExpanded}
        unreadCount={unreadCount}
        permissions={permissions}
        userRole={userRole}
      />

      {/* Main Workspace: CSS-transitioned shift in sync with sidebar expansion */}
      <div
        style={{
          paddingLeft: isDesktop ? (sidebarExpanded ? '280px' : '72px') : '0px',
        }}
        className="flex-1 flex flex-col min-w-0 w-full relative z-10 transition-[padding] duration-200 ease-out"
      >
        {/* Top Command Bar */}
        <Header
          onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onOpenSearch={() => setSearchModalOpen(true)}
          unreadNotificationsCount={unreadCount}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 px-3.5 py-4 pb-8 sm:p-6 lg:p-8 2xl:p-12 w-full mx-auto">
          <div className="w-full h-full">
            <PortalAccessGuard
              portal="INSTRUCTOR"
              pathname={pathname}
              permissions={permissions}
              userRole={userRole}
              dashboardHref="/dashboard"
            >
              {children}
            </PortalAccessGuard>
          </div>
        </main>
      </div>

      {/* Global Search Dialog Modal */}
      {searchModalOpen && (
        <GlobalSearchModal
          isOpen={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          permissions={permissions}
          userRole={userRole}
        />
      )}

      {/* Real-time notification pop-ups with sound */}
      <NotificationToaster endpoint="/api/instructor/notifications" onUnreadCountChange={setUnreadCount} />
    </div>
  );
}
