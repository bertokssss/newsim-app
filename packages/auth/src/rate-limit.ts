import { NextRequest, NextResponse } from 'next/server';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_STORE = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 10000;

function cleanupExpiredBuckets(now: number) {
  if (RATE_LIMIT_STORE.size < MAX_BUCKETS) return;
  for (const [key, bucket] of RATE_LIMIT_STORE.entries()) {
    if (bucket.resetAt <= now) {
      RATE_LIMIT_STORE.delete(key);
    }
  }
  if (RATE_LIMIT_STORE.size >= MAX_BUCKETS) {
    RATE_LIMIT_STORE.clear();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Extracts best-effort client IP address behind Vercel / reverse proxies.
 */
export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return '127.0.0.1';
}

/**
 * Checks and increments an in-memory fixed-window rate limiter keyed by endpoint + identifier/IP.
 */
export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const existing = RATE_LIMIT_STORE.get(key);
  if (!existing || existing.resetAt <= now) {
    RATE_LIMIT_STORE.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return {
      allowed: true,
      limit: options.limit,
      remaining: Math.max(0, options.limit - 1),
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  existing.count += 1;
  RATE_LIMIT_STORE.set(key, existing);

  const remaining = Math.max(0, options.limit - existing.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    allowed: existing.count <= options.limit,
    limit: options.limit,
    remaining,
    retryAfterSeconds,
  };
}

export function createRateLimitResponse(
  retryAfterSeconds: number,
  message = 'Too many requests detected. Please wait before trying again.'
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
