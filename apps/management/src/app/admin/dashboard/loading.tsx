'use client';

import React from 'react';

export default function Loading() {
  return (
    <div className="space-y-6 sm:space-y-8 xl:space-y-10 animate-pulse pb-8">
      {/* 1. Immersive Command Header with Glassmorphism */}
      <div className="p-6 rounded-3xl bg-white/75 dark:bg-[#0c1a2c] backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 h-32">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-slate-200 dark:bg-slate-800" />
        
        <div className="relative z-10 w-full">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-full mb-3" />
          <div className="h-10 w-3/4 max-w-lg bg-slate-200 dark:bg-slate-800 rounded-lg mb-3" />
          <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
        
        <div className="w-full sm:w-auto shrink-0 mt-4 md:mt-0 flex gap-2">
          <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* 2. Top Tier Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 xl:gap-8 min-h-[22rem]">
        {/* Main Revenue Card */}
        <div className="lg:col-span-7 p-6 sm:p-8 xl:p-10 rounded-3xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="flex justify-between items-center mb-10">
            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          
          <div className="h-16 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl mb-6" />
          <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl mb-auto" />
          
          <div className="h-32 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-xl mt-8" />
        </div>

        {/* 3 Secondary Cards */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 sm:gap-6 xl:gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 xl:p-6 rounded-2xl bg-white/75 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 flex flex-col justify-center space-y-3 h-full min-h-[120px]">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-md mt-2" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Operational Focus Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 xl:gap-8 min-h-80">
        {[1, 2].map((i) => (
          <div key={i} className="p-6 sm:p-8 rounded-3xl bg-white/75 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mb-2" />
                <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded-md" />
              </div>
              <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-12 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

