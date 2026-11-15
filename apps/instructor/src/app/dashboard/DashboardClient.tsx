'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, DashboardSkeleton, ImmersiveChartFrame, UserAvatar } from '@newsim/ui';
import { canAccessPortalRoute } from '@newsim/utils';
import {
  Compass,
  BookOpen,
  Users,
  Award,
  GraduationCap,
  CalendarCheck2,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Building2,
  Bell,
  Layers,
  FileCheck,
  TrendingUp,
  BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function InstructorDashboardClient() {
  const { resolvedTheme } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState<'PROGRESS' | 'ATTENDANCE' | 'GRADE'>('PROGRESS');
  const [chartInView, setChartInView] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/instructor/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load instructor dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const overview = data?.overview || {
    totalAssignedCourses: 0,
    activeCourses: 0,
    upcomingCourses: 0,
    completedCourses: 0,
    totalAssignedTrainees: 0,
    pendingGradingCount: 0,
    atRiskCount: 0,
    completedCount: 0,
    averageCourseProgress: 0,
    traineesOnTrackRate: 0,
  };

  const todaySessions = data?.todaySessions || [];
  const recentSubmissions = data?.recentSubmissions || [];
  const notifications = data?.notifications || [];
  const instructorPermissions: string[] = Array.isArray(data?.permissions) ? data.permissions : [];
  const canRoute = (href: string) => canAccessPortalRoute('INSTRUCTOR', href, instructorPermissions, 'INSTRUCTOR');
  const quickLaunchItems = [
    { label: 'My Courses', href: '/my-courses', icon: BookOpen },
    { label: 'Record Attendance', href: '/attendance', icon: CalendarCheck2 },
    { label: 'Grade Assessments', href: '/assessments', icon: Award },
    { label: 'View Trainees', href: '/trainees', icon: Users },
    { label: 'View Progress', href: '/progress', icon: GraduationCap },
  ].filter((act) => canRoute(act.href));

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Hero Header Banner (Glassmorphism) */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_32px_0_rgba(99,102,241,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] transition-all duration-300"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-sky-500/10 via-sky-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 backdrop-blur-md">
                Instruction & Simulation Command
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-800 backdrop-blur-md">
                <span className={`w-1.5 h-1.5 rounded-full ${overview.activeCourses > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {overview.activeCourses > 0 ? 'Active Teaching Session' : 'Standby Mode'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Instructor Command Center
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-2xl leading-relaxed font-sans">
              Welcome back. Deliver STCW training, conduct simulator scenarios, grade submissions, and track seafarer cohort progress.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2.5 w-full md:w-auto">
            {canRoute('/attendance') && (
              <Link
                href="/attendance"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-md shadow-sky-500/20 transition-all active:scale-[0.98]"
              >
                <CalendarCheck2 className="w-4 h-4" />
                <span>Record Attendance</span>
              </Link>
            )}
            {canRoute('/grades') && (
              <Link
                href="/grades"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/20 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all active:scale-[0.98] shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 backdrop-blur-md"
              >
                <GraduationCap className="w-4 h-4 text-sky-500" />
                <span>Gradebook Matrix</span>
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quick Action Navigation Bar (Glassmorphic) */}
      {quickLaunchItems.length > 0 && (
        <div className="p-3 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_24px_0_rgba(0,0,0,0.04)] flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 px-2 shrink-0">Quick Launch:</span>
          {quickLaunchItems.map((act, idx) => {
            const Icon = act.icon;
            return (
              <Link
                key={idx}
                href={act.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-mono font-bold text-slate-600 dark:text-[#CBD5E1] bg-slate-50 dark:bg-slate-800 hover:bg-sky-600 hover:text-white dark:hover:bg-slate-700 transition-all whitespace-nowrap shadow-sm border border-slate-200/50 dark:border-slate-800 backdrop-blur-md"
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{act.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* 4 Top KPI Cards (Glassmorphism) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          {
            label: 'Assigned Courses',
            value: loading ? '--' : overview.totalAssignedCourses,
            primary: `${overview.activeCourses} Active Teaching`,
            secondary: `${overview.upcomingCourses} Upcoming`,
          },
          {
            label: 'Assigned Trainees',
            value: loading ? '--' : overview.totalAssignedTrainees,
            primary: `${overview.totalAssignedTrainees} Active Trainees`,
            secondary: 'Active Roster',
          },
          {
            label: 'Pending Grading',
            value: loading ? '--' : overview.pendingGradingCount,
            primary: `${overview.pendingGradingCount} Pending Review`,
            secondary: 'Practical Exams',
          },
          {
            label: 'On-Track Rate',
            value: loading ? '--' : `${overview.traineesOnTrackRate}%`,
            primary: `${overview.atRiskCount} Trainee At Risk`,
            secondary: `${overview.completedCount} Certified`,
          },
        ].map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, ease: easeCurve, delay: 0.05 * (idx + 1) }}
            whileHover={{ y: -4 }}
            className="relative p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_24px_0_rgba(0,0,0,0.05)] hover:shadow-[0_12px_32px_0_rgba(59,167,242,0.15)] dark:shadow-[0_8px_24px_0_rgba(0,0,0,0.4)] dark:hover:shadow-[0_12px_32px_0_rgba(59,167,242,0.2)] flex flex-col justify-between overflow-hidden transition-all duration-300"
          >
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-[#CBD5E1]">
                {card.label}
              </span>
              <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-[#F8FAFC] font-heading tracking-tight leading-none">
                {card.value}
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
              <span className="text-sky-600 dark:text-sky-400 font-bold">{card.primary}</span>
              <span>{card.secondary}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 3-Column Split: Today's Schedule, Today's Attendance, Trainee Progress Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Today's Teaching Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, ease: easeCurve }}
          className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-sky-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                  Today&apos;s Training Schedule
                </h3>
              </div>
              {canRoute('/schedules') && (
                <Link href="/schedules" className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-mono">
                  Full Calendar →
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {todaySessions.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">
                  No upcoming sessions for today.
                </div>
              ) : (
                todaySessions.map((s: any, idx: number) => (
                  <motion.div
                    key={s.id || idx}
                    initial={{ opacity: 0, x: -6 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.25, delay: idx * 0.05 }}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-sky-500/20 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
                          {s.startTime}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-200 dark:bg-slate-800 font-bold">
                          {s.room}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-[#F8FAFC] truncate">
                        {s.courseTitle}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {s.enrolledCount ?? 0} Seafarers Enrolled
                      </p>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
                      {s.status}
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>{todaySessions.length} Sessions Scheduled</span>
            <span className="text-sky-600 dark:text-sky-400 font-bold">Classroom & Simulators</span>
          </div>
        </motion.div>

        {/* Column 2: Today's Attendance Overview */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, ease: easeCurve, delay: 0.05 }}
          className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20 shadow-inner">
                  <CalendarCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                    Today&apos;s Attendance
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-sky-600 dark:text-sky-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-600" />
                    </span>
                    Classroom Roll-Call
                  </div>
                </div>
              </div>
              {canRoute('/attendance') && (
                <Link href="/attendance" className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-mono font-semibold">
                  Record →
                </Link>
              )}
            </div>

            {data?.todayAttendance && data.todayAttendance.totalSessions > 0 ? (
              <>
                {/* Circular Animated Radial Quorum Meter */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className="my-3 p-3.5 rounded-2xl bg-gradient-to-br from-sky-500/5 via-sky-500/5 to-transparent border border-sky-500/20 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                      <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-200 dark:text-[#F8FAFC]/10"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <motion.path
                          className="text-sky-500"
                          strokeDasharray="100, 100"
                          initial={{ strokeDashoffset: 100 }}
                          animate={{
                            strokeDashoffset:
                              100 - (data.todayAttendance.attendanceBreakdown?.present || 0),
                          }}
                          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-[#F8FAFC] leading-none tabular-nums">
                          {data.todayAttendance.attendanceBreakdown?.present || 0}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Roll-call Quorum</span>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                        {data.todayAttendance.completedSessions} / {data.todayAttendance.totalSessions}{' '}
                        <span className="text-xs font-normal text-slate-500 font-mono">Sessions Complete</span>
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-1 rounded-xl text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    {data.todayAttendance.pendingSessions || 0} Pending
                  </span>
                </motion.div>

                {/* Attendance Progress Bars */}
                <div className="space-y-2.5">
                  <motion.div whileHover={{ x: 2 }} className="p-1.5 -mx-1.5 rounded-xl hover:bg-sky-500/5 transition-colors">
                    <div className="flex justify-between text-xs font-mono mb-1 text-slate-600 dark:text-[#CBD5E1]">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Present (
                        {data.todayAttendance.attendanceBreakdown?.present || 0}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${data.todayAttendance.attendanceBreakdown?.present || 0}%`,
                        }}
                        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
                        className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full"
                      />
                    </div>
                  </motion.div>
                </div>
              </>
            ) : (
              <div className="my-8 py-6 flex flex-col items-center justify-center text-center space-y-2">
                <CalendarCheck2 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-mono text-slate-400">No attendance roll-calls recorded for today.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Roll-call Quorum: {data?.todayAttendance?.attendanceBreakdown?.present || 0}%</span>
            {canRoute('/attendance') && (
              <Link href="/attendance" className="text-sky-600 dark:text-sky-400 font-bold hover:underline">
                Take Attendance →
              </Link>
            )}
          </div>
        </motion.div>

        {/* Column 3: Pending Assessment Grading Queue */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, ease: easeCurve, delay: 0.1 }}
          className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                  Submissions To Grade
                </h3>
              </div>
              {canRoute('/assessments') && (
                <Link href="/assessments" className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-mono">
                  View All →
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {recentSubmissions.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">
                  No assessment submissions awaiting grading.
                </div>
              ) : (
                recentSubmissions.map((sub: any, idx: number) => (
                  <motion.div
                    key={sub.id || idx}
                    initial={{ opacity: 0, x: -6 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.25, delay: idx * 0.05 }}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-amber-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        src={sub.traineeAvatarUrl}
                        name={sub.traineeName}
                        alt={sub.traineeName || 'Trainee'}
                        className="w-8 h-8 rounded-xl"
                        fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                      />
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-[#F8FAFC] truncate">
                          {sub.traineeName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {sub.assessmentTitle}
                        </div>
                      </div>
                    </div>

                    {canRoute('/grades') && (
                      <Link
                        href="/grades"
                        className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-sky-600 hover:bg-sky-700 text-white shrink-0 shadow-sm"
                      >
                        {sub.status === 'SUBMITTED' ? 'Score' : 'Review'}
                      </Link>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Pass Threshold: 80%</span>
            <span className="text-sky-600 dark:text-sky-400 font-bold">STCW Benchmark</span>
          </div>
        </motion.div>
      </div>

      {/* Trainee Progress & Notification Stream Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trainee Progress Telemetry Table (2 Columns Span) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, ease: easeCurve }}
          className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                Trainee Progress & Cohort Telemetry
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#CBD5E1] font-mono mt-0.5">
                Module completion tracking, attendance ratings, and at-risk early detection
              </p>
            </div>
            {canRoute('/progress') && (
              <Link
                href="/progress"
                className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Full Analytics →
              </Link>
            )}
          </div>

          {/* Interactive Cohort Progress Chart */}
          {(() => {
            const rawList = data?.traineeProgressList || [];
            const chartData = rawList.slice(0, 8).map((t: any) => ({
              name: (t.traineeName || 'Trainee').split(' ')[0],
              fullName: t.traineeName || 'Maritime Trainee',
              course: t.courseCode || 'STCW',
              progress: t.progressPercent ?? 0,
              attendance: t.attendanceRate ?? 100,
              grade: t.averageGrade ?? 0,
            }));

            return (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                onViewportEnter={() => setChartInView(true)}
                transition={{ duration: 0.45, ease: easeCurve }}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sky-500" />
                    <span className="font-extrabold text-xs text-slate-900 dark:text-[#F8FAFC] font-heading">
                      Cohort Telemetry Visualizer
                    </span>
                  </div>
                  <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-[10px] font-mono font-bold">
                    <button
                      onClick={() => setChartMetric('PROGRESS')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        chartMetric === 'PROGRESS'
                          ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Progress %
                    </button>
                    <button
                      onClick={() => setChartMetric('ATTENDANCE')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        chartMetric === 'ATTENDANCE'
                          ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Attendance %
                    </button>
                    <button
                      onClick={() => setChartMetric('GRADE')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        chartMetric === 'GRADE'
                          ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Avg Grade %
                    </button>
                  </div>
                </div>

                {chartData.length === 0 ? (
                  <div className="h-44 w-full flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-500 dark:text-slate-400">
                    No active trainee telemetry recorded for your assigned courses yet.
                  </div>
                ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={chartMetric}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.35, ease: easeCurve }}
                    className="h-44 w-full"
                  >
                    <ImmersiveChartFrame
                      ready={!loading && Boolean(data)}
                      triggerKey={`inst-dash-${chartMetric}-${chartInView ? 'in' : 'wait'}`}
                      duration={1.85}
                      className="w-full h-full"
                    >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
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
                              return (
                                <div className="p-2.5 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-xl text-xs space-y-1 font-mono">
                                  <div className="font-bold text-sky-400">{item.fullName}</div>
                                  <div className="text-[10px] text-slate-400">Course: {item.course}</div>
                                  <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
                                    <span className="text-slate-400">
                                      {chartMetric === 'PROGRESS' ? 'Progress:' : chartMetric === 'ATTENDANCE' ? 'Attendance:' : 'Avg Grade:'}
                                    </span>
                                    <span className="font-bold text-emerald-400">
                                      {chartMetric === 'PROGRESS' ? `${item.progress}%` : chartMetric === 'ATTENDANCE' ? `${item.attendance}%` : `${item.grade}%`}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <ReferenceLine
                          y={chartMetric === 'ATTENDANCE' ? 80 : 75}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          label={{
                            value: chartMetric === 'ATTENDANCE' ? '80% Quorum' : '75% Pass Benchmark',
                            fill: '#f59e0b',
                            fontSize: 9,
                            position: 'insideTopRight'
                          }}
                        />
                        <Bar
                          dataKey={chartMetric === 'PROGRESS' ? 'progress' : chartMetric === 'ATTENDANCE' ? 'attendance' : 'grade'}
                          radius={[6, 6, 0, 0]}
                          isAnimationActive={true}
                          animationDuration={1800}
                          animationEasing="ease-out"
                        >
                          {chartData.map((entry: any, index: number) => {
                            const val = chartMetric === 'PROGRESS' ? entry.progress : chartMetric === 'ATTENDANCE' ? entry.attendance : entry.grade;
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={val >= (chartMetric === 'ATTENDANCE' ? 80 : 75) ? '#0284c7' : '#f59e0b'}
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    </ImmersiveChartFrame>
                  </motion.div>
                </AnimatePresence>
                )}
              </motion.div>
            );
          })()}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-[#CBD5E1] font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Seafarer</th>
                  <th className="py-2.5 px-3 font-bold">Course Program</th>
                  <th className="py-2.5 px-3 font-bold">Progress</th>
                  <th className="py-2.5 px-3 font-bold">Attendance</th>
                  <th className="py-2.5 px-3 font-bold">Avg Grade</th>
                  <th className="py-2.5 px-3 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {(data?.traineeProgressList || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs font-mono text-slate-400">
                      No trainee progress telemetry records available.
                    </td>
                  </tr>
                ) : (
                  (data?.traineeProgressList || []).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            src={p.traineeAvatarUrl}
                            name={p.traineeName}
                            alt={p.traineeName || 'Trainee'}
                            className="w-7 h-7 rounded-lg"
                            fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC] font-sans">{p.traineeName}</div>
                            <div className="text-[10px] text-slate-400">{p.srn} • {p.rank}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-700 dark:text-[#CBD5E1]">
                        {p.courseTitle}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${p.progressPercent || 0}%` }}
                              transition={{ type: 'spring', stiffness: 90, damping: 18 }}
                              className="h-full bg-sky-600 rounded-full"
                            />
                          </div>
                          <span className="font-bold text-[11px] tabular-nums">{p.progressPercent}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                        {p.attendanceRate}
                      </td>
                      <td className="py-3 px-3 font-bold">
                        {p.averageGrade} pts
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          p.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : p.status === 'ON_TRACK'
                            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                            : 'bg-rose-500/15 text-rose-600 animate-pulse'
                        }`}>
                          {(p.status || 'ON_TRACK').replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Notifications & Admin Broadcasts (1 Column) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, ease: easeCurve, delay: 0.1 }}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-500" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                Operational Dispatch
              </h3>
            </div>
            <Link href="/notifications" className="text-xs font-mono text-sky-600 dark:text-sky-400 hover:underline">
              All →
            </Link>
          </div>

          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-slate-400">
                No active notifications or operational dispatches.
              </div>
            ) : (
              notifications.map((n: any, idx: number) => (
                <div
                  key={n.id || idx}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-[#F8FAFC] truncate">
                      {n.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-[#CBD5E1] line-clamp-2">
                    {n.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

