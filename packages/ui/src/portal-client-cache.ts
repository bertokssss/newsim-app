'use client';

type AuthCacheEntry = {
  data: any;
  expiresAt: number;
};

const AUTH_TTL_MS = 60_000;
const authCache = new Map<string, AuthCacheEntry>();
const authInFlight = new Map<string, Promise<any>>();
let invalidationListenersBound = false;

export const NEWSIM_NOTIFICATIONS_SYNC_EVENT = 'newsim:notifications-synced';

export interface NotificationsSyncedDetail {
  endpoint: string;
  notifications: any[];
  unreadCount: number;
}

export function invalidateAuthMeCache(): void {
  authCache.clear();
}

function bindInvalidationListeners() {
  if (invalidationListenersBound || typeof window === 'undefined') return;
  invalidationListenersBound = true;
  window.addEventListener('profile-updated', invalidateAuthMeCache);
  window.addEventListener('newsim:permissions-updated', invalidateAuthMeCache);
}

/**
 * Single-flight deduplicated + short-TTL cached fetcher for `/api/auth/me`.
 * Prevents LayoutShell, Header, and Sidebar from firing duplicate requests on mount/focus.
 */
export async function fetchCachedAuthMe(
  url = '/api/auth/me',
  options?: { force?: boolean; ttlMs?: number }
): Promise<any | null> {
  bindInvalidationListeners();

  const ttlMs = options?.ttlMs ?? AUTH_TTL_MS;
  const now = Date.now();

  if (!options?.force) {
    const cached = authCache.get(url);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    const pending = authInFlight.get(url);
    if (pending) {
      return pending;
    }
  }

  const req = fetch(url, { cache: 'no-store' })
    .then(async (res) => {
      const json = await res.json();
      if (res.ok && json?.success && json?.user) {
        authCache.set(url, { data: json, expiresAt: Date.now() + ttlMs });
      }
      return json;
    })
    .catch(() => null)
    .finally(() => {
      authInFlight.delete(url);
    });

  authInFlight.set(url, req);
  return req;
}

export function emitNotificationsSynced(detail: NotificationsSyncedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<NotificationsSyncedDetail>(NEWSIM_NOTIFICATIONS_SYNC_EVENT, { detail }));
}
