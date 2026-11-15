import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
}
if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.');
}

/**
 * Network error codes (undici / Node) that indicate a transient connectivity problem.
 * CONNECT_PHASE codes mean the request never reached Supabase, so even non-idempotent
 * requests (POST) are safe to retry.
 */
const CONNECT_PHASE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const MAX_FETCH_RETRIES = 3;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

/**
 * fetch wrapper that retries transient network failures ("TypeError: fetch failed").
 * - Attaches a default 15s timeout signal when init?.signal is not provided.
 * - Retries only when the error is actually a transient network/connection error.
 */
export const resilientFetch: typeof fetch = async (input, init) => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      const requestInit: RequestInit = init?.signal
        ? init
        : { ...init, signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS) };
      return await fetch(input, requestInit);
    } catch (err: any) {
      lastError = err;
      if (err?.name === 'AbortError' || err?.name === 'TimeoutError' || init?.signal?.aborted) throw err;

      const code: string | undefined = err?.cause?.code || err?.code;
      const isTransientNetworkError =
        (code ? CONNECT_PHASE_CODES.has(code) : false) ||
        (err?.name === 'TypeError' && String(err?.message || '').toLowerCase().includes('fetch failed'));

      if (!isTransientNetworkError || attempt === MAX_FETCH_RETRIES) throw err;

      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  throw lastError;
};

/**
 * Public Supabase client (uses anon key).
 * Respects RLS policies. Use for client-side operations.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: resilientFetch },
});

/**
 * Admin Supabase client (uses service role key).
 * Bypasses RLS. Use ONLY in server-side API routes.
 */
const createAdminClient = () => {
  if (typeof window !== 'undefined') {
    return {} as any; // Do not initialize on client
  }
  if (!supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { fetch: resilientFetch },
  });
};

export const supabaseAdmin = createAdminClient();
