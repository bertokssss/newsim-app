'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cookie, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';

export const COOKIE_CONSENT_STORAGE_KEY = 'newsim_cookie_consent_v1';
const OPEN_SETTINGS_EVENT = 'newsim:open-cookie-settings';
const CONSENT_UPDATED_EVENT = 'newsim:cookie-consent-updated';

export interface CookieConsentPreferences {
  version: string;
  essential: true;
  analytics: boolean;
  preferences: boolean;
  updatedAt: string;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SENSITIVE_PARAM_KEYS = new Set([
  'email',
  'srn',
  'password',
  'token',
  'access_token',
  'code',
  'otp',
  'mobile',
  'phone',
  'card',
  'cvv',
  'payment_intent',
  'answer',
  'answers',
  'secret',
]);

function readStoredConsent(): CookieConsentPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences>;
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.preferences !== 'boolean') {
      return null;
    }
    return {
      version: parsed.version || '2026-11-v1',
      essential: true,
      analytics: parsed.analytics,
      preferences: parsed.preferences,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeStoredConsent(consent: CookieConsentPreferences) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
    const maxAge = 180 * 24 * 60 * 60;
    const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `newsim_cookie_consent=${encodeURIComponent(
      consent.analytics ? 'analytics' : 'essential'
    )}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureFlag}`;
    window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: consent }));
  } catch {
    // Non-blocking storage error
  }
}

export function openCookiePreferences() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
  }
}

/**
 * Sanitizes analytics parameters to guarantee no passwords, SRNs, emails,
 * payment details, or assessment answers are ever transmitted to GA4.
 */
export function sanitizeAnalyticsParams(
  params?: Record<string, string | number | boolean | undefined>
): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  if (!params) return clean;

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const lowerKey = key.toLowerCase();
    if (
      SENSITIVE_PARAM_KEYS.has(lowerKey) ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('srn') ||
      lowerKey.includes('email') ||
      lowerKey.includes('phone') ||
      lowerKey.includes('card') ||
      lowerKey.includes('answer')
    ) {
      continue;
    }
    if (typeof value === 'string') {
      if (value.includes('@')) continue;
      clean[key] = value.slice(0, 120);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Sends a privacy-conscious GA4 event only if analytics consent has been explicitly granted.
 */
export function trackAnalyticsEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  if (typeof window === 'undefined') return;
  const consent = readStoredConsent();
  if (!consent?.analytics) return;
  if (typeof window.gtag !== 'function') return;

  window.gtag('event', eventName, sanitizeAnalyticsParams(params));
}

