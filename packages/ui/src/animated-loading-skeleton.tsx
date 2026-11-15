'use client';

import React from 'react';

export interface AnimatedLoadingSkeletonProps {
  variant?: 'dashboard' | 'table' | 'cards' | 'detail' | 'form';
  numCards?: number;
  images?: string[];
  className?: string;
}

export interface SkeletonSectionProps {
  className?: string;
  showHeader?: boolean;
}

export interface CardGridSkeletonProps extends SkeletonSectionProps {
  numCards?: number;
}

export interface TablePageSkeletonProps extends SkeletonSectionProps {
  rows?: number;
  columns?: number;
}

/**
 * DashboardSkeleton
 * Hero banner skeleton + 4 KPI metric card skeletons + 2-column content/chart/schedule panel skeletons.
 */
export const DashboardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      className={`w-full space-y-6 sm:space-y-8 animate-pulse ${className}`}
    >
      {/* Hero Banner Skeleton */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-5 w-36 rounded-full bg-slate-200/80 dark:bg-slate-800/80" />
              <div className="h-5 w-28 rounded-full bg-slate-200/60 dark:bg-slate-800/60" />
            </div>
            <div className="h-8 sm:h-9 w-64 sm:w-80 rounded-xl bg-slate-200/90 dark:bg-slate-800/90" />
            <div className="h-4 w-full max-w-xl rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-10 w-36 rounded-2xl bg-sky-500/20 dark:bg-sky-500/20 border border-sky-500/20" />
            <div className="h-10 w-32 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80" />
          </div>
        </div>
      </div>

      {/* 4 KPI Metric Card Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2.5 flex-1">
                <div className="h-3.5 w-24 rounded bg-slate-200/80 dark:bg-slate-800/80" />
                <div className="h-8 w-16 rounded-lg bg-slate-200/90 dark:bg-slate-800/90" />
              </div>
              <div className="w-11 h-11 rounded-2xl bg-sky-500/15 dark:bg-sky-500/15 shrink-0" />
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-slate-200/70 dark:bg-slate-800/70" />
              <div className="h-3 w-16 rounded bg-slate-200/60 dark:bg-slate-800/60" />
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Content / Schedule / Telemetry Panels Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-2">
              <div className="h-5 w-48 rounded-lg bg-slate-200/90 dark:bg-slate-800/90" />
              <div className="h-3.5 w-64 rounded bg-slate-200/60 dark:bg-slate-800/60" />
            </div>
            <div className="h-4 w-20 rounded bg-slate-200/70 dark:bg-slate-800/70" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-48 rounded bg-slate-200/80 dark:bg-slate-800/80" />
                  <div className="h-3 w-32 rounded bg-slate-200/60 dark:bg-slate-800/60" />
                </div>
                <div className="h-6 w-20 rounded-full bg-slate-200/80 dark:bg-slate-800/80 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="h-5 w-36 rounded-lg bg-slate-200/90 dark:bg-slate-800/90" />
            <div className="h-4 w-14 rounded bg-slate-200/70 dark:bg-slate-800/70" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-24 rounded bg-slate-200/80 dark:bg-slate-800/80" />
                  <div className="h-3 w-12 rounded bg-slate-200/60 dark:bg-slate-800/60" />
                </div>
                <div className="h-4 w-40 rounded bg-slate-200/90 dark:bg-slate-800/90" />
                <div className="h-3 w-28 rounded bg-slate-200/60 dark:bg-slate-800/60" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * TablePageSkeleton
 * Page header skeleton + filter/search bar skeleton + table rows skeleton.
 */
export const TablePageSkeleton: React.FC<TablePageSkeletonProps> = ({
  rows = 6,
  columns = 6,
  showHeader = true,
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-label="Loading table data"
      className={`w-full space-y-6 animate-pulse ${className}`}
    >
      {showHeader && (
        <>
          {/* Page Header Skeleton */}
          <div className="rounded-3xl p-6 sm:p-8 bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="h-5 w-32 rounded-full bg-slate-200/80 dark:bg-slate-800/80" />
            <div className="h-8 w-64 sm:w-80 rounded-xl bg-slate-200/90 dark:bg-slate-800/90" />
            <div className="h-4 w-full max-w-xl rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
          </div>

          {/* Filter / Search Bar Skeleton */}
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="h-9 w-full sm:w-80 rounded-xl bg-slate-200/80 dark:bg-slate-800/80" />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="h-8 w-16 rounded-xl bg-sky-500/20 dark:bg-sky-500/20" />
              <div className="h-8 w-20 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
              <div className="h-8 w-20 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
            </div>
          </div>
        </>
      )}

      {/* Table Rows Skeleton */}
      <div className="rounded-3xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 grid grid-cols-6 gap-4">
          {Array.from({ length: columns }).map((_, idx) => (
            <div key={idx} className="h-3.5 rounded bg-slate-200/80 dark:bg-slate-800/80" />
          ))}
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {Array.from({ length: rows }).map((_, rIdx) => (
            <div key={rIdx} className="p-4 grid grid-cols-6 gap-4 items-center">
              <div className="space-y-1.5">
                <div className="h-4 w-3/4 rounded bg-slate-200/90 dark:bg-slate-800/90" />
                <div className="h-3 w-1/2 rounded bg-slate-200/60 dark:bg-slate-800/60" />
              </div>
              {Array.from({ length: Math.max(1, columns - 2) }).map((__, cIdx) => (
                <div key={cIdx} className="h-4 w-2/3 rounded bg-slate-200/75 dark:bg-slate-800/75" />
              ))}
              <div className="h-6 w-20 rounded-full bg-slate-200/80 dark:bg-slate-800/80 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * CardGridSkeleton
 * Page header skeleton + filter bar skeleton + responsive grid of card skeletons (numCards default 6).
 */
export const CardGridSkeleton: React.FC<CardGridSkeletonProps> = ({
  numCards = 6,
  showHeader = true,
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-label="Loading cards"
      className={`w-full space-y-6 animate-pulse ${className}`}
    >
      {showHeader && (
        <>
          {/* Page Header Skeleton */}
          <div className="rounded-3xl p-6 sm:p-8 bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="h-5 w-32 rounded-full bg-slate-200/80 dark:bg-slate-800/80" />
            <div className="h-8 w-64 sm:w-80 rounded-xl bg-slate-200/90 dark:bg-slate-800/90" />
            <div className="h-4 w-full max-w-xl rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
          </div>

          {/* Filter Bar Skeleton */}
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="h-9 w-full sm:w-80 rounded-xl bg-slate-200/80 dark:bg-slate-800/80" />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="h-8 w-16 rounded-xl bg-sky-500/20 dark:bg-sky-500/20" />
              <div className="h-8 w-20 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
              <div className="h-8 w-20 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
            </div>
          </div>
        </>
      )}

      {/* Responsive Card Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: numCards }).map((_, idx) => (
          <div
            key={idx}
            className="p-6 rounded-3xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-5 w-16 rounded-md bg-sky-500/15 dark:bg-sky-500/15" />
                <div className="h-5 w-20 rounded-full bg-slate-200/80 dark:bg-slate-800/80" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-4/5 rounded-lg bg-slate-200/90 dark:bg-slate-800/90" />
                <div className="h-3.5 w-full rounded bg-slate-200/70 dark:bg-slate-800/70" />
                <div className="h-3.5 w-2/3 rounded bg-slate-200/60 dark:bg-slate-800/60" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 space-y-1.5">
                  <div className="h-2.5 w-12 rounded bg-slate-200/60 dark:bg-slate-800/60" />
                  <div className="h-4 w-16 rounded bg-slate-200/80 dark:bg-slate-800/80" />
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 space-y-1.5">
                  <div className="h-2.5 w-12 rounded bg-slate-200/60 dark:bg-slate-800/60" />
                  <div className="h-4 w-16 rounded bg-slate-200/80 dark:bg-slate-800/80" />
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <div className="h-3.5 w-24 rounded bg-slate-200/70 dark:bg-slate-800/70" />
              <div className="h-8 w-28 rounded-xl bg-sky-500/20 dark:bg-sky-500/20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * DetailPageSkeleton
 * Breadcrumb/header skeleton + 2-column detail panels skeleton.
 */
export const DetailPageSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      role="status"
      aria-label="Loading details"
      className={`w-full space-y-6 animate-pulse ${className}`}
    >
      {/* Breadcrumb + Header Skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-24 rounded bg-slate-200/70 dark:bg-slate-800/70" />
          <div className="h-4 w-4 rounded bg-slate-200/50 dark:bg-slate-800/50" />
          <div className="h-4 w-32 rounded bg-slate-200/80 dark:bg-slate-800/80" />
        </div>
        <div className="rounded-3xl p-6 sm:p-8 bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2.5">
            <div className="h-7 w-64 sm:w-80 rounded-xl bg-slate-200/90 dark:bg-slate-800/90" />
            <div className="h-4 w-48 rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
          </div>
          <div className="h-10 w-36 rounded-2xl bg-sky-500/20 dark:bg-sky-500/20" />
        </div>
      </div>

      {/* 2-Column Detail Panels Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 p-6 rounded-3xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="h-5 w-36 rounded-lg bg-slate-200/90 dark:bg-slate-800/90" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 space-y-2"
              >
                <div className="h-4 w-3/4 rounded bg-slate-200/80 dark:bg-slate-800/80" />
                <div className="h-3 w-1/2 rounded bg-slate-200/60 dark:bg-slate-800/60" />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="h-4 w-28 rounded bg-sky-500/20 dark:bg-sky-500/20" />
            <div className="h-7 w-2/3 rounded-xl bg-slate-200/90 dark:bg-slate-800/90" />
            <div className="h-4 w-full rounded bg-slate-200/70 dark:bg-slate-800/70" />
          </div>
          <div className="h-48 w-full rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80" />
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-slate-200/70 dark:bg-slate-800/70" />
            <div className="h-4 w-11/12 rounded bg-slate-200/70 dark:bg-slate-800/70" />
            <div className="h-4 w-4/5 rounded bg-slate-200/70 dark:bg-slate-800/70" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * AnimatedLoadingSkeleton
 * Fast, zero-network, pure Tailwind CSS maritime-themed skeleton system.
 * Backward-compatible with existing props.
 */
export const AnimatedLoadingSkeleton: React.FC<AnimatedLoadingSkeletonProps> = ({
  variant,
  numCards,
  className = '',
}) => {
  if (variant === 'table') {
    return <TablePageSkeleton className={className} />;
  }
  if (variant === 'cards' || (variant === undefined && numCards !== undefined)) {
    return <CardGridSkeleton numCards={numCards ?? 6} className={className} />;
  }
  if (variant === 'detail' || variant === 'form') {
    return <DetailPageSkeleton className={className} />;
  }
  return <DashboardSkeleton className={className} />;
};

export default AnimatedLoadingSkeleton;
