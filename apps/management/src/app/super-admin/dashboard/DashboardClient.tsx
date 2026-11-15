'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Users,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  PlusCircle,
  Download,
  CheckCircle2,
  CreditCard,
  UserCheck,
  Sparkles,
  BarChart3,
  LineChart as LucideLineChart,
  List
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import * as Avatar from '@radix-ui/react-avatar';
import { useTheme, ImmersiveChartFrame, UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];
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

const LiveClock = React.memo(function LiveClock() {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
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
            year: 'numeric',
          })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!currentTime) return null;

  return (
    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {currentTime}
    </span>
  );
});

export default function DashboardClient() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [chartMode, setChartMode] = useState<'COMBINED' | 'TRAINEES' | 'ENROLLMENTS'>('COMBINED');

  // Graph Type Options (Line, Bar)
  const [primaryGraphType, setPrimaryGraphType] = useState<'line' | 'bar'>('line');
  const [trajectoryGraphType, setTrajectoryGraphType] = useState<'line' | 'bar'>('line');
  const [campusGraphType, setCampusGraphType] = useState<'list' | 'bar'>('list');
  const [settlementGraphType, setSettlementGraphType] = useState<'cards' | 'bar'>('cards');
  const [hoveredTrajectorySeries, setHoveredTrajectorySeries] = useState<'trainees' | 'enrollments' | null>(null);
  const [hoveredFunnelStage, setHoveredFunnelStage] = useState<number | null>(null);
  const [primaryChartInView, setPrimaryChartInView] = useState(false);
  const [trajectoryChartInView, setTrajectoryChartInView] = useState(false);
  const [campusChartInView, setCampusChartInView] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      try {
        const res = await fetch(`/api/super-admin/analytics?timeRange=${timeRange}`);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard metrics', err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, [timeRange]);

  if (loading && !data) {
    return (
      <div className="space-y-6 sm:space-y-8 xl:space-y-10 animate-pulse pb-8">
        {/* 1. Immersive Command Header */}
        <div className="p-6 rounded-3xl bg-white/75 dark:bg-[#0c1a2c] backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 h-32">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-slate-200 dark:bg-slate-800" />
          <div className="relative z-10 w-full">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-full mb-3" />
            <div className="h-10 w-3/4 max-w-lg bg-slate-200 dark:bg-slate-800 rounded-lg mb-3" />
            <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
          <div className="w-full sm:w-auto shrink-0 mt-4 md:mt-0 flex gap-2">
            <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>

        {/* 2. Top Tier Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 xl:gap-8 min-h-[22rem]">
          <div className="lg:col-span-7 p-6 sm:p-8 xl:p-10 rounded-3xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-center mb-10">
              <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="h-16 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl mb-6" />
            <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl mb-auto" />
            <div className="h-32 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-xl mt-8" />
          </div>

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


        {/* 5. Governance Audit Ledger Skeleton */}
        <div className="rounded-2xl bg-white/80 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-5 w-64 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3.5 w-80 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-10 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const kpis = data?.userOverview || {};
  const paymentOverview = data?.paymentOverview || {};
  const trainingOverview = data?.trainingOverview || {};
  const pipeline = data?.enrollmentPipeline || {};
  const securityOverview = data?.securityOverview || {};

  const currentChartData = data?.chartData || [];
  const recentTransactions = data?.recentTransactions || [];
  const revenueByCenter = data?.paymentOverview?.revenueByCenter || [];
  const paymentMethods = data?.paymentOverview?.paymentMethodsBreakdown || [];

  const renderTrajectoryTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const traineeItem = payload.find((p: any) => p.dataKey === 'trainees');
    const enrollmentItem = payload.find((p: any) => p.dataKey === 'enrollments' || p.dataKey === 'totalEnrollments');
    return (
      <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md shadow-xl text-xs space-y-2 min-w-[190px]">
        <div className="font-mono font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] pb-1 border-b border-slate-100 dark:border-slate-800">
          {label}
        </div>
        {traineeItem && (
          <div className="flex items-center justify-between gap-3 text-sky-600 dark:text-sky-400 font-semibold font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              Seafarers:
            </span>
            <span>{Number(traineeItem.value || 0).toLocaleString()} Registered</span>
          </div>
        )}
        {enrollmentItem && (
          <div className="flex items-center justify-between gap-3 text-teal-600 dark:text-teal-400 font-semibold font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              Enrollments:
            </span>
            <span>{Number(enrollmentItem.value || 0).toLocaleString()} Total</span>
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Executive Command Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/80">
              Executive Governance
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-heading flex items-center gap-2.5">
            <span>Executive Command & Analytics</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              ENTERPRISE
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            Real-time platform oversight for NEWSIM Talisay Training Center, simulation throughput, financial revenue, and enterprise security.
          </p>
          <div className="pt-1">
            <LiveClock />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10 shrink-0 w-full lg:w-auto">
          {/* Time range selector */}
          <div className="flex w-full sm:w-auto justify-between sm:justify-start bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-1 rounded-xl">
            {[
              { label: '7D', value: '7d' },
              { label: '30D', value: '30d' },
              { label: '90D', value: '90d' },
              { label: '1Y', value: '1y' },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setTimeRange(item.value)}
                className={`flex-1 sm:flex-initial text-center px-3.5 py-1 text-xs font-mono rounded-lg font-medium transition-all cursor-pointer ${
                  timeRange === item.value
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 w-full lg:w-auto">
            <Link href="/super-admin/admins" className="w-full lg:w-auto">
              <button className="w-full justify-center h-9 px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer">
                <PlusCircle className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Provision Admin</span>
              </button>
            </Link>

            <Link href="/super-admin/reports" className="w-full lg:w-auto">
              <button className="w-full justify-center h-9 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer">
                <Download className="w-3.5 h-3.5" />
                <span>Export Reports</span>
              </button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* 2. Metrics Bento Grid: Primary Monthly Gross + 3 Secondary KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Primary Card */}
        <div className="lg:col-span-7 flex">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            onViewportEnter={() => setPrimaryChartInView(true)}
            transition={{ duration: 0.45, ease: easeOutCurve }}
            className="w-full h-full relative p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between space-y-4 group"
          >
            <div className="flex justify-between items-center relative z-10">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">
                Total Platform Seafarers
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setPrimaryGraphType('line')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                      primaryGraphType === 'line'
                        ? 'bg-white dark:bg-slate-700 font-bold text-sky-600 dark:text-sky-400 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="Line Graph"
                  >
                    <LucideLineChart className="w-3 h-3" />
                    <span>Line</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrimaryGraphType('bar')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                      primaryGraphType === 'bar'
                        ? 'bg-white dark:bg-slate-700 font-bold text-sky-600 dark:text-sky-400 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="Bar Graph"
                  >
                    <BarChart3 className="w-3 h-3" />
                    <span>Bar</span>
                  </button>
                </div>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>
            </div>

            <div className="mt-auto flex flex-col relative z-10">
              <div className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums leading-tight">
                {kpis.totalAccounts || kpis.activeTrainees || 0}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold font-mono tabular-nums leading-tight bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60 inline-flex w-fit">
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  <span>{kpis.activeTrainees || 0} Active Cohort Seafarers</span>
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">
                  Faculty: {kpis.instructors || 0} Instructors
                </span>
              </div>

              <div className="h-36 sm:h-44 xl:h-48 w-full mt-4 -mx-2 relative overflow-hidden">
                {!mounted || (!data && loading) ? (
                  <div className="w-full h-full flex items-end px-2 pb-2">
                    <div className="w-full h-24 sm:h-28 rounded-xl bg-gradient-to-t from-sky-500/15 via-sky-500/5 to-transparent animate-pulse flex items-center justify-center">
                      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />
                    </div>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`primary-graph-entry-${primaryGraphType}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.35, ease: easeOutCurve }}
                      className={`w-full h-full transition-opacity duration-300 ${loading ? 'opacity-70' : 'opacity-100'}`}
                    >
                    <ImmersiveChartFrame
                      ready={mounted && !loading && Boolean(data)}
                      triggerKey={`primary-${primaryGraphType}-${primaryChartInView ? 'in' : 'wait'}`}
                      duration={1.9}
                      className="w-full h-full"
                    >
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      {primaryGraphType === 'line' ? (
                        <AreaChart
                          data={currentChartData}
                          margin={{ top: 10, right: 6, left: 6, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="primarySparklineGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0284c7" stopOpacity={0.42} />
                              <stop offset="65%" stopColor="#0284c7" stopOpacity={0.14} />
                              <stop offset="100%" stopColor="#0284c7" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <Tooltip
                            cursor={{ stroke: '#0284c7', strokeWidth: 1.5, strokeDasharray: '3 3', strokeOpacity: 0.6 }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const pt = payload[0];
                              return (
                                <div className="px-3 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md shadow-xl text-[11px] font-mono space-y-0.5">
                                  <span className="text-slate-400 block text-[10px] font-bold">{pt.payload?.name}</span>
                                  <span className="text-sky-600 dark:text-sky-400 font-bold tabular-nums">{Number(pt.value || 0).toLocaleString()} Registered Trainees</span>
                                </div>
                              );
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="trainees"
                            stroke="#0284c7"
                            fill="url(#primarySparklineGrad)"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            dot={false}
                            activeDot={{ r: 6, fill: '#fff', stroke: '#0284c7', strokeWidth: 2.5 }}
                            isAnimationActive={true}
                            animationBegin={0}
                            animationDuration={1850}
                            animationEasing="ease-out"
                          />
                        </AreaChart>
                      ) : (
                        <BarChart
                          data={currentChartData}
                          margin={{ top: 10, right: 6, left: 6, bottom: 0 }}
                        >
                          <Tooltip
                            cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(2,132,199,0.06)' }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const pt = payload[0];
                              return (
                                <div className="px-3 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md shadow-xl text-[11px] font-mono space-y-0.5">
                                  <span className="text-slate-400 block text-[10px] font-bold">{pt.payload?.name}</span>
                                  <span className="text-sky-600 dark:text-sky-400 font-bold tabular-nums">{Number(pt.value || 0).toLocaleString()} Registered Trainees</span>
                                </div>
                              );
                            }}
                          />
                          <Bar
                            dataKey="trainees"
                            fill="#0284c7"
                            radius={[5, 5, 0, 0]}
                            maxBarSize={28}
                            isAnimationActive={true}
                            animationBegin={0}
                            animationDuration={1750}
                            animationEasing="ease-out"
                          />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                    </ImmersiveChartFrame>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* 3 Secondary Cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4"
        >
          {[
            {
              title: 'Active Seafarers',
              value: kpis.activeTrainees?.toLocaleString() || '0',
              sub: kpis.traineeGrowth || '+0.0% new registrations',
            },
            {
              title: 'Live Simulators',
              value: kpis.ongoingSimulators || '0',
              sub: kpis.simulatorSub || '0 sessions starting soon',
            },
            {
              title: 'Completion Rate',
              value: trainingOverview.completionRate || '0%',
              sub: trainingOverview.completionGrowth || '+0.0% from last month',
            },
          ].map((kpi) => (
            <motion.div
              key={kpi.title}
              variants={cascadeItem}
              whileHover={{ x: -2, transition: { duration: 0.2 } }}
              className="relative p-5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-center space-y-2"
            >
              <span className="relative z-10 text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">
                {kpi.title}
              </span>

              <div className="relative z-10 mt-auto">
                <div className="text-2xl xl:text-3xl font-bold text-slate-900 dark:text-white font-mono tracking-tight tabular-nums leading-none">
                  {kpi.value}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium font-mono tabular-nums leading-tight mt-2">
                  {kpi.sub.includes('+') && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  <span className={kpi.sub.includes('+') ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}>{kpi.sub}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* 3. Platform Revenue & Total Enrollment Trajectory Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        onViewportEnter={() => setTrajectoryChartInView(true)}
        transition={{ duration: 0.45, ease: easeOutCurve }}
        className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2.5">
              <span>Platform Cohort & Enrollment Trajectory</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 text-[10px] font-mono border border-sky-200 dark:border-sky-800/60 font-semibold">
                RECORDED LIVE
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Registered maritime seafarers recorded alongside total course enrollments.
            </p>
          </div>

          {/* Interactive Metric Controls & Legends */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Metric Mode Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-mono">
              <button
                type="button"
                onClick={() => setChartMode('COMBINED')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMode === 'COMBINED'
                    ? 'bg-white dark:bg-slate-700 font-bold text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Dual Trajectory
              </button>
              <button
                type="button"
                onClick={() => setChartMode('TRAINEES')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMode === 'TRAINEES'
                    ? 'bg-white dark:bg-slate-700 font-bold text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Seafarers
              </button>
              <button
                type="button"
                onClick={() => setChartMode('ENROLLMENTS')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMode === 'ENROLLMENTS'
                    ? 'bg-white dark:bg-slate-700 font-bold text-teal-600 dark:text-teal-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Enrollments
              </button>
            </div>

            {/* Graph Type Option: Line | Bar */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-mono">
              <button
                type="button"
                onClick={() => setTrajectoryGraphType('line')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  trajectoryGraphType === 'line'
                    ? 'bg-white dark:bg-slate-700 font-bold text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Line Graph"
              >
                <LucideLineChart className="w-3.5 h-3.5 text-sky-500" />
                <span>Line</span>
              </button>
              <button
                type="button"
                onClick={() => setTrajectoryGraphType('bar')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  trajectoryGraphType === 'bar'
                    ? 'bg-white dark:bg-slate-700 font-bold text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Bar Graph"
              >
                <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Bar</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              {(chartMode === 'COMBINED' || chartMode === 'TRAINEES') && (
                <button
                  type="button"
                  onMouseEnter={() => setHoveredTrajectorySeries('trainees')}
                  onMouseLeave={() => setHoveredTrajectorySeries(null)}
                  onClick={() => setChartMode(chartMode === 'TRAINEES' ? 'COMBINED' : 'TRAINEES')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    chartMode === 'TRAINEES'
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-400 font-bold'
                      : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Registered Seafarers</span>
                </button>
              )}
              {(chartMode === 'COMBINED' || chartMode === 'ENROLLMENTS') && (
                <button
                  type="button"
                  onMouseEnter={() => setHoveredTrajectorySeries('enrollments')}
                  onMouseLeave={() => setHoveredTrajectorySeries(null)}
                  onClick={() => setChartMode(chartMode === 'ENROLLMENTS' ? 'COMBINED' : 'ENROLLMENTS')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    chartMode === 'ENROLLMENTS'
                      ? 'bg-teal-500/15 border-teal-500/40 text-teal-600 dark:text-teal-400 font-bold'
                      : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Total Enrollments</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="h-[280px] sm:h-[360px] xl:h-[400px] w-full pt-2 relative">
          {!mounted || (!data && loading) ? (
            <div className="w-full h-full flex flex-col justify-between py-6 px-4 animate-pulse">
              <div className="space-y-6 w-full pt-2">
                <div className="h-px w-full bg-slate-200/60 dark:bg-slate-800/60 border-t border-dashed border-slate-300/40 dark:border-slate-700/40" />
                <div className="h-px w-full bg-slate-200/60 dark:bg-slate-800/60 border-t border-dashed border-slate-300/40 dark:border-slate-700/40" />
                <div className="h-px w-full bg-slate-200/60 dark:bg-slate-800/60 border-t border-dashed border-slate-300/40 dark:border-slate-700/40" />
                <div className="h-px w-full bg-slate-200/60 dark:bg-slate-800/60 border-t border-dashed border-slate-300/40 dark:border-slate-700/40" />
              </div>
              <div className="flex justify-between items-center pt-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-2.5 w-12 rounded bg-slate-200/60 dark:bg-slate-800/60" />
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`trajectory-chart-motion-${trajectoryGraphType}-${chartMode}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.35, ease: easeOutCurve }}
                className={`w-full h-full transition-opacity duration-300 ${loading ? 'opacity-70' : 'opacity-100'}`}
            >
              <ImmersiveChartFrame
                ready={mounted && !loading && Boolean(data)}
                triggerKey={`traj-${trajectoryGraphType}-${chartMode}-${trajectoryChartInView ? 'in' : 'wait'}`}
                duration={2.0}
                className="w-full h-full"
              >
              {trajectoryGraphType === 'line' ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart
                    data={currentChartData}
                    margin={{ top: 15, right: 20, left: 10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="oceanBlueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity={0.38} />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="enrollmentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? "#1e293b" : "#f1f5f9"} vertical={false} />
                    <XAxis dataKey="name" stroke={resolvedTheme === 'dark' ? "#64748b" : "#94a3b8"} fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />

                    {/* Left Y-Axis for Seafarers */}
                    {(chartMode === 'COMBINED' || chartMode === 'TRAINEES') && (
                      <YAxis
                        yAxisId="left"
                        stroke={resolvedTheme === 'dark' ? "#0284c7" : "#0284c7"}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tickFormatter={(val) => `${val}`}
                      />
                    )}

                    {/* Right Y-Axis for Total Enrollments */}
                    {(chartMode === 'COMBINED' || chartMode === 'ENROLLMENTS') && (
                      <YAxis
                        yAxisId={chartMode === 'COMBINED' ? "right" : "left"}
                        orientation={chartMode === 'COMBINED' ? "right" : "left"}
                        stroke={resolvedTheme === 'dark' ? "#14b8a6" : "#0d9488"}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tickFormatter={(val) => `${val}`}
                      />
                    )}

                    <Tooltip
                      cursor={{ stroke: '#0284c7', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                      content={renderTrajectoryTooltip}
                    />

                    {(chartMode === 'COMBINED' || chartMode === 'TRAINEES') && (
                      <Area
                        yAxisId="left"
                        type="monotone"
                        name="Registered Seafarers"
                        dataKey="trainees"
                        stroke="#0284c7"
                        strokeWidth={hoveredTrajectorySeries === 'trainees' ? 3.5 : 2.5}
                        strokeOpacity={hoveredTrajectorySeries === 'enrollments' ? 0.35 : 1}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fillOpacity={hoveredTrajectorySeries === 'enrollments' ? 0.25 : 1}
                        fill="url(#oceanBlueGrad)"
                        activeDot={{ r: 6, fill: '#fff', stroke: '#0284c7', strokeWidth: 2.5 }}
                        isAnimationActive={true} animationBegin={0} animationDuration={1900} animationEasing="ease-out"
                      />
                    )}

                    {(chartMode === 'COMBINED' || chartMode === 'ENROLLMENTS') && (
                      <Area
                        yAxisId={chartMode === 'COMBINED' ? "right" : "left"}
                        type="monotone"
                        name="Total Enrollments"
                        dataKey="enrollments"
                        stroke="#0d9488"
                        strokeWidth={hoveredTrajectorySeries === 'enrollments' ? 3.5 : 2.5}
                        strokeOpacity={hoveredTrajectorySeries === 'trainees' ? 0.35 : 1}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fillOpacity={hoveredTrajectorySeries === 'trainees' ? 0.25 : 1}
                        fill="url(#enrollmentGrad)"
                        activeDot={{ r: 6, fill: '#fff', stroke: '#0d9488', strokeWidth: 2.5 }}
                        isAnimationActive={true} animationBegin={120} animationDuration={1900} animationEasing="ease-out"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart
                    data={currentChartData}
                    margin={{ top: 15, right: 20, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? "#1e293b" : "#f1f5f9"} vertical={false} />
                    <XAxis dataKey="name" stroke={resolvedTheme === 'dark' ? "#64748b" : "#94a3b8"} fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />

                    {(chartMode === 'COMBINED' || chartMode === 'TRAINEES') && (
                      <YAxis
                        yAxisId="left"
                        stroke={resolvedTheme === 'dark' ? "#0284c7" : "#0284c7"}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tickFormatter={(val) => `${val}`}
                      />
                    )}

                    {(chartMode === 'COMBINED' || chartMode === 'ENROLLMENTS') && (
                      <YAxis
                        yAxisId={chartMode === 'COMBINED' ? "right" : "left"}
                        orientation={chartMode === 'COMBINED' ? "right" : "left"}
                        stroke={resolvedTheme === 'dark' ? "#14b8a6" : "#0d9488"}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tickFormatter={(val) => `${val}`}
                      />
                    )}

                    <Tooltip
                      cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(2,132,199,0.05)' }}
                      content={renderTrajectoryTooltip}
                    />

                    {(chartMode === 'COMBINED' || chartMode === 'TRAINEES') && (
                      <Bar
                        yAxisId="left"
                        name="Registered Seafarers"
                        dataKey="trainees"
                        fill="#0284c7"
                        fillOpacity={hoveredTrajectorySeries === 'enrollments' ? 0.35 : 1}
                        radius={[5, 5, 0, 0]}
                        isAnimationActive={true} animationBegin={0} animationDuration={1800} animationEasing="ease-out"
                        maxBarSize={36}
                      />
                    )}

                    {(chartMode === 'COMBINED' || chartMode === 'ENROLLMENTS') && (
                      <Bar
                        yAxisId={chartMode === 'COMBINED' ? "right" : "left"}
                        name="Total Enrollments"
                        dataKey="enrollments"
                        fill="#0d9488"
                        fillOpacity={hoveredTrajectorySeries === 'trainees' ? 0.35 : 1}
                        radius={[5, 5, 0, 0]}
                        isAnimationActive={true} animationBegin={100} animationDuration={1800} animationEasing="ease-out"
                        maxBarSize={36}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
              </ImmersiveChartFrame>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      {/* Campus & Settlement Channels Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Campus Revenue Contribution */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20px' }}
          onViewportEnter={() => setCampusChartInView(true)}
          transition={{ duration: 0.45, ease: easeOutCurve }}
          className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4"
        >
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                NEWSIM Talisay Training Center Overview
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Active training center, seafarer cohorts, and course offerings.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setCampusGraphType('list')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                    campusGraphType === 'list'
                      ? 'bg-white dark:bg-slate-700 font-bold text-sky-600 dark:text-sky-400 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="List View"
                >
                  <List className="w-3 h-3" />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCampusGraphType('bar')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                    campusGraphType === 'bar'
                      ? 'bg-white dark:bg-slate-700 font-bold text-sky-600 dark:text-sky-400 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Bar Telemetry"
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>Bar</span>
                </button>
              </div>
              <Building2 className="w-4 h-4 text-sky-500 shrink-0" />
            </div>
          </div>

          <div className="min-h-[180px]">
            <AnimatePresence mode="wait">
              {campusGraphType === 'bar' ? (
                <motion.div
                  key="campus-bar-chart"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: easeOutCurve }}
                  className="h-48 w-full pt-2"
                >
                  <ImmersiveChartFrame
                    ready={mounted && !loading && Boolean(data)}
                    triggerKey={`campus-${campusGraphType}-${campusChartInView ? 'in' : 'wait'}`}
                    duration={1.85}
                    className="w-full h-full"
                  >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.centersList || []}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={resolvedTheme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                      <XAxis dataKey="code" stroke="#94a3b8" fontSize={11} fontFamily="monospace" tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} fontFamily="monospace" tickLine={false} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(2,132,199,0.06)' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const c = payload[0]?.payload || {};
                          return (
                            <div className="rounded-xl bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 shadow-xl text-xs font-mono space-y-1">
                              <div className="font-bold text-slate-900 dark:text-white">{c.center} ({c.code})</div>
                              <div className="text-sky-600 dark:text-sky-400 font-bold">{c.traineesCount ?? 0} Seafarers Enrolled</div>
                              <div className="text-slate-500">{c.activeCoursesCount ?? 0} Active Courses</div>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="traineesCount"
                        name="Seafarers"
                        fill="#0284c7"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={32}
                        isAnimationActive={true}
                        animationDuration={1800}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  </ImmersiveChartFrame>
                </motion.div>
              ) : (
                <motion.div
                  key="campus-list-view"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-3.5 pt-1"
                >
                  {(data?.centersList || []).length === 0 ? (
                    <div className="p-6 text-center text-xs font-mono text-slate-400">
                      No active training campuses configured in the database.
                    </div>
                  ) : (
                    (data.centersList as any[]).map((c: any) => (
                      <motion.div
                        key={c.center}
                        variants={cascadeItem}
                        whileHover={{ x: 2 }}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60 font-bold font-mono">
                              {c.code}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {c.center}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                            {c.activeCoursesCount ?? 0} Active Courses Conducted
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                            {c.traineesCount ?? 0} Seafarers
                          </span>
                          <span className="block text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            Operational
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Account Security & Governance Posture */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20px' }}
          transition={{ duration: 0.4, delay: 0.05, ease: easeCurve }}
          className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4"
        >
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                Security & Platform Telemetry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time authentication, TOTP enforcement, and system infrastructure.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-semibold border border-emerald-200 dark:border-emerald-800/80 uppercase">
                {securityOverview.status || 'OPERATIONAL'}
              </span>
              <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0" />
            </div>
          </div>

          <div className="min-h-[180px]">
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    MFA Coverage
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60 font-semibold">
                    TOTP
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {securityOverview.mfaCoverage || '0%'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    Profiles Enrolled
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    Active Sessions
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                    Live
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {securityOverview.activeSessionsCount ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    Verified JWT Tokens
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    Audit Events
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-50 dark:bg-sky-500/15 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60 font-semibold">
                    Immutable
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {securityOverview.totalAuditEvents ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    Security Logs Logged
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    Cluster Health
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                    Optimal
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    Healthy
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    PostgreSQL Connection
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 4. Conversion Pipeline & Enterprise Security Posture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Pipeline Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20px' }}
          transition={{ duration: 0.4, ease: easeCurve }}
          className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 relative overflow-hidden"
        >
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Trainee Conversion Funnel</h3>
            <span className="text-xs font-mono text-sky-600 dark:text-sky-400 font-semibold">{pipeline.conversionRate || '0.0%'} Conversion Rate</span>
          </div>

          <div className="space-y-3 pt-1">
            {[
              { stage: '1. Applications Submitted', count: pipeline.applications || 0, pct: pipeline.applicationsPct || '0%', color: 'bg-slate-400', desc: 'Initial trainee applications' },
              { stage: '2. Approved by Operations', count: pipeline.approved || 0, pct: pipeline.approvedPct || '0%', color: 'bg-sky-500', desc: 'Verified credentials & SRN' },
              { stage: '3. Payment Verified', count: pipeline.paid || 0, pct: pipeline.paidPct || '0%', color: 'bg-blue-600', desc: 'Settled tuition via QR Ph' },
              { stage: '4. Cohort Enrolled', count: pipeline.enrolled || 0, pct: pipeline.enrolledPct || '0%', color: 'bg-teal-500', desc: 'Assigned to active batch' },
              { stage: '5. Certified Seafarers', count: pipeline.completed || 0, pct: pipeline.completedPct || '0%', color: 'bg-emerald-500', desc: 'Graduated & MARINA certified' },
            ].map((step, idx) => {
              const isHovered = hoveredFunnelStage === idx;
              return (
                <motion.div
                  key={step.stage}
                  onMouseEnter={() => setHoveredFunnelStage(idx)}
                  onMouseLeave={() => setHoveredFunnelStage(null)}
                  whileHover={{ x: 3 }}
                  className={`p-2 -mx-2 rounded-xl transition-colors cursor-pointer space-y-1.5 ${
                    isHovered ? 'bg-slate-50 dark:bg-slate-800/60' : ''
                  }`}
                >
                  <div className="flex justify-between items-center text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 dark:text-slate-200 font-semibold">{step.stage}</span>
                      {isHovered && (
                        <span className="text-[10px] text-sky-600 dark:text-sky-400 font-normal hidden sm:inline">
                          • {step.desc}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-900 dark:text-white font-bold tabular-nums">{step.count.toLocaleString()} ({step.pct})</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: step.pct }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.85, ease: easeOutCurve, delay: idx * 0.08 }}
                      className={`h-full rounded-full ${step.color} transition-all ${isHovered ? 'brightness-110 shadow-sm' : ''}`}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Security & Infrastructure Status */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20px' }}
          transition={{ duration: 0.4, delay: 0.05, ease: easeCurve }}
          className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between relative overflow-hidden"
        >
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Security & Platform Health</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-semibold border border-emerald-200 dark:border-emerald-800/80 uppercase">
                {securityOverview.status || 'OPERATIONAL'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-semibold block">MFA Compliance</span>
                <span className="text-lg xl:text-xl font-bold text-slate-900 dark:text-white font-mono mt-1 block">
                  {securityOverview.mfaCoverage || '0%'} Enrolled
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-semibold block">Active Sessions</span>
                <span className="text-lg xl:text-xl font-bold text-slate-900 dark:text-white font-mono mt-1 block">
                  {securityOverview.activeSessionsCount || 0} Verified
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-600 dark:text-slate-300">PostgreSQL Core Cluster</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 14ms (Optimal)
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-600 dark:text-slate-300">RFC 6238 TOTP Auth Guard</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Enforced
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-600 dark:text-slate-300">MARINA Compliance Sync</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                </span>
              </div>
            </div>
          </div>

          <Link href="/super-admin/security">
            <button className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 mt-3 shadow-2xs cursor-pointer">
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Inspect Security Center</span>
            </button>
          </Link>
        </motion.div>
      </div>

      {/* 5. System Governance & Audit Activity Ledger */}

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs relative"
      >
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-[#0c1a2c]">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              System Governance & Security Audit Ledger
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time authentication, account provisioning, and access records.</p>
          </div>
          <Link href="/super-admin/audit-logs" className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-semibold transition-colors flex items-center gap-1">
            <span>View All Audit Logs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200">
            <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 pl-6">Actor / User</th>
                <th className="py-3 px-4">Event Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4 pr-6 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {!mounted || loading ? (
                [1, 2, 3, 4, 5].map((row) => (
                  <tr key={`audit-skel-${row}`} className="animate-pulse">
                    <td className="py-3.5 px-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800" />
                        <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-3.5 px-4 pr-6 text-right">
                      <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : data?.recentActivity?.length > 0 ? (
                data.recentActivity.slice(0, 6).map((act: any, idx: number) => (
                  <motion.tr
                    key={act.id || idx}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.25, delay: idx * 0.03, ease: easeCurve }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 pl-6">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          src={act.actorAvatarUrl}
                          name={act.actor}
                          fallback="A"
                          alt={act.actor || 'Actor'}
                          className="w-8 h-8 rounded-full border border-sky-200 dark:border-sky-800/80 shrink-0"
                          fallbackClassName="bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-bold text-xs font-mono"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{act.actor}</div>
                          {(act.actorEmail || act.role) && (
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                              {act.actorEmail ? `${act.actorEmail}${act.role ? ` • ${act.role}` : ''}` : act.role}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] border border-slate-200 dark:border-slate-700">
                        {act.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 text-xs">
                      {act.entityType ? `${act.entityType}: ${String(act.entityId || '').slice(0, 8)}` : 'System Core'}
                    </td>

                    <td className="py-3 px-4 pr-6 text-right font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                      {act.timestamp}
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs font-mono text-slate-400 dark:text-slate-500">
                    No recent security audit events recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

