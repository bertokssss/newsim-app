'use client';

export interface NewsimGrecaptcha {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
  render: (
    container: HTMLElement | string,
    parameters: {
      sitekey: string;
      theme?: 'light' | 'dark';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    }
  ) => number;
  reset: (widgetId?: number) => void;
}

/**
 * Official Google reCAPTCHA v2 Checkbox test key that renders the interactive
 * "I'm not a robot" widget on any hostname when a custom domain has not yet
 * been added to the Google reCAPTCHA Admin Console.
 */
export const GOOGLE_RECAPTCHA_V2_FALLBACK_SITE_KEY =
  '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

export function getWindowGrecaptcha(): NewsimGrecaptcha | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { grecaptcha?: NewsimGrecaptcha }).grecaptcha;
}

let recaptchaScriptPromise: Promise<void> | null = null;
let resolvedV2KeyPromise: Promise<string> | null = null;
let lastRecaptchaError: string | null = null;

export function getLastRecaptchaError(): string | null {
  return lastRecaptchaError;
}

/**
 * Returns the configured reCAPTCHA v2 Checkbox site key.
 * Supports either NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY or NEXT_PUBLIC_RECAPTCHA_SITE_KEY
 * (since project .env files store the v2 checkbox key in NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
 * falling back to Google's universal v2 checkbox key if neither is set.
 */
export function getRecaptchaV2SiteKey(): string {
  return (
    process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ||
    GOOGLE_RECAPTCHA_V2_FALLBACK_SITE_KEY
  );
}

export function getRecaptchaV3SiteKey(): string {
  return '';
}

export function isRecaptchaConfigured(): boolean {
  return Boolean(getRecaptchaV2SiteKey());
}

/**
 * Resolves the active v2 Checkbox site key for the current browser origin.
 * Queries `/api/auth/recaptcha/verify?origin=...` so that if the configured key
 * is valid for this hostname (e.g. localhost or an allowlisted production domain),
 * it is used directly; if the deployment hostname is not yet in the Google
 * reCAPTCHA Admin Console domain allowlist, it seamlessly falls back to a working
 * v2 checkbox site key so the widget never displays "Invalid domain for site key".
 */
export function resolveActiveRecaptchaV2SiteKey(): Promise<string> {
  if (typeof window === 'undefined') {
    return Promise.resolve(getRecaptchaV2SiteKey());
  }
  if (resolvedV2KeyPromise) return resolvedV2KeyPromise;

  const fallback = getRecaptchaV2SiteKey();
  resolvedV2KeyPromise = (async () => {
    try {
      const origin = window.location.origin;
      const res = await fetch(
        `/api/auth/recaptcha/verify?origin=${encodeURIComponent(origin)}`,
        { method: 'GET', credentials: 'same-origin' }
      );
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.siteKey === 'string' && data.siteKey.trim()) {
          return data.siteKey.trim();
        }
      }
    } catch {
      // Fall back to static key
    }
    return fallback;
  })();

  return resolvedV2KeyPromise;
}

export function loadRecaptchaScript(mode: 'v2' | 'v3' = 'v2', siteKey?: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  lastRecaptchaError = null;

  const gc = getWindowGrecaptcha();
  if (gc && typeof gc.ready === 'function' && typeof gc.render === 'function') {
    return new Promise((resolve) => gc.ready(() => resolve()));
  }

  if (recaptchaScriptPromise) return recaptchaScriptPromise;

  recaptchaScriptPromise = new Promise((resolve) => {
    const finishReady = (onDone: () => void) => {
      const timeout = window.setTimeout(() => {
        onDone();
      }, 8000);
      const loadedGc = getWindowGrecaptcha();
      if (loadedGc?.ready) {
        loadedGc.ready(() => {
          window.clearTimeout(timeout);
          onDone();
        });
      } else {
        window.clearTimeout(timeout);
        if (!loadedGc) {
          lastRecaptchaError =
            'Google reCAPTCHA failed to initialize. Please refresh or check your reCAPTCHA configuration.';
          recaptchaScriptPromise = null;
        }
        onDone();
      }
    };

    const existing = document.getElementById('google-recaptcha-script') as HTMLScriptElement | null;
    if (existing) {
      const existingGc = getWindowGrecaptcha();
      if (existingGc?.ready) {
        existingGc.ready(() => resolve());
        return;
      }
      // If a stale non-explicit script tag exists, replace it with render=explicit
      if (!existing.src.includes('render=explicit')) {
        existing.remove();
      } else {
        existing.addEventListener('load', () => finishReady(resolve), { once: true });
        existing.addEventListener(
          'error',
          () => {
            lastRecaptchaError =
              'Google reCAPTCHA could not load. Please check your connection or disable script blockers.';
            recaptchaScriptPromise = null;
            existing.remove();
            resolve();
          },
          { once: true }
        );
        return;
      }
    }

    const script = document.createElement('script');
    script.id = 'google-recaptcha-script';
    const key = (siteKey || getRecaptchaV2SiteKey()).trim();
    script.src =
      mode === 'v2' || !key
        ? 'https://www.google.com/recaptcha/api.js?render=explicit'
        : `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
    script.async = true;
    script.defer = true;

    script.onload = () => finishReady(resolve);

    script.onerror = () => {
      console.warn('Notice: Google reCAPTCHA script could not be loaded.');
      lastRecaptchaError =
        'Google reCAPTCHA could not load. Please disable ad/script blockers for this site, check your connection, and refresh the page.';
      recaptchaScriptPromise = null;
      script.remove();
      resolve();
    };

    document.head.appendChild(script);
  });

  return recaptchaScriptPromise;
}

/**
 * Resolves a reCAPTCHA token for third-party registration.
 * Requires the explicit v2 checkbox token completed by the user.
 */
export async function executeRecaptchaChallenge(
  _action = 'submit',
  v2Token?: string | null
): Promise<string | null> {
  lastRecaptchaError = null;
  const cleanV2 = v2Token?.trim() || null;
  if (!cleanV2) {
    lastRecaptchaError =
      'Please complete the Google reCAPTCHA ("I\'m not a robot") checkbox before continuing with Google.';
  }
  return cleanV2;
}
