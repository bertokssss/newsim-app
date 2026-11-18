'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Clock,
  Building2,
  UserCheck,
  Calendar,
  CheckCircle2,
  Mail,
  Bell,
  AlertCircle,
  XCircle,
  Lock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { TablePageSkeleton, UserAvatar } from '@newsim/ui';

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
      duration: 0.4,
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
  const [dailyModules, setDailyModules] = useState<any[]>([]);
  const [practicalSessions, setPracticalSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'DAILY_MODULES' | 'PRACTICAL'>('ALL');
  const [sendingNotify, setSendingNotify] = useState(false);
  const [notifyFeedback, setNotifyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadSchedules = () => {
    setLoading(true);
    fetch('/api/trainee/schedules')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          if (Array.isArray(json.data)) setSchedules(json.data);
          if (Array.isArray(json.dailyModules)) setDailyModules(json.dailyModules);
          if (Array.isArray(json.practicalSessions)) setPracticalSessions(json.practicalSessions);
        }
      })
      .catch((err) => console.error('Failed to load schedules:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const handleSendReminder = async () => {
    try {
      setSendingNotify(true);
      setNotifyFeedback(null);
      const res = await fetch('/api/trainee/schedules/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setNotifyFeedback({
          type: 'success',
          message: data.message || 'Notification email sent! Check your inbox for today’s lesson and schedule details.',
        });
      } else {
        setNotifyFeedback({
          type: 'error',
          message: data.error || 'Failed to dispatch email reminder. Please try again.',
        });
      }
    } catch (err: any) {
      setNotifyFeedback({
        type: 'error',
        message: err?.message || 'Network error sending notification.',
      });
    } finally {
      setSendingNotify(false);
    }
  };

  const [filterMode, setFilterMode] = useState<'UPCOMING' | 'ALL'>('UPCOMING');

  const upcomingPracticalCount = practicalSessions.filter(
    (p) => !p.isCompleted && (p.status || '').toUpperCase() !== 'COMPLETED' && (!p.endAt || new Date(p.endAt) >= new Date())
  ).length;

  // Determine items to display based on active tab and filterMode (Upcoming vs All)
  const displayItems = React.useMemo(() => {
    let items = schedules;
    if (activeTab === 'DAILY_MODULES') items = dailyModules;
    else if (activeTab === 'PRACTICAL') items = practicalSessions;

    if (filterMode === 'UPCOMING') {
      return items.filter((s: any) => {
        const st = (s.status || '').toUpperCase();
        if (s.isCompleted || st === 'COMPLETED' || s.isFailed || st === 'FAILED') {
          return false;
        }
        if (s.endAt && new Date(s.endAt) < new Date()) {
          return false;
        }
        return true;
      });
    }
    return items;
  }, [activeTab, filterMode, schedules, dailyModules, practicalSessions]);

  const dueTodayCount = dailyModules.filter((m) => m.isDueToday).length;
  const failedModulesCount = dailyModules.filter((m) => m.isFailed).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              Operations Timetable &amp; Pacing
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Personal Training Schedule
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] font-sans mt-0.5">
            Self-paced online theory modules (within your course activation window) and scheduled in-person practical training sessions.
          </p>
        </div>

        {/* Email Notification Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSendReminder}
            disabled={sendingNotify || loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 cursor-pointer"
            title="Dispatch email notification with today's module link and upcoming practical dates"
          >
            {sendingNotify ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
                <span>Sending Notification...</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Email My Schedule &amp; Lesson</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notification Toast/Banner Feedback */}
      <AnimatePresence>
        {notifyFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-4 rounded-2xl border text-xs font-mono flex items-center justify-between gap-3 ${
              notifyFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {notifyFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{notifyFeedback.message}</span>
            </div>
            <button
              onClick={() => setNotifyFeedback(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guidance Notice: Schedule vs Module Clarification */}
      <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs font-heading">
          <Sparkles className="w-4 h-4" />
          <span>TRAINING SCHEDULE &amp; MODULE PACING RULES</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-[#F8FAFC]">
              <BookOpen className="w-3.5 h-3.5 text-sky-500" />
              <span>Online Theory Modules (3-Day Window)</span>
            </div>
            <p className="text-slate-600 dark:text-[#CBD5E1] font-sans leading-relaxed">
              Complete each sequential online theory module and pass its assessment within your course&apos;s 3-day activation window.
              If a quiz is not passed on the first try, you may <span className="text-sky-600 dark:text-sky-400 font-bold">Reattempt</span> it in the Assessments Center.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-[#F8FAFC]">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Set Time: In-Person Practical Simulator Drills</span>
            </div>
            <p className="text-slate-600 dark:text-[#CBD5E1] font-sans leading-relaxed">
              For courses with practical training, the assigned set time (e.g. <strong>08:00 AM - 12:00 PM</strong>) is strictly for your <strong>in-person hands-on session</strong> at the training center.
              You must complete all online modules and assessments to qualify for practical evaluation and certificate issuance.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs & View Mode Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 p-1 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 w-fit shadow-xs">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'ALL'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Categories ({schedules.length})
          </button>
          <button
            onClick={() => setActiveTab('DAILY_MODULES')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'DAILY_MODULES'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Online Theory Modules</span>
            {dueTodayCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500 text-white">
                {dueTodayCount} Ready
              </span>
            )}
            {failedModulesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white">
                {failedModulesCount} Reattempt
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('PRACTICAL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'PRACTICAL'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Practical Simulator Sessions</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/20 text-sky-700 dark:text-sky-300">
              {upcomingPracticalCount}
            </span>
          </button>
        </div>

        {/* Upcoming vs All Filter Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 w-fit self-start sm:self-auto">
          <button
            onClick={() => setFilterMode('UPCOMING')}
            className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
              filterMode === 'UPCOMING'
                ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            ✦ Upcoming Only
          </button>
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
              filterMode === 'ALL'
                ? 'bg-white dark:bg-[#0c1a2c] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            All History ({schedules.length})
          </button>
        </div>
      </div>

      {/* Schedule Feed */}
      <div className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden relative">
        <div className="p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-sky-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
              {filterMode === 'UPCOMING' ? 'Upcoming ' : ''}
              {activeTab === 'DAILY_MODULES'
                ? 'Online Theory Modules'
                : activeTab === 'PRACTICAL'
                ? 'In-Person Practical Simulator Drills (Set Time)'
                : 'Training Timetable'}
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            NEWSIM Talisay Training Center (UTC+8)
          </span>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <TablePageSkeleton rows={4} showHeader={false} />
              </motion.div>
            ) : displayItems.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.35, ease: easeOutCurve }}
                className="py-12 text-center text-xs font-mono text-slate-400 space-y-2"
              >
                <p>
                  {filterMode === 'UPCOMING'
                    ? 'No upcoming sessions scheduled right now. All current modules and practical sessions are complete or up-to-date!'
                    : 'No sessions scheduled for your enrolled courses.'}
                </p>
                {filterMode === 'UPCOMING' && (
                  <button
                    onClick={() => setFilterMode('ALL')}
                    className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/30 hover:bg-sky-600 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>View All Completed History ({schedules.length})</span>
                    <span>→</span>
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={`${activeTab}-${filterMode}`}
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-4"
              >
                {displayItems.map((s: any) => {
                  const isDaily = s.type === 'DAILY_ONLINE_MODULE';
                  const isDueToday = Boolean(s.isDueToday);
                  const isCompleted = s.status === 'COMPLETED' || Boolean(s.isCompleted);
                  const isFailed = s.status === 'FAILED' || Boolean(s.isFailed);
                  const isLocked = s.status === 'LOCKED' || Boolean(s.isLocked);

                  return (
                    <motion.div
                      key={s.id}
                      variants={cascadeItem}
                      layout
                      className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                        isDueToday
                          ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/30'
                          : isFailed
                          ? 'bg-rose-500/5 border-rose-500/30'
                          : isCompleted
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isDaily
                                ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {isDaily ? `MODULE ${s.dayNumber}` : 'IN-PERSON PRACTICAL'}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-[#F8FAFC]">
                            {s.formattedDate || s.date}
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            • {s.time}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                          {isDaily ? s.moduleTitle : s.courseTitle}
                        </h4>

                        {isDaily && (
                          <p className="text-xs text-slate-600 dark:text-[#CBD5E1] font-sans">
                            Course: <span className="font-semibold text-slate-800 dark:text-white">{s.courseTitle}</span>
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600 dark:text-slate-400 pt-1">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-sky-500" />
                            {s.room}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <UserAvatar
                              src={s.instructorAvatarUrl}
                              name={s.instructorName}
                              alt={s.instructorName || 'Instructor'}
                              className="w-4 h-4 rounded-md"
                              fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[8px] font-bold"
                            />
                            <span>{s.instructorName}</span>
                          </span>
                          {isDaily ? (
                            <span className="text-[11px] text-slate-500">
                              (Online LMS self-paced module)
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                              ★ Certificate Qualification Drill
                            </span>
                          )}
                        </div>

                        {isFailed && (
                          <p className="text-xs font-mono text-amber-600 dark:text-amber-400 mt-1">
                            ⚠ {s.failureReason || 'Reattempt the module assessment in Assessments Center to complete this requirement.'}
                          </p>
                        )}
                        {isLocked && s.lockReason && (
                          <p className="text-xs font-mono text-slate-500 mt-1">
                            🔒 {s.lockReason}
                          </p>
                        )}
                      </div>

                      {/* Status & Action */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start md:self-auto shrink-0">
                        {isDaily ? (
                          <>
                            {isCompleted ? (
                              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>COMPLETED</span>
                              </span>
                            ) : isFailed ? (
                              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>FAILED</span>
                              </span>
                            ) : isDueToday ? (
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center gap-1.5">
                                  <Bell className="w-3.5 h-3.5" />
                                  <span>AVAILABLE</span>
                                </span>
                                <Link
                                  href={`/learning?courseId=${s.courseId}`}
                                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1"
                                >
                                  <span>Start Lesson</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5" />
                                <span>LOCKED</span>
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            {isCompleted ? (
                              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>COMPLETED</span>
                              </span>
                            ) : (
                              <>
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                  {s.status}
                                </span>
                                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Room Confirmed ✓
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