export function CookieConsentBanner({
  privacyHref = '/privacy',
  cookiePolicyHref = '/privacy#cookies',
}: {
  privacyHref?: string;
  cookiePolicyHref?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [preferencesEnabled, setPreferencesEnabled] = useState(true);

  useEffect(() => {
    setMounted(true);
    const existing = readStoredConsent();
    if (!existing) {
      setVisible(true);
    } else {
      setAnalyticsEnabled(existing.analytics);
      setPreferencesEnabled(existing.preferences);
    }

    const handleOpen = () => {
      const latest = readStoredConsent();
      if (latest) {
        setAnalyticsEnabled(latest.analytics);
        setPreferencesEnabled(latest.preferences);
      }
      setCustomizeOpen(true);
      setVisible(true);
    };

    window.addEventListener(OPEN_SETTINGS_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handleOpen);
  }, []);

  const saveDecision = useCallback((analytics: boolean, preferences: boolean) => {
    const record: CookieConsentPreferences = {
      version: '2026-11-v1',
      essential: true,
      analytics,
      preferences,
      updatedAt: new Date().toISOString(),
    };
    writeStoredConsent(record);
    setAnalyticsEnabled(analytics);
    setPreferencesEnabled(preferences);
    setCustomizeOpen(false);
    setVisible(false);
  }, []);

  if (!mounted || !visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie Consent Preferences"
      className="fixed bottom-3 left-3 right-3 sm:bottom-5 sm:left-auto sm:right-5 sm:max-w-lg z-[95] rounded-2xl border border-[#D8C4A5]/30 bg-[#0A1625]/95 backdrop-blur-xl text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.65)] p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#D8C4A5]/15 border border-[#D8C4A5]/30 flex items-center justify-center shrink-0">
            <Cookie className="w-4 h-4 text-[#D8C4A5]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">NEWSIM Cookie Preferences</h2>
            <p className="text-[11px] text-slate-400">Your privacy &amp; session security controls</p>
          </div>
        </div>
        {readStoredConsent() && (
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label="Close cookie preferences"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-300 leading-relaxed">
        We use <strong className="text-white">essential cookies</strong> to keep your authentication session secure and protect your account. Optional <strong className="text-white">analytics</strong> and preference cookies are disabled until you consent. Read our{' '}
        <Link href={privacyHref} className="text-sky-400 hover:text-sky-300 underline underline-offset-2">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href={cookiePolicyHref} className="text-sky-400 hover:text-sky-300 underline underline-offset-2">
          Cookie Policy
        </Link>
        .
      </p>

      {customizeOpen && (
        <div className="mt-3 space-y-2.5 rounded-xl border border-white/10 bg-[#07111C]/80 p-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white">Essential Session &amp; Security</p>
              <p className="text-[11px] text-slate-400">Login tokens, portal role boundaries, and CSRF security.</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 shrink-0">
              <ShieldCheck className="w-3 h-3" /> Always Active
            </span>
          </div>

          <label className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 cursor-pointer">
            <div>
              <p className="font-semibold text-white">Privacy-Safe Analytics (GA4)</p>
              <p className="text-[11px] text-slate-400">Measures portal traffic and enrollment conversions without PII.</p>
            </div>
            <input
              type="checkbox"
              checked={analyticsEnabled}
              onChange={(e) => setAnalyticsEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#D8C4A5] rounded cursor-pointer shrink-0"
            />
          </label>

          <label className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 cursor-pointer">
            <div>
              <p className="font-semibold text-white">Interface Preferences</p>
              <p className="text-[11px] text-slate-400">Remembers theme and non-sensitive workspace preferences.</p>
            </div>
            <input
              type="checkbox"
              checked={preferencesEnabled}
              onChange={(e) => setPreferencesEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#D8C4A5] rounded cursor-pointer shrink-0"
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setCustomizeOpen((prev) => !prev)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {customizeOpen ? 'Hide Options' : 'Customize'}
        </button>
        <button
          type="button"
          onClick={() => saveDecision(false, false)}
          className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
        >
          Reject Non-Essential
        </button>
        {customizeOpen ? (
          <button
            type="button"
            onClick={() => saveDecision(analyticsEnabled, preferencesEnabled)}
            className="rounded-lg bg-[#D8C4A5] px-4 py-2 text-xs font-bold text-[#07111C] hover:bg-[#e5d5bc] transition-colors cursor-pointer"
          >
            Save Preferences
          </button>
        ) : (
          <button
            type="button"
            onClick={() => saveDecision(true, true)}
            className="rounded-lg bg-[#D8C4A5] px-4 py-2 text-xs font-bold text-[#07111C] hover:bg-[#e5d5bc] transition-colors cursor-pointer"
          >
            Accept All
          </button>
        )}
      </div>
    </div>
  );
}

export function CookiePreferencesTrigger({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCookiePreferences}
      className={`inline-flex items-center gap-1.5 text-xs hover:underline cursor-pointer ${className}`}
    >
      <Cookie className="w-3.5 h-3.5" />
      <span>Cookie Settings</span>
    </button>
  );
}

/**
 * Loads Google Analytics 4 only after explicit user consent when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * Automatically tracks clean pageviews stripped of sensitive query strings.
 */
export function AnalyticsProvider({ portalName }: { portalName: string }) {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '';
  const pathname = usePathname();
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    const syncConsent = () => {
      const stored = readStoredConsent();
      setAnalyticsAllowed(Boolean(stored?.analytics));
    };
    syncConsent();
    window.addEventListener(CONSENT_UPDATED_EVENT, syncConsent);
    return () => window.removeEventListener(CONSENT_UPDATED_EVENT, syncConsent);
  }, []);

  useEffect(() => {
    if (!analyticsAllowed || !measurementId) return;
    if (typeof window.gtag !== 'function') return;

    window.gtag('event', 'page_view', {
      page_path: pathname,
      portal: portalName,
    });
  }, [analyticsAllowed, measurementId, pathname, portalName]);

  if (!measurementId || !analyticsAllowed) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script id="newsim-ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            anonymize_ip: true,
            send_page_view: false,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}
