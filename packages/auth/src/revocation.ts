import { supabaseAdmin } from '@newsim/database';

/**
 * Cross-portal session revocation store.
 *
 * Each portal (management / instructor / trainee) runs in its own Next.js
 * process, so the in-memory session manager in `@newsim/database` cannot
 * propagate a revocation from the Super Admin portal to the other apps.
 *
 * Revocations are therefore persisted in Supabase `audit_logs` (action
 * `SUPER_ADMIN_REVOKED_SESSION`) and mirrored into a per-process cache that is
 * refreshed in the background. Any session token issued *before* the
 * revocation timestamp of its user is rejected by `verifySessionToken`.
 */

export const SESSION_REVOCATION_ACTION = 'SUPER_ADMIN_REVOKED_SESSION';

/** Session tokens live for 8h — keep a little slack when looking back. */
const LOOKBACK_MS = 9 * 3600 * 1000;
/** How often each portal process re-syncs revocations from Supabase. */
const SYNC_TTL_MS = 60_000;
const REFRESH_INTERVAL_MS = SYNC_TTL_MS;

interface RevocationStore {
  revokedAtByUser: Map<string, number>;
  lastLoadedAt: number;
  lastSyncMs: number;
  loading: Promise<void> | null;
  timer: ReturnType<typeof setInterval> | null;
}

// Keep a single store per process (survives dev hot-reloads).
const globalRef = globalThis as typeof globalThis & { __newsimRevocationStore?: RevocationStore };
const store: RevocationStore =
  globalRef.__newsimRevocationStore ||
  (globalRef.__newsimRevocationStore = {
    revokedAtByUser: new Map(),
    lastLoadedAt: 0,
    lastSyncMs: 0,
    loading: null,
    timer: null,
  });

/**
 * Record (locally) that every session of `userId` issued at or before `revokedAtMs` is revoked.
 */
export function markUserSessionsRevoked(userId: string, revokedAtMs: number = Date.now()): void {
  if (!userId) return;
  const previous = store.revokedAtByUser.get(userId) || 0;
  if (revokedAtMs > previous) {
    store.revokedAtByUser.set(userId, revokedAtMs);
  }
}

/**
 * Extract `{ userId, revokedAtMs }` from a `SUPER_ADMIN_REVOKED_SESSION` audit log row.
 */
export function parseRevocationLog(row: any): { userId: string; revokedAtMs: number } | null {
  if (!row) return null;
  const values = row.new_values || {};
  const entityId: string = row.entity_id || '';
  const userId: string | null =
    values.targetUserId || values.userId || (entityId.startsWith('sess-') ? entityId.slice(5) : entityId || null);
  const revokedAtMs = Date.parse(values.revokedAt || row.created_at || '');
  if (!userId || Number.isNaN(revokedAtMs)) return null;
  return { userId, revokedAtMs };
}

/**
 * Pull recent revocations from Supabase into the local cache.
 * Throttled to once per refresh interval unless `force` is set.
 */
export async function refreshSessionRevocations(force = false): Promise<void> {
  const now = Date.now();
  const lastSync = store.lastSyncMs || store.lastLoadedAt || 0;
  if (!force && lastSync > 0 && now - lastSync < SYNC_TTL_MS) return;

  const startSync = () => {
    if (store.loading) return store.loading;
    store.loading = (async () => {
      try {
        const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
        const { data, error } = await supabaseAdmin
          .from('audit_logs')
          .select('entity_id, created_at, new_values')
          .eq('action', SESSION_REVOCATION_ACTION)
          .gte('created_at', since);

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const parsed = parseRevocationLog(row);
            if (parsed) markUserSessionsRevoked(parsed.userId, parsed.revokedAtMs);
          }
          const completedAt = Date.now();
          store.lastLoadedAt = completedAt;
          store.lastSyncMs = completedAt;
        }
      } catch (err) {
        console.error('[auth] Failed to sync session revocations:', err);
      } finally {
        store.loading = null;
      }
    })();
    return store.loading;
  };

  // If already synced at least once and not forced, refresh asynchronously without blocking request paths.
  if (!force && lastSync > 0) {
    void startSync();
    return;
  }

  return startSync();
}

function ensureRevocationPoller(): void {
  if (store.timer) return;
  void refreshSessionRevocations(true);
  store.timer = setInterval(() => {
    void refreshSessionRevocations(true);
  }, REFRESH_INTERVAL_MS);
  // Never keep the Node.js process alive just for this poller.
  (store.timer as any)?.unref?.();
}

/**
 * Returns true when a token for `userId` issued at `issuedAtSec` (JWT `iat`, seconds)
 * has been revoked by a Super Admin.
 */
export function isUserTokenRevoked(userId: string | undefined, issuedAtSec?: number): boolean {
  ensureRevocationPoller();
  if (!userId) return false;
  const revokedAt = store.revokedAtByUser.get(userId);
  if (!revokedAt) return false;
  if (!issuedAtSec) return true;
  return issuedAtSec * 1000 <= revokedAt;
}
