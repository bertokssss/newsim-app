export interface HttpsCheckResult {
  shouldRedirect: boolean;
  redirectUrl: string;
  isHttps: boolean;
  isLocal: boolean;
}

const PRIVATE_IPV4_REGEX =
  /^(?:10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/;

/**
 * Extracts the bare lowercase hostname from a Host / X-Forwarded-Host header value.
 */
export function extractHostname(hostHeader: string | null | undefined): string {
  if (!hostHeader) return '';
  const first = hostHeader.split(',')[0]?.trim().toLowerCase() ?? '';
  if (!first) return '';
  if (first.startsWith('[')) {
    const endBracket = first.indexOf(']');
    return endBracket !== -1 ? first.slice(1, endBracket) : first;
  }
  const colonIndex = first.indexOf(':');
  return colonIndex !== -1 ? first.slice(0, colonIndex) : first;
}

/**
 * Returns true when the request targets localhost, loopback, or a local dev host.
 */
export function isLocalHost(hostHeader: string | null | undefined): boolean {
  const host = extractHostname(hostHeader);
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.lan')
  ) {
    return true;
  }
  return PRIVATE_IPV4_REGEX.test(host);
}

/**
 * Evaluates whether an incoming HTTP request in production must redirect to HTTPS
 * while keeping localhost and already-encrypted proxy requests free of redirect loops.
 */
export function evaluateHttpsRedirect(
  requestUrl: string,
  headers: Headers,
  isProduction = process.env.NODE_ENV === 'production'
): HttpsCheckResult {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(requestUrl);
  } catch {
    return { shouldRedirect: false, redirectUrl: requestUrl, isHttps: false, isLocal: true };
  }

  const hostHeader = headers.get('x-forwarded-host') || headers.get('host') || parsedUrl.host;
  const isLocal = isLocalHost(hostHeader);

  const forwardedProtoRaw = headers.get('x-forwarded-proto');
  const forwardedProto = forwardedProtoRaw
    ? forwardedProtoRaw.split(',')[0]?.trim().toLowerCase()
    : '';
  const forwardedSsl = headers.get('x-forwarded-ssl')?.trim().toLowerCase();

  const urlProto = parsedUrl.protocol.replace(':', '').toLowerCase();
  const isHttps =
    forwardedProto === 'https' ||
    forwardedSsl === 'on' ||
    (!forwardedProto && urlProto === 'https');

  if (!isProduction || isLocal || isHttps) {
    return {
      shouldRedirect: false,
      redirectUrl: requestUrl,
      isHttps,
      isLocal,
    };
  }

  const httpsUrl = new URL(parsedUrl.toString());
  httpsUrl.protocol = 'https:';
  if (hostHeader) {
    httpsUrl.host = hostHeader.split(',')[0].trim();
  }

  return {
    shouldRedirect: true,
    redirectUrl: httpsUrl.toString(),
    isHttps: false,
    isLocal: false,
  };
}

/**
 * Builds production-hardened HTTP security headers compatible with Vercel, Next.js 16,
 * Supabase, PayMongo, Google reCAPTCHA, and optional consent-gated GA4.
 */
export function buildSecurityHeaders(options: {
  isHttps: boolean;
  isProduction?: boolean;
  frameOptions?: 'SAMEORIGIN' | 'DENY';
}): Record<string, string> {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';
  const frameOptions = options.frameOptions ?? 'SAMEORIGIN';

  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self' https://checkout.paymongo.com https://accounts.google.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://recaptcha.net https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google.com/recaptcha/ https://recaptcha.net https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://api.paymongo.com",
    "frame-src 'self' https://www.google.com https://recaptcha.net https://checkout.paymongo.com https://*.supabase.co",
  ];

  if (isProduction && options.isHttps) {
    cspDirectives.push('upgrade-insecure-requests');
  }

  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': frameOptions,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
    'X-DNS-Prefetch-Control': 'off',
    'Content-Security-Policy': cspDirectives.join('; '),
  };

  if (isProduction && options.isHttps) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
}

export interface PortalCookieResolution {
  token?: string;
  cookieName?: string;
  role: string;
  isAuthorized: boolean;
  isInactive: boolean;
}

/**
 * Normalizes a role string for consistent comparison across middleware/proxy and auth helpers.
 */
export function normalizePortalRole(role?: string | null): string {
  return (role || '').toString().trim().toUpperCase().replace(/[-\s]+/g, '_');
}

/**
 * Decodes a JWT payload segment in Edge / Proxy runtimes without Node crypto.
 * Note: This is strictly for routing hints; cryptographic verification happens in API routes.
 */
export function decodeJwtPayloadUnsafe(token?: string): Record<string, any> | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr =
      typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('binary');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Returns true if the token's Remember Me inactivity window has elapsed.
 */
export function isJwtTokenInactive(token?: string, maxDays = 7): boolean {
  const payload = decodeJwtPayloadUnsafe(token);
  if (!payload || !payload.rememberMe) return false;
  const lastActive = Number(payload.lastActiveAt) || (payload.iat ? Number(payload.iat) * 1000 : 0);
  return Boolean(lastActive && Date.now() - lastActive > maxDays * 24 * 60 * 60 * 1000);
}

/**
 * Resolves a portal's active session cookie while isolating multi-portal localhost tabs
 * (where shared `session_token` and `user_role` cookies may belong to another portal).
 */
export function resolvePortalCookieSession(
  cookies: CookieStoreLike,
  preferredCookieNames: string[],
  allowedRoles: string[],
  maxInactivityDays = 7
): PortalCookieResolution {
  const normalizedAllowed = new Set(allowedRoles.map((r) => normalizePortalRole(r)));
  const sharedRole = normalizePortalRole(cookies.get('user_role')?.value);

  // Pass 1: Find a candidate cookie whose JWT payload role is authorized for this portal
  for (const name of preferredCookieNames) {
    const val = cookies.get(name)?.value;
    if (!val) continue;
    const payload = decodeJwtPayloadUnsafe(val);
    const tokenRole = normalizePortalRole(payload?.role);
    if (tokenRole && normalizedAllowed.has(tokenRole)) {
      return {
        token: val,
        cookieName: name,
        role: tokenRole,
        isAuthorized: true,
        isInactive: isJwtTokenInactive(val, maxInactivityDays),
      };
    }
  }

  // Pass 2: Fall back to the first present cookie (e.g. an unauthorized role attempting access)
  for (const name of preferredCookieNames) {
    const val = cookies.get(name)?.value;
    if (!val) continue;
    const payload = decodeJwtPayloadUnsafe(val);
    const tokenRole = normalizePortalRole(payload?.role) || sharedRole;
    return {
      token: val,
      cookieName: name,
      role: tokenRole,
      isAuthorized: Boolean(tokenRole && normalizedAllowed.has(tokenRole)),
      isInactive: isJwtTokenInactive(val, maxInactivityDays),
    };
  }

  return {
    token: undefined,
    cookieName: undefined,
    role: sharedRole,
    isAuthorized: false,
    isInactive: false,
  };
}
