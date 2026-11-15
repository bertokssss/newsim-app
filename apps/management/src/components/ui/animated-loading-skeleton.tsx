'use client';

import React from 'react';

export interface AnimatedLoadingSkeletonProps {
  numCards?: number;
  images?: string[];
  className?: string;
}

export const AnimatedLoadingSkeleton: React.FC<AnimatedLoadingSkeletonProps> = ({
  numCards = 6,
  className = '',
}) => {
  return (
    <div
      className={`w-full max-w-6xl mx-auto p-6 bg-white dark:bg-[#0c1a2c] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 animate-pulse ${className}`}
    >
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-2.5">
          <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
          <div className="h-7 w-64 sm:w-80 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-3.5 w-48 sm:w-96 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-9 w-28 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
        </div>
      </div>

      {/* Grid of pure CSS skeleton cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: numCards }).map((_, i) => (
          <div
            key={i}
            className="bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800 space-y-3"
          >
            <div className="h-28 rounded-xl bg-slate-200/80 dark:bg-slate-800 w-full" />
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-md" />
            <div className="h-3 w-1/2 bg-slate-200/70 dark:bg-slate-800 rounded-md" />
            <div className="pt-2 flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/80">
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnimatedLoadingSkeleton;
