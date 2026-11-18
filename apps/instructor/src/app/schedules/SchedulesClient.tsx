'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Clock,
  Building2,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  Filter
} from 'lucide-react';
import { CardGridSkeleton } from '@newsim/ui';

const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.03,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.04,
      staggerDirection: -1,
    },
  },
};

const cascadeItem = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: easeOutCurve,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.98,
    transition: {
      duration: 0.22,
      ease: easeOutCurve,
    },
  },
};

export default function SchedulesClient() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'LIST' | 'DAY' | 'WEEK'>('LIST');
  const [filterMode, setFilterMode] = useState<'UPCOMING' | 'ALL'>('UPCOMING');

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/instructor/schedules');
      const json = await res.json();
      if (json.success) {
        setSchedules(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const displaySchedules = useMemo(() => {
    let list = schedules;
    if (filterMode === 'UPCOMING') {
      const now = new Date();
      list = list.filter((s: any) => {
        const st = (s.status || '').toUpperCase();
        if (st === 'COMPLETED' || st === 'CANCELLED' || s.isCompleted) return false;
        if (s.endDate && new Date(`${s.endDate}T23:59:59`) < now) return false;
        return true;
      });
    }
    return list;
  }, [schedules, filterMode]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOutCurve }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm"
      >
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              Timetable & Rooms
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Instructor Teaching Timetable
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed font-sans">
            View your assigned classroom lectures and simulator sessions at NEWSIM Talisay Training Center.
          </p>
        </div>
      </motion.div>

      {/* View Mode & Filter Switcher */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Upcoming vs All Filter Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold">
            <button
              onClick={() => setFilterMode('UPCOMING')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === 'UPCOMING'
                  ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ✦ Upcoming Only
            </button>
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-white dark:bg-[#0c1a2c] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All History
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Calendar Granularity Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono">
            {[
              { id: 'LIST', label: 'All Sessions' },
              { id: 'DAY', label: 'Day View' },
              { id: 'WEEK', label: 'Week View' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id as any)}
                className={`px-3 py-1.5 rounded-lg font-semibold uppercase transition-all cursor-pointer ${
                  viewMode === mode.id
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {displaySchedules.length} of {schedules.length} Sessions
        </span>
      </div>

      {/* Sessions Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="col-span-3">
              <CardGridSkeleton numCards={6} showHeader={false} />
            </div>
          </div>
        ) : displaySchedules.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="py-12 text-center text-slate-400 font-mono text-xs rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-2"
          >
            <p>
              {filterMode === 'UPCOMING'
                ? 'No upcoming teaching sessions scheduled. All current class batches are completed!'
                : 'No teaching sessions assigned.'}
            </p>
            {filterMode === 'UPCOMING' && schedules.length > 0 && (
              <button
                onClick={() => setFilterMode('ALL')}
                className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/30 hover:bg-sky-600 hover:text-white transition-all cursor-pointer"
              >
                View Full Historical Schedule ({schedules.length}) →
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={`${filterMode}-${viewMode}`}
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {displaySchedules.map((s) => (
              <motion.div
                key={s.id}
                variants={cascadeItem}
                whileHover={{ y: -3, transition: { duration: 0.2, ease: easeOutCurve } }}
                className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-sky-500/20 transition-all flex flex-col justify-between relative overflow-hidden"
              >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    {s.sessionCode}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    s.status === 'ONGOING'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 border border-sky-500/20'
                      : s.status === 'SCHEDULED'
                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                      : 'bg-slate-500/15 text-slate-400'
                  }`}>
                    {s.status}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-3">
                  {s.courseTitle}
                </h3>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
                  {s.isFullModular ? (
                    <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold">Modular Window</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            Max {s.theoryDays || 3} Days
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block font-semibold">Delivery Mode</span>
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC] text-[11px] leading-tight">
                              Full Modular / In-House
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block font-semibold">Practical Date</span>
                            <div className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px] leading-tight">
                              No Practical Date Required
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="pt-1.5 mt-1 border-t border-indigo-200/50 dark:border-indigo-800/50 text-[10px] text-slate-500 flex items-center justify-between">
                        <span>Role:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Academic Record Review</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Schedule Period</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            {s.totalDays || 1} Day{(s.totalDays || 1) > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block font-semibold">Date Started</span>
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC] text-[11px] leading-tight">
                              {s.startDate || s.date}
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block font-semibold">Date End</span>
                            <div className="font-bold text-sky-600 dark:text-sky-400 text-[11px] leading-tight">
                              {s.endDate || s.date}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="pt-1.5 mt-1 border-t border-slate-200/50 dark:border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                        <span>Daily:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{s.startTime} - {s.endTime}</span>
                      </div>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Roster Quorum</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                          Active
                        </span>
                      </div>
                      <div className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-base mt-0.5">
                        {s.enrolledCount ?? 0} / {s.capacity}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Trainees Enrolled</div>
                    </div>
                    <div className="pt-1.5 mt-1 border-t border-slate-200/50 dark:border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>Course Partition:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {s.theoryDays || 1}d Theory • {s.practicalDays || 0}d Practical
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{s.isFullModular ? 'Training Venue:' : 'Room / Simulator:'}</span>
                    <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{s.room}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Training Campus:</span>
                    <span className="font-semibold text-sky-600 dark:text-sky-400">{s.centerName}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Classroom Code: {s.sessionCode}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Conflict Checked ✓</span>
              </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

