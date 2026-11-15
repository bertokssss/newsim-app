'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

export interface ImmersiveChartFrameProps {
  /** Recharts or SVG chart node rendered only once `ready` and viewport visibility are met. */
  children: React.ReactNode;
  /** True once dashboard/page data has finished loading and is safe to reveal. */
  ready?: boolean;
  /** Optional key (e.g. chart mode/tab) whose changes smoothly replay the left-to-right sweep. */
  triggerKey?: string | number;
  /** Duration of the left-to-right sweep in seconds. Defaults to 1.9s for a calm, deliberate sweep. */
  duration?: number;
  /** Outer wrapper className (should define the container height, e.g. `h-72 w-full`). */
  className?: string;
  /** Fraction of the chart container required inside the viewport before sweeping in. */
  viewportAmount?: number;
  /** Optional accessible label shown in the pre-reveal placeholder. */
  placeholder?: React.ReactNode;
}

/**
 * Viewport- and data-gated wrapper that reveals charts with a smooth, deliberate
 * left-to-right sweep strictly after loading completes and the chart scrolls into view.
 */
export function ImmersiveChartFrame({
  children,
  ready = true,
  triggerKey,
  duration = 1.9,
  className = 'w-full h-full relative',
  viewportAmount = 0.2,
  placeholder,
}: ImmersiveChartFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const isInView = useInView(containerRef, { once: true, amount: viewportAmount });
  const [hasEnteredView, setHasEnteredView] = useState(false);
  const [sweepDone, setSweepDone] = useState(false);

  useEffect(() => {
    if (isInView) {
      setHasEnteredView(true);
    }
  }, [isInView]);

  const shouldRenderChart = ready && (isInView || hasEnteredView);
  const effectiveKey = `${String(triggerKey ?? 'default')}`;

  useEffect(() => {
    setSweepDone(false);
  }, [effectiveKey, shouldRenderChart]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {!shouldRenderChart ? (
        placeholder ?? (
          <div
            aria-hidden="true"
            className="w-full h-full rounded-2xl bg-slate-100/50 dark:bg-slate-800/30 animate-pulse border border-slate-200/40 dark:border-slate-700/30"
          />
        )
      ) : prefersReducedMotion ? (
        <div key={effectiveKey} className="w-full h-full">
          {children}
        </div>
      ) : (
        <motion.div
          key={effectiveKey}
          initial={{ clipPath: 'inset(-12px 100% -12px -12px)', opacity: 0.72 }}
          animate={{ clipPath: 'inset(-12px 0% -12px -12px)', opacity: 1 }}
          transition={{
            clipPath: { duration, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: Math.min(0.65, duration * 0.4), ease: 'easeOut' },
          }}
          onAnimationComplete={() => setSweepDone(true)}
          className="relative w-full h-full"
        >
          {children}

          {!sweepDone && (
            <motion.div
              aria-hidden="true"
              initial={{ left: '0%', opacity: 0.85 }}
              animate={{ left: '100%', opacity: 0 }}
              transition={{
                left: { duration, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: duration * 0.95, ease: 'easeIn' },
              }}
              className="pointer-events-none absolute top-0 bottom-0 w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-sky-400/20 to-transparent"
            />
          )}
        </motion.div>
      )}
    </div>
  );
}
