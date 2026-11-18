'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  Award,
  CalendarCheck2,
  ShieldCheck,
  Flame,
  Layers,
  ChevronRight,
  BookOpen,
  XCircle,
  AlertCircle,
  Anchor,
  Sparkles,
  BarChart3,
  Radar as RadarIcon,
  Activity,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { DashboardSkeleton, ImmersiveChartFrame } from '@newsim/ui';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';

// Custom decel / ease-out curves
const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Staggered container variant (elements animate in sequence, NOT in sync)
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

// Cascading child item variant with ease-out
const cascadeItem = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: easeOutCurve },
  },
};

export default function ProgressClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'SCORE_TREND' | 'STCW_PILLARS' | 'VELOCITY'>('SCORE_TREND');
  const [chartInView, setChartInView] = useState(false);

  useEffect(() => {
    fetch('/api/trainee/progress')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json.data);
        }
      })
      .catch((err) => console.error('Failed to load progress telemetry:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const progress = data || {
    overallProgress: 0,
    status: 'NOT_STARTED',
    streakDays: 0,
    totalHoursCompleted: 0,
    totalHoursRequired: 0,
    totalPassedModules: 0,
    totalFailedModules: 0,
    totalRequiredModules: 0,
    hasPendingPractical: false,
    dailyModulesList: [],
    competencyRadar: [],
    courses: [],
  };

  // Process real assessment verdict data for charts (no placeholder scores)
  const moduleChartData = (progress.dailyModulesList || [])
    .filter((m: any) => typeof m.quizScore === 'number')
    .map((m: any, idx: number) => ({
      name: m.label || `Day ${m.dayNumber || idx + 1}`,
      title: m.moduleTitle || `Module ${idx + 1}`,
      score: m.quizScore,
      benchmark: 75,
      status: m.status,
      isCompleted: m.isCompleted,
      isFailed: m.isFailed,
      isDueToday: m.isDueToday,
      date: m.formattedDate || m.scheduledDate,
    }));

  const displayChartData = moduleChartData;

  const radarData = (progress.competencyRadar && progress.competencyRadar.length > 0)
    ? progress.competencyRadar
    : [
        { pillar: 'Attendance (10%)', score: 0, benchmark: 80 },
        { pillar: 'Practical Drills (60%)', score: progress.courses?.some((c: any) => c.practicalCompetent) ? 100 : 0, benchmark: 70 },
        { pillar: 'Theory Quizzes (40%)', score: 0, benchmark: 75 },
      ];

  const velocityData = displayChartData.map((d: any, idx: number) => ({
    name: d.name,
    cumulativeProgress: Math.min(100, Math.round(((idx + 1) / Math.max(1, displayChartData.length)) * 50) + (progress.courses?.some((c: any) => c.practicalCompetent) ? 50 : 0)),
    score: d.score,
    completed: d.isCompleted ? 1 : 0,
  }));

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.4, ease: easeOutCurve }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              Training Milestones &amp; Telemetry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Progress &amp; Performance Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] font-sans mt-0.5">
            Self-paced modular progression (finish within your 3-day window), assessment score trajectories, and competency readiness.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/grades"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 transition-all hover:shadow-xs active:scale-95"
          >
            <Award className="w-3.5 h-3.5 text-sky-500" />
            <span>Grade Breakdown →</span>
          </Link>
          <Link
            href="/schedules"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold transition-all shadow-sm shadow-sky-500/20 active:scale-95"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Timetable &amp; Practical →</span>
          </Link>
        </div>
      </motion.div>

      {/* Hero KPI Cards: Animated in sequence (not in sync) when showed in screen */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
      >
        {/* KPI 1: Overall Progress */}
        <motion.div
          variants={cascadeItem}
          whileHover={{ y: -3, transition: { duration: 0.2, ease: easeOutCurve } }}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase font-bold text-slate-400">Total Completion</span>
            <Activity className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-2 tabular-nums">
            {progress.overallProgress}%
          </div>
          <div className="mt-3 w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-900/60 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${progress.overallProgress || 0}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: easeOutCurve }}
              className="h-full bg-gradient-to-r from-sky-500 to-teal-500 rounded-full"
            />
          </div>
          <span className="text-[11px] font-mono text-slate-500 mt-2 block">
            Theory 50% + Practical Simulator 50%
          </span>
        </motion.div>

        {/* KPI 2: Modules Passed vs Failed */}
        <motion.div
          variants={cascadeItem}
          whileHover={{ y: -3, transition: { duration: 0.2, ease: easeOutCurve } }}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase font-bold text-slate-400">Online Theory Modules</span>
            <BookOpen className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-2">
            {progress.totalPassedModules} <span className="text-sm text-slate-400 font-normal">/ {progress.totalRequiredModules} Passed</span>
          </div>
          {progress.totalFailedModules > 0 ? (
            <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold block mt-2 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{progress.totalFailedModules} Needs Reattempt (Below Passing Score)</span>
            </span>
          ) : (
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold block mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>All active theory modules on track</span>
            </span>
          )}
        </motion.div>

        {/* KPI 3: Practical Qualification */}
        <motion.div
          variants={cascadeItem}
          whileHover={{ y: -3, transition: { duration: 0.2, ease: easeOutCurve } }}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase font-bold text-slate-400">Practical Evaluation</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className={`text-xl font-extrabold font-heading mt-2 ${
            progress.hasPendingPractical ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {progress.hasPendingPractical ? 'PENDING SIMULATOR' : 'QUALIFIED / CLEARED'}
          </div>
          <span className="text-[11px] font-mono text-slate-400 block mt-2">
            {progress.hasPendingPractical ? 'Set-time simulator session required' : 'STCW practical cleared'}
          </span>
        </motion.div>

        {/* KPI 4: Streak */}
        <motion.div
          variants={cascadeItem}
          whileHover={{ y: -3, transition: { duration: 0.2, ease: easeOutCurve } }}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase font-bold text-slate-400">Study Momentum</span>
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-amber-500 font-heading mt-2 flex items-center gap-2">
            <span>{progress.streakDays} {progress.streakDays === 1 ? 'Day' : 'Days'}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 block mt-2">
            Self-paced within 3-day modular window
          </span>
        </motion.div>
      </motion.div>

      {/* Interactive Charts Section: Triggers when shown on screen with ease-out effect */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        onViewportEnter={() => setChartInView(true)}
        transition={{ duration: 0.5, ease: easeOutCurve }}
        className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden space-y-6"
      >
        {/* Chart Header & Interactive Switcher Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                Interactive Telemetry &amp; Performance Velocity
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-sans">
              Real-time score trajectories across modular theory quizzes and STCW competency benchmarks.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setChartView('SCORE_TREND')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                chartView === 'SCORE_TREND'
                  ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Score Trajectory</span>
            </button>
            <button
              onClick={() => setChartView('STCW_PILLARS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                chartView === 'STCW_PILLARS'
                  ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <RadarIcon className="w-3.5 h-3.5" />
              <span>3-Pillar Radar</span>
            </button>
            <button
              onClick={() => setChartView('VELOCITY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                chartView === 'VELOCITY'
                  ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Completion Velocity</span>
            </button>
          </div>
        </div>

        {/* Chart View Content with Out Effect on Tab Change */}
        <div className="h-72 w-full">
          <AnimatePresence mode="wait">
            {chartView === 'SCORE_TREND' && (
              <motion.div
                key="score-trend"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.97, transition: { duration: 0.22, ease: easeOutCurve } }}
                transition={{ duration: 0.4, ease: easeOutCurve }}
                className="w-full h-full"
              >
                {displayChartData.length === 0 ? (
                  <div className="h-full w-full rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center px-6 gap-2">
                    <TrendingUp className="w-7 h-7 text-slate-400" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      No assessment score verdicts recorded yet
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md font-sans">
                      Complete a module quiz or assessment first. Your verified score verdicts will automatically plot here.
                    </p>
                    <Link
                      href="/assessments"
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-sky-600 dark:text-sky-400 hover:underline pt-1"
                    >
                      <span>Open Assessments</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                <ImmersiveChartFrame
                  ready={!loading}
                  triggerKey={`trainee-prog-trend-${chartView}-${displayChartData.length}-${chartInView ? 'in' : 'wait'}`}
                  duration={1.95}
                  className="w-full h-full"
                >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                      axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.2 }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                      axisLine={false}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="p-3 rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white border border-slate-700 shadow-xl text-xs space-y-1.5 backdrop-blur-md">
                              <div className="font-bold text-sky-400 font-mono flex items-center justify-between gap-3">
                                <span>{item.name}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  item.isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {item.status || (item.isCompleted ? 'COMPLETED' : 'PENDING')}
                                </span>
                              </div>
                              <p className="text-slate-300 font-sans line-clamp-1 max-w-[220px]">
                                {item.title}
                              </p>
                              <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                                <span className="text-slate-400">Quiz Score:</span>
                                <span className="font-extrabold text-emerald-400">{item.score}%</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                                <span>STCW Benchmark:</span>
                                <span>{item.benchmark}% Pass</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={75}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: '75% STCW Benchmark', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fillOpacity={1}
                      fill="url(#scoreGradient)"
                      isAnimationActive={true}
                      animationDuration={1850}
                      animationEasing="ease-out"
                      activeDot={{ r: 6, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                </ImmersiveChartFrame>
                )}
              </motion.div>
            )}

            {chartView === 'STCW_PILLARS' && (
              <motion.div
                key="stcw-pillars"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.97, transition: { duration: 0.22, ease: easeOutCurve } }}
                transition={{ duration: 0.4, ease: easeOutCurve }}
                className="w-full h-full flex items-center justify-center"
              >
                <ImmersiveChartFrame
                  ready={!loading}
                  triggerKey={`trainee-prog-radar-${chartView}-${chartInView ? 'in' : 'wait'}`}
                  duration={1.9}
                  className="w-full h-full"
                >
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#94a3b8" strokeOpacity={0.2} />
                    <PolarAngleAxis
                      dataKey="pillar"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: '#64748b', fontSize: 9 }}
                      axisLine={false}
                    />
                    <Radar
                      name="Your Competency"
                      dataKey="score"
                      stroke="#0284c7"
                      fill="#0284c7"
                      fillOpacity={0.4}
                      isAnimationActive={true}
                      animationDuration={1850}
                      animationEasing="ease-out"
                    />
                    <Radar
                      name="STCW Benchmark"
                      dataKey="benchmark"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.15}
                      isAnimationActive={true}
                      animationDuration={1850}
                      animationEasing="ease-out"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="p-3 rounded-2xl bg-slate-900/95 text-white border border-slate-700 shadow-xl text-xs space-y-1 font-mono">
                              <div className="font-bold text-sky-400">{item.pillar}</div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Current Score:</span>
                                <span className="font-bold text-emerald-400">{item.score}%</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Required Benchmark:</span>
                                <span className="font-bold text-amber-400">{item.benchmark}%</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                </ImmersiveChartFrame>
              </motion.div>
            )}

            {chartView === 'VELOCITY' && (
              <motion.div
                key="velocity"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.97, transition: { duration: 0.22, ease: easeOutCurve } }}
                transition={{ duration: 0.4, ease: easeOutCurve }}
                className="w-full h-full"
              >
                {velocityData.length === 0 ? (
                  <div className="h-full w-full rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center px-6 gap-2">
                    <Activity className="w-7 h-7 text-slate-400" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      No completion velocity milestones yet
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md font-sans">
                      Once your assessment attempts are recorded, your completion velocity across modules will appear here.
                    </p>
                  </div>
                ) : (
                <ImmersiveChartFrame
                  ready={!loading}
                  triggerKey={`trainee-prog-vel-${chartView}-${velocityData.length}-${chartInView ? 'in' : 'wait'}`}
                  duration={1.9}
                  className="w-full h-full"
                >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocityData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                      axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.2 }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                      axisLine={false}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="p-3 rounded-2xl bg-slate-900/95 text-white border border-slate-700 shadow-xl text-xs space-y-1 font-mono">
                              <div className="font-bold text-sky-400">{item.name}</div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Cumulative Progress:</span>
                                <span className="font-bold text-sky-300">{item.cumulativeProgress}%</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Assessment Score:</span>
                                <span className="font-bold text-emerald-400">{item.score}%</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="cumulativeProgress"
                      fill="#0284c7"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={true}
                      animationDuration={1850}
                      animationEasing="ease-out"
                    >
                      {velocityData.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.cumulativeProgress >= 100 ? '#10b981' : '#0284c7'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                </ImmersiveChartFrame>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Legend / Info Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
              <span>Theory Quiz Score</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>75% MARINA Knowledge Benchmark</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Practical Simulator Competency</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Interactive chart • Animates when scrolled into screen with ease-out
          </span>
        </div>
      </motion.div>

      {/* Course Breakdown List: Sequential, non-sync staggered cascade */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-500" />
            <span>Course Milestones &amp; Subject Evaluation</span>
          </h3>
          <span className="text-xs font-mono text-slate-500">
            {progress.courses?.length || 0} Programs Active
          </span>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="space-y-4"
        >
          {(!progress.courses || progress.courses.length === 0) ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 text-center text-xs font-mono text-slate-400">
              No course progress recorded yet. Enroll in an STCW program to start tracking your milestones.
            </div>
          ) : (
            progress.courses.map((c: any) => {
              const isCompetent = Boolean(c.practicalCompetent);
              const hasFailed = (c.modulesFailed || 0) > 0;
              const isFullyCompleted = (c.progressPercent || 0) >= 100;

              return (
                <motion.div
                  key={c.id}
                  variants={cascadeItem}
                  whileHover={{ y: -2, transition: { duration: 0.2, ease: easeOutCurve } }}
                  className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden hover:border-sky-500/30 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        {c.code}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        c.requiresPractical === false || String(c.category || '').toLowerCase().includes('in-house')
                          ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                      }`}>
                        {c.requiresPractical === false || String(c.category || '').toLowerCase().includes('in-house')
                          ? 'In-House • Full Modular-Based'
                          : 'STCW • Modular + Practical'}
                      </span>
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                        {c.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          isFullyCompleted
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                        }`}
                      >
                        {isFullyCompleted ? 'COMPLETED' : 'IN PROGRESS'}
                      </span>
                    </div>
                  </div>

                  {/* Progress and Telemetry Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 text-[10px] block font-bold">PASSED MODULES</span>
                      <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                        {c.modulesCompleted || 0} / {c.totalModules || 0}
                      </span>
                      {hasFailed && (
                        <span className="text-rose-600 dark:text-rose-400 text-[10px] block font-semibold mt-0.5">
                          {c.modulesFailed} Failed
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block font-bold">AVERAGE GRADE</span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {c.averageGrade || 0}%
                      </span>
                      <span className="text-slate-400 text-[10px] block mt-0.5">
                        Min. 70% Pass
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block font-bold">
                        {c.requiresPractical === false || String(c.category || '').toLowerCase().includes('in-house')
                          ? 'DELIVERY MODE'
                          : `PRACTICAL (${c.code})`}
                      </span>
                      <span className={`font-bold block ${
                        c.requiresPractical === false || String(c.category || '').toLowerCase().includes('in-house')
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : isCompetent
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-500'
                      }`}>
                        {c.requiresPractical === false || String(c.category || '').toLowerCase().includes('in-house')
                          ? '✓ FULL MODULAR'
                          : isCompetent
                          ? '✓ COMPETENT'
                          : 'AFTER MODULES'}
                      </span>
                      <span className="text-slate-400 text-[10px] block mt-0.5">
                        {c.requiresPractical === false || String(c.category || '').toLowerCase().includes('in-house')
                          ? '100% Modular (No practical)'
                          : 'Unlocks after modules'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block font-bold">CERTIFICATE STATUS</span>
                      <span className={`font-bold block ${
                        isFullyCompleted && !hasFailed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
                      }`}>
                        {isFullyCompleted && !hasFailed ? 'QUALIFIED' : 'IN PROGRESS'}
                      </span>
                      <span className="text-slate-400 text-[10px] block mt-0.5">
                        {isFullyCompleted ? 'Claim slip available' : (c.requiresPractical === false ? 'Finish all modules' : 'Finish modules + practical')}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar & Weighted Breakdown */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-500">
                        {c.requiresPractical === false || String(c.category || '').toLowerCase().includes('in-house')
                          ? 'In-House Full Modular Graduation Criteria (100% Modular Lessons & Written Assessments)'
                          : `STCW Graduation Criteria (Modular Lessons First → ${c.code} Practical Assessment)`}
                      </span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {c.progressPercent || 0}%
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-900/60 overflow-hidden border border-slate-200/80 dark:border-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${c.progressPercent || 0}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: easeOutCurve }}
                        className="h-full bg-gradient-to-r from-sky-500 to-teal-500 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Requirement Notice */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans text-slate-500 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0" />
                      <span>
                        {c.requiresPractical === false || String(c.category || '').toLowerCase().includes('in-house')
                          ? 'In-House Full Modular Course: Complete all modular lessons and pass all written assessments to qualify for certificate release.'
                          : `Safety and Other STCW Courses: Complete all modular lessons first, then complete the Practical Assessment in ${c.title} (${c.code}).`}
                      </span>
                    </div>
                    <Link
                      href={`/learning?courseId=${c.id}`}
                      className="text-sky-600 dark:text-sky-400 font-bold hover:underline shrink-0 text-xs font-mono inline-flex items-center gap-1"
                    >
                      <span>{c.requiresPractical === false ? 'Open Modular Workspace' : `Open Modules & ${c.code} Practical`}</span>
                      <span>→</span>
                    </Link>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>
    </div>
  );
}
