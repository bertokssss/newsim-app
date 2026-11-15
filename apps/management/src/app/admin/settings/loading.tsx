'use client';

import React from 'react';

export default function AdminSettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-pulse pb-8">
      {/* Header Banner Skeleton */}
      <div className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="h-5 w-40 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-2 pt-1">
          <div className="h-3.5 w-full max-w-2xl rounded bg-slate-100 dark:bg-slate-800/70" />
          <div className="h-3.5 w-2/3 max-w-xl rounded bg-slate-100 dark:bg-slate-800/70" />
        </div>
      </div>

      {/* 3-Tab Switcher Skeleton */}
      <div className="p-1.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm grid grid-cols-3 gap-2">
        <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
        <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
      </div>

      {/* Main Profile Card Skeleton */}
      <div className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        {/* Avatar & Identity Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="space-y-2.5 flex-1">
            <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3.5 w-56 rounded bg-slate-100 dark:bg-slate-800/70" />
            <div className="flex items-center gap-3 pt-1">
              <div className="h-8 w-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-8 w-16 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
            </div>
          </div>
        </div>

        {/* Name Row (2 columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-11 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
            </div>
          ))}
        </div>

        {/* Contact / Department / SRN Row (3 columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-11 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
            </div>
          ))}
        </div>

        {/* Action Button Row */}
        <div className="flex justify-end">
          <div className="h-11 w-36 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}
