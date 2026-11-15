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

export function getWindowGrecaptcha(): NewsimGrecaptcha | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { grecaptcha?: NewsimGrecaptcha }).grecaptcha;
}

let recaptchaScriptPromise: Promise<void> | null = null;
let lastRecaptchaError: string | null = null;

export function getLastRecaptchaError(): string | null {
  return lastRecaptchaError;
}

export function getRecaptchaV2SiteKey(): string {
  return process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY?.trim() || '';
}

export function getRecaptchaV3SiteKey(): string {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || '';
}

export function isRecaptchaConfigured(): boolean {
  return Boolean(getRecaptchaV2SiteKey() || getRecaptchaV3SiteKey());
}

export function loadRecaptchaScript(mode: 'v2' | 'v3', siteKey?: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  lastRecaptchaError = null;

  const gc = getWindowGrecaptcha();
  if (gc && typeof gc.ready === 'function') {
    return new Promise((resolve) => gc.ready(() => resolve()));
  }

  if (recaptchaScriptPromise) return recaptchaScriptPromise;

  recaptchaScriptPromise = new Promise((resolve) => {
    const finishReady = (onDone: () => void) => {
      const timeout = window.setTimeout(() => {
        if (!getWindowGrecaptcha()?.execute && mode === 'v3') {
          lastRecaptchaError =
            'Google reCAPTCHA timed out while initializing. Please refresh or contact support if the site key is invalid.';
          recaptchaScriptPromise = null;
        }
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

    const existing = document.getElementById('google-recaptcha-script');
    if (existing) {
      const existingGc = getWindowGrecaptcha();
      if (existingGc?.ready) {
        existingGc.ready(() => resolve());
      } else {
        existing.addEventListener('load', () => finishReady(resolve), { once: true });
        existing.addEventListener(
          'error',
          () => {
            lastRecaptchaError =
              'Google reCAPTCHA could not load. Please check your connection, disable script blockers, or verify the site key.';
            recaptchaScriptPromise = null;
            resolve();
          },
          { once: true }
        );
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-recaptcha-script';
    const key = (siteKey || getRecaptchaV3SiteKey() || getRecaptchaV2SiteKey()).trim();
    if (!key) {
      lastRecaptchaError = 'Google reCAPTCHA site key is not configured.';
      recaptchaScriptPromise = null;
      resolve();
      return;
    }
    script.src =
      mode === 'v2'
        ? 'https://www.google.com/recaptcha/api.js?render=explicit'
        : `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
    script.async = true;
    script.defer = true;

    script.onload = () => finishReady(resolve);

    script.onerror = () => {
      console.warn('Notice: Google reCAPTCHA script could not be loaded.');
      lastRecaptchaError =
        'Google reCAPTCHA could not load (blocked by browser or invalid site key). Please refresh, disable ad/script blockers, or contact the administrator.';
      recaptchaScriptPromise = null;
      resolve();
    };

    document.head.appendChild(script);
  });

  return recaptchaScriptPromise;
}

/**
 * Resolves a reCAPTCHA token for form submission.
 * Supports explicit v2 checkbox token if passed, otherwise executes invisible v3 challenge.
 */
export async function executeRecaptchaChallenge(
  action = 'submit',
  v2Token?: string | null
): Promise<string | null> {
  lastRecaptchaError = null;
  const v2Key = getRecaptchaV2SiteKey();
  if (v2Key) {
    return v2Token?.trim() || null;
  }

  const v3Key = getRecaptchaV3SiteKey();
  if (typeof window === 'undefined') return null;

  if (v3Key) {
    try {
      await loadRecaptchaScript('v3', v3Key);
      const gc = getWindowGrecaptcha();
      if (gc && typeof gc.execute === 'function') {
        const token = await gc.execute(v3Key, { action });
        if (token) return token;
      }
      if (!lastRecaptchaError) {
        lastRecaptchaError =
          'Google reCAPTCHA challenge returned an empty response. Please refresh the page and try again.';
      }
    } catch (err) {
      console.warn('reCAPTCHA execution notice:', err);
      lastRecaptchaError =
        'Google reCAPTCHA rejected the challenge (the site key or domain allowlist may need updating).';
    }
  } else {
    lastRecaptchaError = 'Security verification (reCAPTCHA) is not configured.';
  }

  if (process.env.NODE_ENV === 'development') {
    lastRecaptchaError = null;
    return 'dev-mock-recaptcha-token';
  }

  return null;
}
