const DEV_FALLBACK_SECRET = 'dev-only-newsim-local-jwt-secret-not-for-prod';

/**
 * Resolves the HMAC JWT signing secret from environment variables at runtime.
 * Never embeds a real production secret fallback in source control.
 */
export function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEV_FALLBACK_SECRET;
  }

  // Allow Next.js static build analysis phase to evaluate modules safely if route isn't invoked at runtime.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return DEV_FALLBACK_SECRET;
  }

  throw new Error('Server configuration error: JWT_SECRET environment variable must be set in production.');
}
