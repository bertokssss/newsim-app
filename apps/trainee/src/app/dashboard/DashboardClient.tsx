'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardSkeleton, ImmersiveChartFrame, UserAvatar } from '@newsim/ui';
import { canAccessPortalRoute } from '@newsim/utils';
import {
  Anchor,
  PlayCircle,
  BookOpen,
  Award,
  TrendingUp,
  CalendarDays,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Flame,
  AlertCircle,
  Building2,
  Activity,
  BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];
const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

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

const cascadeItem = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: easeOutCurve },
  },
};

export default function TraineeDashboardClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [chartInView, setChartInView] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trainee/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load trainee dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const traineePermissions: string[] = Array.isArray(data?.permissions) ? data.permissions : [];
  const canRoute = (href: string) => canAccessPortalRoute('TRAINEE', href, traineePermissions, 'TRAINEE');

  const trainee = data?.trainee || {
    firstName: '',
    lastName: '',
    srn: '',
    rank: 'Maritime Trainee',
    currentStreak: 0,
  };

  const currentTraining = data?.currentTraining || null;

  const metrics = data?.metrics || {
    activeCourses: 0,
    completedCourses: 0,
    overallProgress: 0,
    pendingAssessments: 0,
    earnedCertificates: 0,
  };

  const continueLearning = data?.continueLearning || null;

  // Ensure upcoming timetable strictly displays sessions assigned to the trainee's enrolled courses
  const enrolledCourseIds = new Set(
    (data?.myCoursesSummary || [])
      .filter((c: any) =>
        ['ENROLLED', 'ACTIVE', 'ONGOING', 'APPROVED', 'COMPLETED'].includes(
          (c.enrollmentStatus || '').toUpperCase()
        )
      )
      .map((c: any) => c.id)
  );

  const upcomingSchedule = (data?.upcomingSchedule || []).filter((s: any) => {
    const st = (s.status || '').toUpperCase();
    if (s.isCompleted || st === 'COMPLETED' || s.isFailed || st === 'FAILED') {
      return false;
    }
    if (s.endAt && new Date(s.endAt) < new Date()) {
      return false;
    }
    if (data?.myCoursesSummary !== undefined) {
      return enrolledCourseIds.has(s.courseId);
    }
    return true;
  });
  const pendingAssessmentsList = data?.pendingAssessmentsList || [];
  const assessmentVerdicts = data?.assessmentVerdicts || [];
  const recentActivity = data?.recentActivity || [];
  const certificatesSummary = data?.certificatesSummary || [];
  const readyCert = certificatesSummary[0] || null;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Profile Completion Prompt for Trainees without SRN (Sections 5 & 44) */}
      {mounted && !loading && (!trainee.srn || trainee.srn.includes('SRN-PENDING') || trainee.srn.includes('TRN-PENDING')) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-3xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC]">
                  Complete your trainee profile
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  SRN Required
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-[#CBD5E1] font-sans">
                Welcome to NEWSIM. Your account is registered, but your Seafarer's Registration Number has not been added yet. Add your official SRN before enrolling in a course.
              </p>
            </div>
          </div>

          <Link
            href="/settings"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
          >
            <span>COMPLETE PROFILE</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      )}

      {/* Personalized Welcome Banner (Glassmorphism) */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: easeCurve }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_32px_0_rgba(11,61,145,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] transition-all duration-300"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-sky-500/10 via-sky-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 backdrop-blur-md">
                Seafarer Workspace
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 backdrop-blur-md">
                <Flame className="w-3 h-3 fill-amber-500 text-amber-500 animate-pulse" />
                {trainee.currentStreak} Day Learning Streak
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Good day{trainee.firstName ? `, ${trainee.firstName}` : ''}.
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-2xl leading-relaxed font-sans">
              Continue your maritime training journey.
              {continueLearning?.lessonTitle ? (
                <> Next up: <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{continueLearning.lessonTitle}</span> ({currentTraining?.courseCode || 'STCW'}).</>
              ) : (
                ' Explore certified STCW maritime courses and advance your maritime career.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2.5 w-full md:w-auto">
            {continueLearning?.lessonId ? (
              canRoute('/learning') ? (
                <Link
                  href={`/learning?courseId=${continueLearning.courseId}&lessonId=${continueLearning.lessonId}`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Continue Learning</span>
                </Link>
              ) : null
            ) : canRoute('/enrollment') ? (
              <Link
                href="/enrollment"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Enroll in Course</span>
              </Link>
            ) : null}
            {canRoute('/schedules') && (
              <Link
                href="/schedules"
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 hover:border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all active:scale-[0.98] shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 backdrop-blur-md"
              >
                <CalendarDays className="w-4 h-4 text-sky-500" />
                <span>Timetable</span>
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* 4 Key Trainee Metric KPI Cards: Cascading entrance (not in sync) when in view */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
      >
        {/* KPI 1: Active Courses */}
        {canRoute('/my-courses') && (
        <Link href="/my-courses">
          <motion.div
            variants={cascadeItem}
            whileHover={{ y: -4, transition: { duration: 0.2, ease: easeOutCurve } }}
            className="relative p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40 shadow-[0_8px_24px_0_rgba(11,61,145,0.06)] hover:shadow-[0_12px_32px_0_rgba(59,167,242,0.15)] dark:shadow-[0_8px_24px_0_rgba(0,0,0,0.4)] dark:hover:shadow-[0_12px_32px_0_rgba(59,167,242,0.2)] flex flex-col justify-between overflow-hidden transition-all duration-300 h-full cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-[#CBD5E1]">
                  Active Courses
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                  {loading ? '--' : metrics.activeCourses}
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500">
              <span className="text-sky-600 dark:text-sky-400 font-bold">{metrics.completedCourses} Completed</span>
              <span>STCW Programs</span>
            </div>
          </motion.div>
        </Link>
        )}

        {/* KPI 2: Overall Progress */}
        {canRoute('/progress') && (
        <Link href="/progress">
          <motion.div
            variants={cascadeItem}
            whileHover={{ y: -4, transition: { duration: 0.2, ease: easeOutCurve } }}
            className="relative p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40 shadow-[0_8px_24px_0_rgba(11,61,145,0.06)] hover:shadow-[0_12px_32px_0_rgba(59,167,242,0.15)] dark:shadow-[0_8px_24px_0_rgba(0,0,0,0.4)] dark:hover:shadow-[0_12px_32px_0_rgba(59,167,242,0.2)] flex flex-col justify-between overflow-hidden transition-all duration-300 h-full cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-[#CBD5E1]">
                  Overall Progress
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                  {loading ? '--' : `${metrics.overallProgress}%`}
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-slate-900 flex items-center justify-center shadow-md shadow-sky-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500">
              <span className="text-sky-700 dark:text-sky-400 font-bold">
                {metrics.overallProgress >= 75 ? 'Near Completion' : metrics.overallProgress >= 40 ? 'On-Track' : 'In-Progress'}
              </span>
              <span>Milestone {Math.min(4, Math.max(1, Math.ceil((metrics.overallProgress || 1) / 25)))} of 4</span>
            </div>
          </motion.div>
        </Link>
        )}

        {/* KPI 3: Certificates Earned */}
        {canRoute('/certificates') && (
        <Link href="/certificates">
          <motion.div
            variants={cascadeItem}
            whileHover={{ y: -4, transition: { duration: 0.2, ease: easeOutCurve } }}
            className="relative p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40 shadow-[0_8px_24px_0_rgba(11,61,145,0.06)] hover:shadow-[0_12px_32px_0_rgba(127,231,214,0.2)] dark:shadow-[0_8px_24px_0_rgba(0,0,0,0.4)] dark:hover:shadow-[0_12px_32px_0_rgba(127,231,214,0.2)] flex flex-col justify-between overflow-hidden transition-all duration-300 h-full cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-[#CBD5E1]">
                  Certificates Earned
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                  {loading ? '--' : metrics.earnedCertificates}
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {metrics.earnedCertificates > 0 ? "Ready for Claim" : "STCW Compliant"}
              </span>
              <span>Claim Personally</span>
            </div>
          </motion.div>
        </Link>
        )}

        {/* KPI 4: Pending Assessments */}
        {canRoute('/assessments') && (
        <Link href="/assessments">
          <motion.div
            variants={cascadeItem}
            whileHover={{ y: -4, transition: { duration: 0.2, ease: easeOutCurve } }}
            className="relative p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40 shadow-[0_8px_24px_0_rgba(11,61,145,0.06)] hover:shadow-[0_12px_32px_0_rgba(245,158,11,0.15)] dark:shadow-[0_8px_24px_0_rgba(0,0,0,0.4)] dark:hover:shadow-[0_12px_32px_0_rgba(245,158,11,0.2)] flex flex-col justify-between overflow-hidden transition-all duration-300 h-full cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-[#CBD5E1]">
                  Pending Exam / Drills
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                  {loading ? '--' : metrics.pendingAssessments}
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-500/25">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500">
              <span className={metrics.pendingAssessments > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                {metrics.pendingAssessments > 0 ? "Action Required" : "All Caught Up"}
              </span>
              <span>{metrics.pendingAssessments > 0 ? "Due This Week" : "Evaluations Cleared"}</span>
            </div>
          </motion.div>
        </Link>
        )}
      </motion.div>

      {/* Interactive Learning Velocity & Performance Telemetry Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        onViewportEnter={() => setChartInView(true)}
        transition={{ duration: 0.5, ease: easeOutCurve }}
        className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_32px_0_rgba(11,61,145,0.06)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] relative overflow-hidden space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-500" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                Daily Study Momentum &amp; Assessment Benchmark
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-sans">
              Assessment score verdicts from your submitted exams &amp; quizzes vs the 75% STCW passing benchmark.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                <span>Assessment Score</span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>75% Pass Benchmark</span>
              </span>
            </div>
            {canRoute('/progress') && (
              <Link
                href="/progress"
                className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>Full Telemetry →</span>
              </Link>
            )}
          </div>
        </div>

        <div className="h-44 w-full">
          {assessmentVerdicts.length === 0 ? (
            <div className="h-full w-full rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center px-4 gap-2">
              <BarChart2 className="w-6 h-6 text-slate-400" />
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                  No assessment score verdicts yet
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                  Complete a module quiz or course assessment to plot your verified score verdict here.
                </p>
              </div>
              {canRoute('/assessments') && (
                <Link
                  href="/assessments"
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-sky-600 dark:text-sky-400 hover:underline pt-0.5"
                >
                  <span>Go to Assessments</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="dash-score-chart"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: easeOutCurve }}
              className="w-full h-full"
            >
              <ImmersiveChartFrame
                ready={mounted && !loading}
                triggerKey={`trainee-dash-${assessmentVerdicts.length}-${chartInView ? 'in' : 'wait'}`}
                duration={1.9}
                className="w-full h-full"
              >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={assessmentVerdicts}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="dashScoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.2 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 50, 75, 100]}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        const passed = item.verdict === 'PASSED' || Number(item.score) >= Number(item.passingScore ?? 75);
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-xl text-xs space-y-1 font-mono">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-sky-400">{item.day}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {item.verdict || (passed ? 'PASSED' : 'FAILED')}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300 font-sans line-clamp-1">{item.title}</div>
                            <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
                              <span className="text-slate-400">Verdict Score:</span>
                              <span className={`font-bold ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>{item.score}%</span>
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
                    label={{ value: '75% Pass', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fillOpacity={1}
                    fill="url(#dashScoreGradient)"
                    isAnimationActive={true}
                    animationDuration={1850}
                    animationEasing="ease-out"
                    activeDot={{ r: 5, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              </ImmersiveChartFrame>
            </motion.div>
          </AnimatePresence>
          )}
        </div>
      </motion.div>

      {/* Main Row: Continue Learning Active Card + Upcoming Schedule (Glassmorphic) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Continue Learning Priority Card (2 Columns Span) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, ease: easeCurve }}
          className="lg:col-span-2 p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_32px_0_rgba(11,61,145,0.06)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] flex flex-col justify-between relative overflow-hidden transition-all duration-300"
        >
          {continueLearning && currentTraining ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 backdrop-blur-md">
                      {continueLearning.courseCode || currentTraining.courseCode}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      Last accessed: {continueLearning.lastAccessed}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 backdrop-blur-md">
                    Lesson {continueLearning.lessonNumber} of {continueLearning.totalLessons}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {continueLearning.lessonTitle || continueLearning.moduleName || continueLearning.courseTitle || 'Active Module'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-[#CBD5E1] font-mono mt-1">
                    {continueLearning.moduleName} • {continueLearning.courseTitle}
                  </p>
                </div>

                {/* Progress Track */}
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-[#CBD5E1]">
                    <span>Progress</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">{continueLearning.progressPercent}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-50 dark:bg-slate-900/60 overflow-hidden border border-slate-200/80 dark:border-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${continueLearning.progressPercent || 0}%` }}
                      transition={{ type: 'spring', stiffness: 90, damping: 18 }}
                      className="h-full bg-gradient-to-r from-sky-500 to-teal-500 rounded-full"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-500" />
                  <span>Est. completion: 15 minutes</span>
                </div>
                {canRoute('/learning') && (
                  <Link
                    href={`/learning?courseId=${continueLearning.courseId}&lessonId=${continueLearning.lessonId}`}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all"
                  >
                    <span>{continueLearning.progressPercent >= 100 ? 'Review Module' : 'Resume Study Session'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center mx-auto text-sky-600 dark:text-sky-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                  No Active Course in Progress
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-sans">
                  Apply for an STCW accredited training program to access simulator modules, lessons, and schedules.
                </p>
              </div>
              {canRoute('/enrollment') && (
                <Link
                  href="/enrollment"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 hover:opacity-95 transition-all"
                >
                  <span>Browse Available Courses</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          )}
        </motion.div>

        {/* Upcoming Training Sessions Preview (1 Column, Glassmorphic) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, ease: easeCurve, delay: 0.05 }}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_32px_0_rgba(11,61,145,0.06)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] flex flex-col justify-between relative overflow-hidden transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-sky-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                  Upcoming Timetable
                </h3>
              </div>
              {canRoute('/schedules') && (
                <Link href="/schedules" className="text-xs text-sky-500 hover:text-slate-900 hover:underline font-mono">
                  Full Calendar →
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {upcomingSchedule.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center mx-auto text-sky-600 dark:text-sky-400">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    No upcoming sessions for your enrolled courses.
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.15 }}
                  className="space-y-3"
                >
                  {upcomingSchedule.map((s: any, idx: number) => {
                    const isDaily = s.type === 'DAILY_ONLINE_MODULE';
                    return (
                      <motion.div
                        key={s.id || idx}
                        variants={cascadeItem}
                        className={`p-3 rounded-2xl border space-y-1 backdrop-blur-md shadow-xs ${
                          s.isDueToday
                            ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20'
                            : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className={`font-bold ${isDaily ? 'text-sky-600 dark:text-sky-400' : 'text-amber-500'}`}>
                            {isDaily ? `${s.sessionCode || 'MODULE'} • ${s.formattedDate || s.date}` : `PRACTICAL • ${s.formattedDate || s.date}`}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {s.isSetTime ? s.time : (s.isDueToday ? '🔔 Due Today' : (s.isCompleted ? '✓ Completed' : 'Online'))}
                          </span>
                        </div>
                        <div className="font-bold text-xs text-slate-900 dark:text-[#F8FAFC] truncate">
                          {isDaily ? s.moduleTitle : s.courseTitle}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                          {isDaily ? (
                            <span>Course: {s.courseTitle}</span>
                          ) : (
                            <>
                              <UserAvatar
                                src={s.instructorAvatarUrl}
                                name={s.instructorName || 'TBA'}
                                alt={s.instructorName || 'Instructor'}
                                className="w-4 h-4 rounded-md"
                                fallbackClassName="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[8px] font-bold"
                              />
                              <span>Instructor: {s.instructorName || 'TBA'} • {s.room}</span>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>NEWSIM Talisay Training Center</span>
            <span className={upcomingSchedule.length > 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-400 font-medium"}>
              {upcomingSchedule.length > 0 ? "Room Confirmed ✓" : "No Active Sessions"}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Second Row: Pending Assessments + Recent Activity + Certificate Summary (Glassmorphic) */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {/* Pending Assessments */}
        <motion.div
          variants={cascadeItem}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_32px_0_rgba(11,61,145,0.06)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] flex flex-col justify-between relative overflow-hidden transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                  Required Assessments
                </h3>
              </div>
              {canRoute('/assessments') && (
                <Link href="/assessments" className="text-xs text-sky-500 hover:text-slate-900 hover:underline font-mono">
                  View All →
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {pendingAssessmentsList.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center mx-auto text-sky-600 dark:text-sky-400">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    All required assessments completed.
                  </p>
                </div>
              ) : (
                pendingAssessmentsList.map((a: any, idx: number) => (
                  <div
                    key={a.id || idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5 backdrop-blur-md shadow-xs"
                  >
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{a.code}</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Pass: {a.passingScore}/{a.totalPoints || 100}</span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-[#CBD5E1] font-sans font-medium line-clamp-1">
                      {a.title}
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] font-mono text-slate-500">{a.durationMinutes} mins</span>
                      {canRoute('/assessments') && (
                        <Link
                          href={`/assessments?assessmentId=${a.id}`}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-colors"
                        >
                          Start Exam →
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>STCW Standard</span>
            <span className={pendingAssessmentsList.length > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
              {pendingAssessmentsList.length > 0 ? `${pendingAssessmentsList.length} Exam${pendingAssessmentsList.length === 1 ? '' : 's'} Pending` : "All Exams Completed ✓"}
            </span>
          </div>
        </motion.div>

        {/* Recent Activity Timeline */}
        <motion.div
          variants={cascadeItem}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_32px_0_rgba(11,61,145,0.06)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] space-y-4 relative overflow-hidden transition-all duration-300"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
              Recent Activity
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Past 7 Days</span>
          </div>

          <div className="space-y-3">
            {recentActivity.map((act: any, idx: number) => (
              <div key={act.id || idx} className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{act.title}</div>
                  <div className="text-[11px] text-slate-600 dark:text-[#CBD5E1] line-clamp-1">{act.description}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{act.time}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Certificates & Achievements */}
        <motion.div
          variants={cascadeItem}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_32px_0_rgba(11,61,145,0.06)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] flex flex-col justify-between relative overflow-hidden transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                  Earned Certificates
                </h3>
              </div>
              {canRoute('/certificates') && (
                <Link href="/certificates" className="text-xs text-sky-500 hover:text-slate-900 hover:underline font-mono">
                  View →
                </Link>
              )}
            </div>

            {readyCert ? (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#7FE7D6]/15 via-[#3BA7F2]/10 to-transparent border border-sky-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-sky-700 dark:text-sky-400">
                    {readyCert.certificateNo}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    READY FOR CLAIM
                  </span>
                </div>

                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-[#F8FAFC]">
                    {readyCert.courseTitle}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Issued: {readyCert.issueDate} • Valid to {readyCert.expiryDate}
                  </div>
                </div>

                {/* Personal Claim Guidance Banner */}
                <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2">
                  <Building2 className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-slate-600 dark:text-[#CBD5E1] font-sans leading-tight">
                    <strong className="text-sky-700 dark:text-sky-400">Personal Claim:</strong> Official dry-sealed certificate must be claimed personally at the NEWSIM Campus Registrar (Room 204). Bring valid ID & SRN.
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center mx-auto text-sky-600 dark:text-sky-400">
                  <ShieldCheck className="w-5 h-5 text-sky-500" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-[#CBD5E1]">No Certificates Ready Yet</p>
                <p className="text-[11px] font-mono text-slate-400">Complete course practicals to release certificate for campus claim.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">
              {certificatesSummary.length} Ready Credential{certificatesSummary.length === 1 ? '' : 's'}
            </span>
            {canRoute('/certificates') && (
              <Link href="/certificates" className="text-sky-500 hover:text-slate-900 font-bold hover:underline flex items-center gap-1">
                <span>Personal Claim Details →</span>
              </Link>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

