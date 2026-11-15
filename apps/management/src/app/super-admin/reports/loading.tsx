'use client';

import React from 'react';

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse pb-8">
      {/* Header Banner Skeleton */}
      <div className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2.5 w-full max-w-xl">
          <div className="h-5 w-36 bg-slate-200 dark:bg-slate-800 rounded-full" />
          <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-10 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-10 w-28 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
        </div>
      </div>

      {/* Filter & Search Bar Skeleton */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="h-9 w-full sm:w-80 bg-slate-100 dark:bg-slate-800/70 rounded-xl" />
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 bg-slate-100 dark:bg-slate-800/70 rounded-xl shrink-0" />
          ))}
        </div>
      </div>

      {/* Table / Content Panel Skeleton */}
      <div className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((col) => (
            <div key={col} className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          ))}
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="p-4 grid grid-cols-5 gap-4 items-center">
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
              </div>
              <div className="space-y-1.5">
                <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800/60 rounded" />
              </div>
              <div className="h-4 w-28 bg-slate-100 dark:bg-slate-800/70 rounded" />
              <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
              <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded-xl ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
