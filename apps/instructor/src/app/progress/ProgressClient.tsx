'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
  Award,
  CalendarCheck2,
  Sparkles,
  BarChart2,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { CardGridSkeleton, ImmersiveChartFrame, UserAvatar } from '@newsim/ui';

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

export default function ProgressClient() {
  const [progressList, setProgressList] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [chartMetric, setChartMetric] = useState<'DISTRIBUTION' | 'STATUS' | 'PERFORMANCE'>('DISTRIBUTION');
  const [chartInView, setChartInView] = useState(false);

  useEffect(() => {
    fetch('/api/instructor/my-courses')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setCourses(json.data);
          if (json.data.length === 1) {
            setCourseFilter(json.data[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (courseFilter && courseFilter !== 'ALL') query.set('courseId', courseFilter);

      const res = await fetch(`/api/instructor/progress?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setProgressList(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [search, statusFilter, courseFilter]);

  const telemetryData = useMemo(() => {
    const bands = [
      { name: '0-25% Early', count: 0, color: '#f43f5e' },
      { name: '26-50% Basic', count: 0, color: '#f59e0b' },
      { name: '51-75% Advanced', count: 0, color: '#0ea5e9' },
      { name: '76-100% Final', count: 0, color: '#10b981' },
    ];
    const statusMap: Record<string, number> = {
      ON_TRACK: 0,
      COMPLETED: 0,
      AT_RISK: 0,
      BEHIND: 0,
    };
    const performancePoints = progressList.slice(0, 10).map((p) => ({
      name: p.traineeName?.split(' ')[0] || p.srn || 'Trainee',
      fullName: p.traineeName || 'Trainee',
      progress: p.progressPercent || 0,
      attendance: parseInt(p.attendanceRate) || 100,
      grade: p.averageGrade || 80,
    }));

    progressList.forEach((p) => {
      const pct = p.progressPercent || 0;
      if (pct <= 25) bands[0].count++;
      else if (pct <= 50) bands[1].count++;
      else if (pct <= 75) bands[2].count++;
      else bands[3].count++;

      const st = (p.status || 'ON_TRACK').toUpperCase();
      if (statusMap[st] !== undefined) statusMap[st]++;
      else statusMap['ON_TRACK']++;
    });

    const statusChartData = [
      { name: 'On Track', count: statusMap['ON_TRACK'], color: '#0ea5e9' },
      { name: 'Completed', count: statusMap['COMPLETED'], color: '#10b981' },
      { name: 'At Risk', count: statusMap['AT_RISK'], color: '#f59e0b' },
      { name: 'Behind', count: statusMap['BEHIND'], color: '#f43f5e' },
    ];

    return { bands, statusChartData, performancePoints };
  }, [progressList]);

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
              Cohort Telemetry & Risk Analytics
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Trainee Milestone & Progress Tracking
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed font-sans">
            Monitor syllabus module milestones, identify seafarers requiring remedial simulator sessions, and ensure cohort certification readiness.
          </p>
        </div>
      </motion.div>

      {/* Interactive Cohort Telemetry Visualizer Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        onViewportEnter={() => setChartInView(true)}
        transition={{ duration: 0.45, ease: easeOutCurve }}
        className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-500" />
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                Cohort Milestone Velocity & Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Real-time cohort distribution across syllabus mastery thresholds
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold self-start sm:self-auto">
            <button
              onClick={() => setChartMetric('DISTRIBUTION')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'DISTRIBUTION'
                  ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Progress Bands
            </button>
            <button
              onClick={() => setChartMetric('STATUS')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'STATUS'
                  ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Status Overview
            </button>
            <button
              onClick={() => setChartMetric('PERFORMANCE')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'PERFORMANCE'
                  ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Grade vs Attendance
            </button>
          </div>
        </div>

        {/* Dynamic Chart Container with AnimatePresence */}
        <AnimatePresence mode="wait">
          <motion.div
            key={chartMetric}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: easeOutCurve }}
            className="h-52 w-full"
          >
            <ImmersiveChartFrame
              ready={!loading}
              triggerKey={`inst-prog-${chartMetric}-${statusFilter}-${chartInView ? 'in' : 'wait'}`}
              duration={1.9}
              className="w-full h-full"
            >
            {chartMetric === 'DISTRIBUTION' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={telemetryData.bands} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-xl text-xs space-y-1 font-mono">
                            <div className="font-bold text-sky-400">{item.name}</div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Trainees:</span>
                              <span className="font-bold text-emerald-400">{item.count}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={1800} animationEasing="ease-out">
                    {telemetryData.bands.map((entry, index) => (
                      <Cell key={`band-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : chartMetric === 'STATUS' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={telemetryData.statusChartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-xl text-xs space-y-1 font-mono">
                            <div className="font-bold text-sky-400">{item.name}</div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Total:</span>
                              <span className="font-bold text-white">{item.count}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={1800} animationEasing="ease-out">
                    {telemetryData.statusChartData.map((entry, index) => (
                      <Cell key={`st-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryData.performancePoints} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} ticks={[0, 50, 75, 100]} tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-xl text-xs space-y-1 font-mono">
                            <div className="font-bold text-sky-400">{item.fullName}</div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Avg Grade:</span>
                              <span className="font-bold text-sky-300">{item.grade}%</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Attendance:</span>
                              <span className="font-bold text-emerald-400">{item.attendance}%</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Syllabus Progress:</span>
                              <span className="font-bold text-amber-400">{item.progress}%</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '75% Pass Benchmark', fill: '#f59e0b', fontSize: 9, position: 'insideTopRight' }} />
                  <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 4" label={{ value: '80% Attendance Quorum', fill: '#10b981', fontSize: 9, position: 'insideTopLeft' }} />
                  <Area
                    type="monotone"
                    dataKey="grade"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="url(#gradeGrad)"
                    isAnimationActive={true}
                    animationDuration={1850}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
            </ImmersiveChartFrame>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search seafarer, SRN, rank, program..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400 shrink-0">
              Assigned Course:
            </span>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-[#F8FAFC] outline-none cursor-pointer"
            >
              {courses.length > 1 && <option value="ALL">All Assigned Courses ({courses.length})</option>}
              {courses.length === 0 ? (
                <option value="ALL">No Assigned Courses</option>
              ) : (
                courses.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `[${c.code}] ` : ''}{c.title || c.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
          {['ALL', 'ON_TRACK', 'AT_RISK', 'BEHIND', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold uppercase whitespace-nowrap transition-all ${
                statusFilter === st
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Trainee Progress Cards Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <CardGridSkeleton numCards={4} showHeader={false} />
            </div>
          </div>
        ) : progressList.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="py-12 text-center text-slate-400 font-mono text-xs rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800"
          >
            No trainee progress records found matching criteria.
          </motion.div>
        ) : (
          <motion.div
            key={`${statusFilter}-${search}`}
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {progressList.map((p) => (
              <motion.div
                key={p.id}
                variants={cascadeItem}
                whileHover={{ y: -3, transition: { duration: 0.2, ease: easeOutCurve } }}
                className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-sky-500/20 transition-all flex flex-col justify-between relative overflow-hidden"
              >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <UserAvatar
                      src={p.traineeAvatarUrl}
                      name={p.traineeName}
                      alt={p.traineeName || 'Trainee'}
                      className="w-11 h-11 rounded-2xl mt-0.5"
                      fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-xs font-bold"
                    />
                    <div className="min-w-0">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        {p.srn}
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-1.5 truncate">
                        {p.traineeName}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-[#CBD5E1] font-sans truncate">
                        {p.rank} • {p.courseTitle}
                      </div>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                    p.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 border border-sky-500/20'
                      : p.status === 'ON_TRACK'
                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                      : 'bg-rose-500/15 text-rose-600 border border-rose-500/30 animate-pulse'
                  }`}>
                    {(p.status || 'ON_TRACK').replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-[#CBD5E1]">
                    <span>Overall Syllabus Progress</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">{p.progressPercent}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.progressPercent || 0}%` }}
                      transition={{ type: 'spring', stiffness: 90, damping: 18 }}
                      className="h-full bg-gradient-to-r from-sky-500 to-teal-500 rounded-full"
                    />
                  </div>
                </div>

                {/* 3 Metric Pills */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Modules</span>
                    <div className="font-bold text-slate-900 dark:text-[#F8FAFC] mt-0.5">{p.modulesCompleted} / {p.totalModules}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">{p.isFullModular ? 'Course Mode' : 'Attendance'}</span>
                    <div className={`font-bold mt-0.5 ${p.isFullModular ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {p.isFullModular ? 'Full Modular' : p.attendanceRate}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Avg Grade</span>
                    <div className="font-bold text-slate-900 dark:text-[#F8FAFC] mt-0.5">{p.averageGrade} pts</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>
                  Active:{' '}
                  {p.lastActiveAt && !isNaN(new Date(p.lastActiveAt).getTime())
                    ? new Date(p.lastActiveAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Today'}
                </span>
                {p.status === 'AT_RISK' && (
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    {p.isFullModular ? '⚠️ Academic Review Needed' : '⚠️ Remedial Drill Required'}
                  </span>
                )}
              </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

