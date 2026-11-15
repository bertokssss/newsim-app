'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { emitNotificationsSynced } from './portal-client-cache';

/**
 * NotificationToaster
 * Polls the portal's notifications endpoint and shows a pop-up toast with a
 * chime sound whenever a NEW unread notification arrives.
 *
 * Endpoint must return: { success: boolean, data: Array<{ id, title, message, link?, priority?, isRead, createdAt }> }
 */

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  link?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  isRead?: boolean;
  createdAt?: string;
}

interface NotificationToasterProps {
  /** e.g. '/api/admin/notifications' */
  endpoint: string;
  /** Polling interval in ms (default 10s) */
  intervalMs?: number;
  /** Auto-dismiss duration in ms (default 7s) */
  durationMs?: number;
  /** Max simultaneous pop-ups (default 4) */
  maxVisible?: number;
  /** Fired with the latest unread count after each poll */
  onUnreadCountChange?: (count: number) => void;
}

const SEEN_KEY_PREFIX = 'newsim_seen_notifs:';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

/** Two-tone chime generated with Web Audio (no audio file required). */
function playChime(priority?: string) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const tones = priority === 'HIGH' ? [880, 1174.66, 880] : [880, 1318.51];
  const now = ctx.currentTime;

  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.16;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

function loadSeen(endpoint: string): Set<string> | null {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY_PREFIX + endpoint);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveSeen(endpoint: string, seen: Set<string>) {
  try {
    // keep the most recent 300 IDs only
    const arr = Array.from(seen).slice(-300);
    sessionStorage.setItem(SEEN_KEY_PREFIX + endpoint, JSON.stringify(arr));
  } catch {}
}

export function NotificationToaster({
  endpoint,
  intervalMs = 30000,
  durationMs = 7000,
  maxVisible = 4,
  onUnreadCountChange,
}: NotificationToasterProps) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const seenRef = useRef<Set<string> | null>(null);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const onCountRef = useRef(onUnreadCountChange);
  useEffect(() => {
    onCountRef.current = onUnreadCountChange;
  }, [onUnreadCountChange]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  // Unlock audio on first user interaction (browser autoplay policy)
  useEffect(() => {
    const unlock = () => {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.success || !Array.isArray(json.data) || cancelled) return;

        const list: ToastNotification[] = json.data;
        const unread = list.filter((n) => !n.isRead);
        const computedUnreadCount = typeof json.unreadCount === 'number' ? json.unreadCount : unread.length;
        onCountRef.current?.(computedUnreadCount);
        emitNotificationsSynced({
          endpoint,
          notifications: list,
          unreadCount: computedUnreadCount,
        });

        // First load: remember what already exists so we only pop up NEW ones
        if (!seenRef.current) {
          const stored = loadSeen(endpoint);
          if (stored) {
            seenRef.current = stored;
          } else {
            seenRef.current = new Set(list.map((n) => n.id));
            saveSeen(endpoint, seenRef.current);
            return;
          }
        }

        const fresh = unread.filter((n) => n.id && !seenRef.current!.has(n.id));
        if (fresh.length === 0) return;

        fresh.forEach((n) => seenRef.current!.add(n.id));
        saveSeen(endpoint, seenRef.current);

        const highest = fresh.some((n) => n.priority === 'HIGH') ? 'HIGH' : 'MEDIUM';
        playChime(highest);

        setToasts((prev) => [...fresh.slice(0, maxVisible), ...prev].slice(0, maxVisible));
        fresh.slice(0, maxVisible).forEach((n) => {
          timersRef.current[n.id] = setTimeout(() => dismiss(n.id), durationMs);
        });
      } catch {
        // network errors are ignored silently
      }
    };

    poll();
    const interval = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [endpoint, intervalMs, durationMs, maxVisible, dismiss]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const handleOpen = async (n: ToastNotification) => {
    dismiss(n.id);
    try {
      await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_READ', id: n.id, notificationId: n.id }),
      });
    } catch {}
    if (n.link) window.location.assign(n.link);
  };

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-[calc(100vw-2rem)] max-w-sm pointer-events-none print:hidden"
    >
      {toasts.map((n) => {
        const accent =
          n.priority === 'HIGH'
            ? 'border-l-rose-500'
            : n.priority === 'LOW'
            ? 'border-l-slate-400'
            : 'border-l-sky-500';
        return (
          <div
            key={n.id}
            role="status"
            className={`pointer-events-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 border-l-4 ${accent} bg-white dark:bg-[#0c1a2c] shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-right-8 fade-in duration-300`}
          >
            <span className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </span>
            <button
              type="button"
              onClick={() => handleOpen(n)}
              className="flex-1 min-w-0 text-left cursor-pointer"
            >
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{n.title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-3">{n.message}</p>
              <p className="text-[10px] text-slate-400 mt-1">Just now · Click to view</p>
            </button>
            <button
              type="button"
              onClick={() => dismiss(n.id)}
              aria-label="Dismiss notification"
              className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default NotificationToaster;
