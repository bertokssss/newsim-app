'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, Home, LayoutDashboard, LogIn } from 'lucide-react';

export interface NotFoundViewProps {
  portal: 'MANAGEMENT' | 'INSTRUCTOR' | 'TRAINEE';
}

export function NotFoundView({ portal }: NotFoundViewProps) {
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL?.trim() || '/';
  const defaultAuthRoute = '/login';

  const [targetHref, setTargetHref] = useState<string>(defaultAuthRoute);
  const [targetLabel, setTargetLabel] = useState<string>('Sign In to Portal');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.success || !data?.user?.role) return;
        const role = String(data.user.role).toUpperCase();

        if (portal === 'MANAGEMENT') {
          if (role === 'SUPER_ADMIN') {
            setIsAuthenticated(true);
            setTargetHref('/super-admin/dashboard');
            setTargetLabel('Go to Super Admin Dashboard');
          } else if (role === 'ADMIN') {
            setIsAuthenticated(true);
            setTargetHref('/admin/dashboard');
            setTargetLabel('Go to Admin Dashboard');
          }
        } else if (portal === 'INSTRUCTOR' && role === 'INSTRUCTOR') {
          setIsAuthenticated(true);
          setTargetHref('/dashboard');
          setTargetLabel('Go to Instructor Dashboard');
        } else if (portal === 'TRAINEE' && role === 'TRAINEE') {
          setIsAuthenticated(true);
          setTargetHref('/dashboard');
          setTargetLabel('Go to Trainee Dashboard');
        }
      })
      .catch(() => {
        // Unauthenticated or unavailable; keep safe default /login destination
      });

    return () => {
      active = false;
    };
  }, [portal]);

  return (
    <div className="min-h-screen bg-[#07111C] text-slate-100 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Subtle Maritime Radar Rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
        <div className="w-[340px] h-[340px] sm:w-[540px] sm:h-[540px] rounded-full border border-sky-400/25" />
        <div className="absolute w-[220px] h-[220px] sm:w-[360px] sm:h-[360px] rounded-full border border-[#D8C4A5]/25" />
      </div>

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0D1A2B]/90 backdrop-blur-xl p-6 sm:p-10 text-center shadow-2xl">
        <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-[#D8C4A5]/10 border border-[#D8C4A5]/30 flex items-center justify-center">
          <Compass className="w-8 h-8 text-[#D8C4A5]" />
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-400">
          Navigation Alert &bull; 404
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Page Not Found
        </h1>
        <p className="mt-3 text-sm text-slate-300 leading-relaxed">
          The requested chart coordinate does not exist or may have been relocated within the NEWSIM Maritime Training System.
        </p>

        <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <Link
            href={targetHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D8C4A5] px-5 py-3 text-sm font-bold text-[#07111C] hover:bg-[#e5d5bc] transition-colors"
          >
            {isAuthenticated ? (
              <LayoutDashboard className="w-4 h-4" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            <span>{targetLabel}</span>
          </Link>

          <Link
            href={landingUrl}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Homepage</span>
          </Link>
        </div>

        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          <Link href="/privacy" className="hover:text-slate-200 transition-colors">
            Privacy Policy
          </Link>
          <span>&bull;</span>
          <Link href="/terms" className="hover:text-slate-200 transition-colors">
            Terms &amp; Conditions
          </Link>
        </div>
      </div>
    </div>
  );
}
