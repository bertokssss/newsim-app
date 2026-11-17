import {
  deriveSiblingPortalOrigin,
  isLocalOriginOrHost,
  type PortalAppKey,
} from '@newsim/utils';

const RECENT_SUBMISSIONS = new Map<string, number>();

/**
 * Strips control characters, HTML angle brackets, and excess length from user inputs.
 */
export function sanitizeText(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeEmail(value: unknown): string {
  return sanitizeText(value, 254).toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email);
}

/**
 * Validates MARINA / NEWSIM Seafarer Registration Number (SRN) or certificate reference codes.
 */
export function isValidSrn(srn: string): boolean {
  const cleaned = srn.trim();
  return /^[A-Za-z0-9-]{4,32}$/.test(cleaned);
}

export function isValidMobile(mobile: string): boolean {
  const cleaned = mobile.trim();
  const digits = cleaned.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 && /^[+\d\s()-]{7,24}$/.test(cleaned);
}

/**
 * Detects automated bots that populate hidden non-autofilled honeypot fields.
 */
export function isHoneypotTriggered(body: Record<string, unknown> | null | undefined): boolean {
  if (!body || typeof body !== 'object') return false;
  const fields = ['_hp_website', 'hp_fax', 'company_url_trap'];
  return fields.some((field) => {
    const val = body[field];
    return typeof val === 'string' && val.trim().length > 0;
  });
}

/**
 * Prevents accidental or scripted duplicate rapid submissions with identical payload keys.
 * Returns true if the submission is allowed (first within ttlMs), false if duplicate.
 */
export function acquireSubmissionLock(key: string, ttlMs = 3000): boolean {
  const now = Date.now();
  if (RECENT_SUBMISSIONS.size > 5000) {
    for (const [k, expiresAt] of RECENT_SUBMISSIONS.entries()) {
      if (expiresAt <= now) RECENT_SUBMISSIONS.delete(k);
    }
  }
  const existing = RECENT_SUBMISSIONS.get(key);
  if (existing && existing > now) {
    return false;
  }
  RECENT_SUBMISSIONS.set(key, now + ttlMs);
  return true;
}

/**
 * Sanitizes a user search string for safe interpolation inside PostgREST `.or()` filters
 * by removing syntax metacharacters that can inject extra filter clauses.
 */
export function escapePostgrestFilter(value: unknown, maxLength = 120): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\(),."*'%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Escapes `%`, `_`, and `\` before passing an untrusted string to `.ilike()`.
 */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Validates that a candidate external URL only uses safe http(s) protocols or relative paths.
 */
export function sanitizeMaterialUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) {
    return trimmed.startsWith('//') ? '' : trimmed;
  }
  if (trimmed.startsWith('storage://')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

/**
 * Resolves a trusted application base URL for email/OAuth/payment callbacks,
 * rejecting untrusted Host / Origin header poisoning.
 */
export function resolveSafeAppOrigin(
  req: { headers: { get(name: string): string | null }; url?: string },
  fallbackLocalUrl: string
): string {
  const originHeader = req.headers.get('origin');
  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostHeader = forwardedHost || req.headers.get('host');
  const protoHeader =
    req.headers.get('x-forwarded-proto') ||
    (hostHeader?.includes('localhost') || hostHeader?.includes('127.0.0.1') ? 'http' : 'https');

  const isHostedDeployment =
    process.env.VERCEL === '1' ||
    (Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== 'development') ||
    Boolean(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    (hostHeader !== null && hostHeader !== '' && !isLocalOriginOrHost(hostHeader));

  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        continue;
      }
      if (isHostedDeployment && isLocalOriginOrHost(parsed.hostname)) {
        continue;
      }
      return parsed.origin;
    } catch {
      // ignore invalid env value
    }
  }

  const extraAllowedHosts = (process.env.ALLOWED_APP_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  const rawCandidate = originHeader || (hostHeader ? `${protoHeader}://${hostHeader}` : fallbackLocalUrl);
  try {
    const parsed = new URL(rawCandidate);
    const hostname = parsed.hostname.toLowerCase();
    const isAllowedLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const isAllowedVercel = hostname.endsWith('.vercel.app') && !hostname.includes('..');
    const isAllowedConfigured = extraAllowedHosts.includes(hostname);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && (isAllowedLocal || isAllowedVercel || isAllowedConfigured)) {
      return parsed.origin;
    }
  } catch {
    // ignore malformed header
  }

  return fallbackLocalUrl;
}

/**
 * Resolves a sibling NEWSIM portal origin from the current request/host context
 * so hosted deployments never fall back to `localhost` when redirecting across portals.
 */
export function resolveSiblingPortalOrigin(
  req: { headers: { get(name: string): string | null }; url?: string },
  portal: PortalAppKey,
  options?: {
    fallbackCurrentOrigin?: string;
    configuredUrl?: string;
    portOverride?: string;
  }
): string {
  const fallbackOrigin = options?.fallbackCurrentOrigin || 'http://localhost:3000';
  const currentOrigin = resolveSafeAppOrigin(req, fallbackOrigin);
  const envConfiguredUrl =
    options?.configuredUrl ??
    (portal === 'trainee'
      ? process.env.NEXT_PUBLIC_TRAINEE_URL
      : portal === 'instructor'
        ? process.env.NEXT_PUBLIC_INSTRUCTOR_URL
        : process.env.NEXT_PUBLIC_MANAGEMENT_URL);
  const envPortOverride =
    options?.portOverride ??
    (portal === 'trainee'
      ? process.env.NEXT_PUBLIC_TRAINEE_PORT
      : portal === 'instructor'
        ? process.env.NEXT_PUBLIC_INSTRUCTOR_PORT
        : process.env.NEXT_PUBLIC_MANAGEMENT_PORT);

  return deriveSiblingPortalOrigin(currentOrigin, portal, {
    configuredUrl: envConfiguredUrl,
    portOverride: envPortOverride,
  });
}
