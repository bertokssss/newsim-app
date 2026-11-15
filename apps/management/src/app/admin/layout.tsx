'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import { GlobalSearchModal } from '@/components/admin/GlobalSearchModal';
import { NotificationToaster, PortalAccessGuard, fetchCachedAuthMe, invalidateAuthMeCache } from '@newsim/ui';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Session & RBAC validation (single-flight + 60s cached across routes; forced on explicit permission changes)
  useEffect(() => {
    let active = true;
    const validateSession = async (force = false) => {
      try {
        const data = await fetchCachedAuthMe('/api/auth/me?portal=admin', { force });
        if (!active || !data) return;
        if (!data.success) {
          if (data.code === 'SESSION_EXPIRED_INACTIVITY') {
            router.push('/login?error=inactivity');
          } else {
            router.push('/login?error=session_expired');
          }
          return;
        }
        setPermissions(Array.isArray(data.user?.permissions) ? data.user.permissions : []);
        setUserRole(data.user?.role || 'ADMIN');
      } catch {
        // Silently fail if network error, don't force logout just yet
      }
    };
    validateSession(false);
    const handleForceRefresh = () => {
      invalidateAuthMeCache();
      void validateSession(true);
    };
    const handleFocus = () => {
      void validateSession(false);
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
  }, [router]);

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

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-[#08101E] text-slate-900 dark:text-[#F8FAFC] flex flex-col antialiased selection:bg-sky-500 selection:text-white overflow-x-hidden transition-colors duration-200 relative">
      {/* Subtle enterprise ambient wash (GPU-light radial gradient) */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'radial-gradient(60% 40% at 100% 0%, rgba(14, 165, 233, 0.045), transparent), radial-gradient(50% 40% at 0% 100%, rgba(99, 102, 241, 0.035), transparent)',
        }}
      />

      {/* Admin Animated Expanding Sidebar */}
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
              portal="ADMIN"
              pathname={pathname}
              permissions={permissions}
              userRole={userRole}
              dashboardHref="/admin/dashboard"
            >
              {children}
            </PortalAccessGuard>
          </div>
        </main>
      </div>

      {/* Global Search Dialog Modal */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        permissions={permissions}
        userRole={userRole}
      />

      {/* Real-time notification pop-ups with sound */}
      <NotificationToaster endpoint="/api/admin/notifications" onUnreadCountChange={setUnreadCount} />
    </div>
  );
}
