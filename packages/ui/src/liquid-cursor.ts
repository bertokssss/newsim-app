'use client';

import { useEffect, type RefObject } from 'react';

export interface LiquidBlobSeed {
  size: number;
  left: number;
  top: number;
  animationDelay: number;
  animationDuration: number;
}

interface SeededBlobOptions {
  minSize: number;
  sizeSpread: number;
  seedOffset?: number;
}

/**
 * Generates deterministic, SSR-safe blob geometry so hydration matches cleanly
 * without synchronous setState calls inside useEffect.
 */
export function createDeterministicBlobs(
  count: number,
  { minSize, sizeSpread, seedOffset = 0 }: SeededBlobOptions
): LiquidBlobSeed[] {
  const pseudo = (seed: number) => {
    const raw = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return raw - Math.floor(raw);
  };
  const round2 = (value: number) => Math.round(value * 100) / 100;

  return Array.from({ length: count }, (_, index) => {
    const base = index + seedOffset;
    const size = round2(minSize + pseudo(base * 3 + 1) * sizeSpread);
    const left = round2(10 + pseudo(base * 3 + 2) * 78);
    const top = round2(10 + pseudo(base * 3 + 3) * 78);
    const animationDelay = round2(pseudo(base * 3 + 4) * -20);
    const animationDuration = round2(15 + pseudo(base * 3 + 5) * 14);

    return { size, left, top, animationDelay, animationDuration };
  });
}

export interface UseLiquidCursorSyncOptions {
  stageRef: RefObject<HTMLDivElement | null>;
  trackRefs: RefObject<(HTMLDivElement | null)[]>;
  blobRefs: RefObject<(HTMLDivElement | null)[]>;
  parallaxStep?: number;
  enabled?: boolean;
}

/**
 * Smoothly shifts the existing liquid background blobs in sync with cursor movement
 * via GPU-composited translate3d transforms without layout thrashing.
 */
export function useLiquidCursorSync({
  stageRef,
  trackRefs,
  blobRefs,
  parallaxStep = 65,
  enabled = true,
}: UseLiquidCursorSyncOptions): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const motionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    if (motionQuery?.matches) {
      return;
    }

    let targetNormX = 0;
    let targetNormY = 0;
    let currentNormX = 0;
    let currentNormY = 0;
    let rafId: number | null = null;
    let lastTimestamp = performance.now();

    const applyTransforms = () => {
      trackRefs.current.forEach((track, index) => {
        if (!track) return;
        const depth = (index + 1) * parallaxStep;
        const dx = currentNormX * depth;
        const dy = currentNormY * depth;
        track.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
      });
    };

    const tick = (now: number) => {
      rafId = null;
      if (typeof document !== 'undefined' && document.hidden) return;

      const dt = Math.min(Math.max((now - lastTimestamp) / 1000, 0.001), 0.05);
      lastTimestamp = now;

      const ease = 1 - Math.exp(-9 * dt);
      currentNormX += (targetNormX - currentNormX) * ease;
      currentNormY += (targetNormY - currentNormY) * ease;

      applyTransforms();

      const settled =
        Math.abs(targetNormX - currentNormX) < 0.0004 &&
        Math.abs(targetNormY - currentNormY) < 0.0004;

      if (!settled) {
        rafId = requestAnimationFrame(tick);
      } else {
        currentNormX = targetNormX;
        currentNormY = targetNormY;
        applyTransforms();
      }
    };

    const scheduleFrame = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (rafId !== null) return;
      lastTimestamp = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const stage = stageRef.current;
      const rect = stage?.getBoundingClientRect();
      const width = rect && rect.width > 0 ? rect.width : window.innerWidth || 1;
      const height = rect && rect.height > 0 ? rect.height : window.innerHeight || 1;
      const offsetLeft = rect ? rect.left : 0;
      const offsetTop = rect ? rect.top : 0;

      targetNormX = (e.clientX - offsetLeft) / width - 0.5;
      targetNormY = (e.clientY - offsetTop) / height - 0.5;
      scheduleFrame();
    };

    const handlePointerLeave = () => {
      targetNormX = 0;
      targetNormY = 0;
      scheduleFrame();
    };

    const handleVisibilityChange = () => {
      const state = document.hidden ? 'paused' : 'running';
      blobRefs.current.forEach((blob) => {
        if (blob) blob.style.animationPlayState = state;
      });
      if (!document.hidden) {
        scheduleFrame();
      } else if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('blur', handlePointerLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('blur', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [blobRefs, enabled, parallaxStep, stageRef, trackRefs]);
}
