'use client';

import React, { useEffect, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getRecaptchaV2SiteKey, getWindowGrecaptcha, loadRecaptchaScript } from './recaptcha-client';

export interface RecaptchaControlProps {
  onTokenChange?: (token: string | null) => void;
  theme?: 'light' | 'dark';
  className?: string;
}

/**
 * Renders Google reCAPTCHA v2 checkbox widget when NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY
 * is configured, or a compact bot-protection notice when invisible reCAPTCHA v3 is active.
 */
export function RecaptchaControl({
  onTokenChange,
  theme = 'light',
  className = '',
}: RecaptchaControlProps) {
  const v2SiteKey = getRecaptchaV2SiteKey();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!v2SiteKey || !containerRef.current) return;
    let active = true;

    loadRecaptchaScript('v2', v2SiteKey).then(() => {
      const gc = getWindowGrecaptcha();
      if (!active || !containerRef.current || !gc?.render) return;
      if (widgetIdRef.current !== null) return;

      widgetIdRef.current = gc.render(containerRef.current, {
        sitekey: v2SiteKey,
        theme,
        callback: (token: string) => onTokenChange?.(token),
        'expired-callback': () => onTokenChange?.(null),
        'error-callback': () => onTokenChange?.(null),
      });
    });

    return () => {
      active = false;
    };
  }, [v2SiteKey, theme, onTokenChange]);

  if (v2SiteKey) {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <div ref={containerRef} className="overflow-x-auto max-w-full" />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${
        theme === 'dark'
          ? 'border-white/10 bg-white/5 text-slate-300'
          : 'border-slate-200 bg-slate-50 text-slate-600'
      } ${className}`}
    >
      <ShieldCheck className="w-4 h-4 shrink-0 text-sky-500" />
      <span>Protected against automated abuse with Google reCAPTCHA &amp; rate limiting.</span>
    </div>
  );
}

/**
 * Hidden offscreen honeypot trap field to catch automated form-filling bots.
 */
export function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden opacity-0 pointer-events-none"
    >
      <label htmlFor="_hp_website">Website</label>
      <input
        id="_hp_website"
        name="_hp_website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
