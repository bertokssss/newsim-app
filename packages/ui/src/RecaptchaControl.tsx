'use client';

import React, { useEffect, useRef } from 'react';
import {
  getRecaptchaV2SiteKey,
  getWindowGrecaptcha,
  loadRecaptchaScript,
  resolveActiveRecaptchaV2SiteKey,
} from './recaptcha-client';

export interface RecaptchaControlProps {
  onTokenChange?: (token: string | null) => void;
  theme?: 'light' | 'dark';
  className?: string;
  resetSignal?: number;
}

/**
 * Renders the interactive Google reCAPTCHA v2 ("I'm not a robot") checkbox widget
 * for third-party (Google OAuth) registration.
 */
export function RecaptchaControl({
  onTokenChange,
  theme = 'light',
  className = '',
  resetSignal = 0,
}: RecaptchaControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  useEffect(() => {
    if (widgetIdRef.current === null || resetSignal === 0) return;
    const gc = getWindowGrecaptcha();
    if (gc && typeof gc.reset === 'function') {
      try {
        gc.reset(widgetIdRef.current);
      } catch {
        // ignore reset race
      }
      onTokenChangeRef.current?.(null);
    }
  }, [resetSignal]);

  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;

    (async () => {
      const siteKey = (await resolveActiveRecaptchaV2SiteKey()) || getRecaptchaV2SiteKey();
      if (!active || !siteKey) return;

      await loadRecaptchaScript('v2', siteKey);
      const gc = getWindowGrecaptcha();
      if (!active || !containerRef.current || !gc?.render) return;
      if (widgetIdRef.current !== null) return;

      containerRef.current.innerHTML = '';
      widgetIdRef.current = gc.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onTokenChangeRef.current?.(token),
        'expired-callback': () => onTokenChangeRef.current?.(null),
        'error-callback': () => onTokenChangeRef.current?.(null),
      });
    })();

    return () => {
      active = false;
    };
  }, [theme]);

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <div ref={containerRef} className="overflow-x-auto max-w-full min-h-[78px] flex items-center justify-center" />
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
