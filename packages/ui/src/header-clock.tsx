'use client';

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

function formatManilaHeaderClock(): string {
  const now = new Date();
  return (
    now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }) +
    ' • ' +
    now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  );
}

export const HeaderClock = React.memo(function HeaderClock({
  className = 'hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400',
}: {
  className?: string;
}) {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setCurrentTime(formatManilaHeaderClock());
    };
    setCurrentTime(formatManilaHeaderClock());
    const interval = setInterval(updateTime, 1000);
    const onVis = () => {
      if (!document.hidden) setCurrentTime(formatManilaHeaderClock());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div className={className}>
      <Clock className="w-3.5 h-3.5 text-sky-500" />
      <span className="text-xs font-mono font-medium whitespace-nowrap">
        {currentTime || 'Syncing Time...'}
      </span>
      <span className="text-[10px] font-mono font-semibold text-slate-400 pl-1 border-l border-slate-200 dark:border-slate-700">
        UTC+8
      </span>
    </div>
  );
});
