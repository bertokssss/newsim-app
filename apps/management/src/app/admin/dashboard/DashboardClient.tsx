
'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Calendar,
  PlusCircle,
  CreditCard,
  Sparkles,
  BookOpen,
  CalendarDays,
  FileSpreadsheet,
  Award,
  AlertCircle,
  BarChart3,
  LineChart as LucideLineChart,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useTheme, ImmersiveChartFrame, UserAvatar } from '@newsim/ui';
import { canAccessPortalRoute } from '@newsim/utils';

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

interface KPIValue {
  value: string;
  change: string;
}

interface TraineesKPI extends KPIValue {
  active: string;
}

interface EnrollmentsKPI extends KPIValue {
  pending: number;
}

interface SessionsKPI extends KPIValue {
  upcoming: number;
}

interface PaymentsKPI extends KPIValue {
  todayTotal: string;
  rawTotal?: number;
  gcashTotal?: number;
  mayaTotal?: number;
  otherTotal?: number;
  formattedGcash?: string;
  formattedMaya?: string;
}

interface RevenueTrendItem {
  name: string;
  gcash: number;
  maya: number;
  other: number;
  total: number;
}

interface RevenueBreakdown {
  totalGross: number;
  formattedTotalGross: string;
  gcashTotal: number;
  formattedGcashTotal: string;
  mayaTotal: number;
  formattedMayaTotal: string;
  otherTotal: number;
  formattedOtherTotal: string;
}

interface DashboardKPIs {
  monthlyRevenue: PaymentsKPI;
  totalTrainees: TraineesKPI;
  activeEnrollments: EnrollmentsKPI;
  ongoingSessions: SessionsKPI;
  pendingPayments: PaymentsKPI;
}

interface EnrollmentTrendItem {
  name: string;
  enrollments: number;
  completions: number;
}

interface AttendanceToday {
  presentRate: number;
  absentRate: number;
  lateRate: number;
  excusedRate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  totalCheckedIn: number;
}

interface ScheduleItem {
  id: string | number;
  startTime: string;
  courseTitle: string;
  room: string;
  instructorName: string;
  instructorAvatarUrl?: string | null;
}

interface PendingPayment {
  id: string | number;
  traineeName: string;
  traineeAvatarUrl?: string | null;
  courseTitle: string;
  amount: number;
  status: string;
}

interface RecentActivity {
  id?: string | number;
  time: string;
  actor: string;
  action: string;
  entity: string;
  color?: string;
}

interface DashboardData {
  kpis?: Partial<DashboardKPIs>;
  enrollmentTrend?: EnrollmentTrendItem[];
  traineeTrend?: { name: string; trainees: number }[];
  revenueTrend?: RevenueTrendItem[];
  revenueBreakdown?: RevenueBreakdown | null;
  attendanceToday?: Partial<AttendanceToday>;
  todaySchedules?: ScheduleItem[];
  pendingPaymentsList?: PendingPayment[];
  recentActivity?: RecentActivity[];
  hasFinancialAccess?: boolean;
  permissions?: string[];
}

interface DashboardResponse {
  success?: boolean;
  data?: DashboardData;
  error?: string;
  message?: string;
}

const DEFAULT_KPIS: DashboardKPIs = {
  monthlyRevenue: {
    value: '₱ 0',
    change: 'No data',
    todayTotal: '₱ 0',
  },
  totalTrainees: {
    value: '0',
    active: '0',
    change: '0 new this month',
  },
  activeEnrollments: {
    value: '0',
    pending: 0,
    change: '0 awaiting review',
  },
  ongoingSessions: {
    value: '0',
    upcoming: 0,
    change: '0 live sessions',
  },
  pendingPayments: {
    value: '0',
    todayTotal: '₱ 0',
    change: 'Needs verification',
  },
};

const DEFAULT_ATTENDANCE: AttendanceToday = {
  presentRate: 0,
  absentRate: 0,
  lateRate: 0,
  excusedRate: 0,
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
  totalCheckedIn: 0,
};

const EMPTY_CHART_DATA: EnrollmentTrendItem[] = [
  {
    name: 'No Data',
    enrollments: 0,
    completions: 0,
  },
];

function toNumber(value: unknown, fallback = 0): number {
  const numberValue =
    typeof value === 'number' ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clampPercentage(value: unknown): number {
  return Math.min(100, Math.max(0, toNumber(value)));
}

function formatAmount(amount: unknown): string {
  const numericAmount = toNumber(amount);

  return numericAmount.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getEntityColor(entity: string): string {
  const normalizedEntity = entity.toUpperCase();

  if (normalizedEntity.includes('PAY')) {
    return 'text-emerald-500';
  }

  if (normalizedEntity.includes('ENR')) {
    return 'text-sky-500';
  }

  if (normalizedEntity.includes('CERT')) {
    return 'text-indigo-500';
  }

  if (normalizedEntity.includes('SESSION')) {
    return 'text-teal-500';
  }

  return 'text-slate-500';
}

const LiveClock = React.memo(function LiveClock() {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      const date = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      setCurrentTime(`${time} • ${date}`);
    };

    updateTime();
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!currentTime) return null;

  return (
    <div className="pt-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
      <span>{currentTime}</span>
    </div>
  );
});

export default function DashboardClient() {
  const { resolvedTheme } = useTheme();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentChannelFilter, setPaymentChannelFilter] = useState<'ALL' | 'GCASH' | 'MAYA'>('ALL');
  const [revenueGraphType, setRevenueGraphType] = useState<'area' | 'bar'>('area');
  const [throughputFilter, setThroughputFilter] = useState<'ALL' | 'ENROLLMENTS' | 'COMPLETIONS'>('ALL');
  const [throughputGraphType, setThroughputGraphType] = useState<'area' | 'bar'>('area');
  const [hoveredThroughputSeries, setHoveredThroughputSeries] = useState<'enrollments' | 'completions' | null>(null);
  const [activeAttendanceSegment, setActiveAttendanceSegment] = useState<'PRESENT' | 'LATE' | 'ABSENT' | null>(null);
  const [revenueChartInView, setRevenueChartInView] = useState(false);
  const [throughputChartInView, setThroughputChartInView] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/dashboard', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      let json: DashboardResponse;

      try {
        json = (await response.json()) as DashboardResponse;
      } catch {
        throw new Error(
          `The dashboard API returned an invalid response (${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          json.error ||
            json.message ||
            `Dashboard request failed with status ${response.status}.`
        );
      }

      if (!json.success) {
        throw new Error(
          json.error ||
            json.message ||
            'Failed to load dashboard data.'
        );
      }

      setData(json.data ?? {});
    } catch (err) {
      console.error('Failed to load dashboard data:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while loading dashboard data.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
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
            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 rounded-3xl border border-red-200 bg-white/50 p-8 backdrop-blur-sm dark:border-red-900/30 dark:bg-slate-900/60">
        <AlertCircle className="h-12 w-12 text-red-500" />

        <h3 className="font-heading text-lg font-bold text-slate-900 dark:text-white">
          Connection Error
        </h3>

        <p className="max-w-md text-center text-sm text-slate-600 dark:text-slate-400">
          {error}
        </p>

        <button
          type="button"
          onClick={() => void loadDashboardData()}
          className="mt-4 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const rawKpis = data?.kpis ?? {};

  const kpis: DashboardKPIs = {
    monthlyRevenue: {
      ...DEFAULT_KPIS.monthlyRevenue,
      ...(rawKpis.monthlyRevenue ?? {}),
    },
    totalTrainees: {
      ...DEFAULT_KPIS.totalTrainees,
      ...(rawKpis.totalTrainees ?? {}),
    },
    activeEnrollments: {
      ...DEFAULT_KPIS.activeEnrollments,
      ...(rawKpis.activeEnrollments ?? {}),
    },
    ongoingSessions: {
      ...DEFAULT_KPIS.ongoingSessions,
      ...(rawKpis.ongoingSessions ?? {}),
    },
    pendingPayments: {
      ...DEFAULT_KPIS.pendingPayments,
      ...(rawKpis.pendingPayments ?? {}),
    },
  };

  const chartData =
    data?.enrollmentTrend && data.enrollmentTrend.length > 0
      ? data.enrollmentTrend
      : EMPTY_CHART_DATA;

  const traineeChartData =
    data?.traineeTrend && data.traineeTrend.length > 0
      ? data.traineeTrend
      : [{ name: 'No Data', trainees: 0 }];

  const revenueChartData =
    data?.revenueTrend && data.revenueTrend.length > 0
      ? data.revenueTrend
      : [
          { name: 'Jan', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'Feb', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'Mar', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'Apr', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'May', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'Jun', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'Jul', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'Aug', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'Sep', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'Oct', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'Nov', gcash: 0, maya: 0, other: 0, total: 0 },
          { name: 'Dec', gcash: 0, maya: 0, other: 0, total: 0 },
        ];

  const revenueBreakdown = data?.revenueBreakdown;
  const totalGrossAmount = revenueBreakdown?.formattedTotalGross || kpis.monthlyRevenue.value || '₱ 0';
  const gcashAmount = revenueBreakdown?.formattedGcashTotal || kpis.monthlyRevenue.formattedGcash || '₱ 0';
  const mayaAmount = revenueBreakdown?.formattedMayaTotal || kpis.monthlyRevenue.formattedMaya || '₱ 0';

  const gcashRaw = revenueBreakdown?.gcashTotal ?? kpis.monthlyRevenue.gcashTotal ?? 0;
  const mayaRaw = revenueBreakdown?.mayaTotal ?? kpis.monthlyRevenue.mayaTotal ?? 0;
  const totalRaw = revenueBreakdown?.totalGross ?? kpis.monthlyRevenue.rawTotal ?? (gcashRaw + mayaRaw);

  const gcashPercent = totalRaw > 0 ? Math.round((gcashRaw / totalRaw) * 100) : 0;
  const mayaPercent = totalRaw > 0 ? Math.round((mayaRaw / totalRaw) * 100) : 0;

  const rawAttendance = data?.attendanceToday ?? {};

  const attendanceToday: AttendanceToday = {
    ...DEFAULT_ATTENDANCE,
    ...rawAttendance,
    presentRate: clampPercentage(rawAttendance.presentRate),
    absentRate: clampPercentage(rawAttendance.absentRate),
    lateRate: clampPercentage(rawAttendance.lateRate),
    excusedRate: clampPercentage(rawAttendance.excusedRate),
    present: toNumber(rawAttendance.present),
    absent: toNumber(rawAttendance.absent),
    late: toNumber(rawAttendance.late),
    excused: toNumber(rawAttendance.excused),
    totalCheckedIn: toNumber(rawAttendance.totalCheckedIn),
  };

  const todaySchedules = data?.todaySchedules ?? [];
  const pendingPaymentsList = data?.pendingPaymentsList ?? [];
  const adminPermissions = data?.permissions ?? null;
  const canRoute = (href: string) =>
    adminPermissions === null
      ? href !== '/admin/payments'
      : canAccessPortalRoute('ADMIN', href, adminPermissions, 'ADMIN') &&
        (href !== '/admin/payments' || data?.hasFinancialAccess !== false);

  const quickActions = [
    {
      href: '/admin/courses',
      title: 'Create Course',
      subtitle: 'STCW module setup',
      icon: BookOpen,
      cardHover: 'hover:border-teal-500/40 hover:bg-teal-50/20 dark:hover:bg-teal-500/10',
      iconBox: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
      arrowHover: 'group-hover:text-teal-500',
    },
    {
      href: '/admin/enrollments',
      title: 'New Enrollment',
      subtitle: 'Cohort assignment',
      icon: FileSpreadsheet,
      cardHover: 'hover:border-emerald-500/40 hover:bg-emerald-50/20 dark:hover:bg-emerald-500/10',
      iconBox: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      arrowHover: 'group-hover:text-emerald-500',
    },
    {
      href: '/admin/certificates',
      title: 'Issue Certificate',
      subtitle: 'Process readiness',
      icon: Award,
      cardHover: 'hover:border-teal-500/40 hover:bg-teal-50/20 dark:hover:bg-teal-500/10',
      iconBox: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
      arrowHover: 'group-hover:text-teal-500',
    },
  ].filter((act) => canRoute(act.href));

  return (
    <div className="animate-in space-y-6 fade-in duration-500 sm:space-y-8">
      {/* =========================================================
          HERO HEADER
      ========================================================== */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all duration-300 dark:border-slate-800 dark:bg-[#0c1a2c] sm:p-8"
      >
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-2">
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-slate-900 dark:text-[#F8FAFC] sm:text-3xl">
              Training Operations &amp; Daily Execution
            </h1>

            <p className="font-sans text-sm leading-relaxed text-slate-600 dark:text-[#CBD5E1]">
              {data?.hasFinancialAccess !== false && canRoute('/admin/payments')
                ? 'Manage daily trainee cohorts, classroom schedules, simulator slots, payment verification queues, and STCW certificate issuances.'
                : 'Manage daily trainee cohorts, classroom schedules, simulator slots, and permitted training operations.'}
            </p>

            <LiveClock />
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {data?.hasFinancialAccess !== false && canRoute('/admin/payments') ? (
              <Link
                href="/admin/payments"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <CreditCard className="h-4 w-4 text-white" />
                <span>
                  Verify Payments ({kpis.pendingPayments.value})
                </span>
              </Link>
            ) : canRoute('/admin/enrollments') ? (
              <Link
                href="/admin/enrollments"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <FileSpreadsheet className="h-4 w-4 text-white" />
                <span>Review Enrollments</span>
              </Link>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* =========================================================
          METRICS BENTO GRID
      ========================================================== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12 xl:gap-8">
        {/* PRIMARY CARD: TOTAL GROSS REVENUE (SEPARATING MAYA & GCASH) */}
        {data?.hasFinancialAccess !== false && (
        <div className="flex lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            onViewportEnter={() => setRevenueChartInView(true)}
            transition={{ duration: 0.45, ease: easeCurve }}
            whileHover={{
              y: -4,
              transition: { duration: 0.2 },
            }}
            className="group relative flex min-h-[380px] xl:min-h-[440px] 2xl:min-h-[460px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all duration-300 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-[#0c1a2c] xl:p-8 2xl:p-10"
          >
            {/* Ambient Background Glows */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-[80px] transition-colors duration-500 group-hover:bg-emerald-400/20 dark:bg-emerald-500/10" />
            <div className="pointer-events-none absolute -bottom-20 -left-24 h-64 w-64 rounded-full bg-sky-400/10 blur-[80px] transition-colors duration-500 group-hover:bg-sky-400/20 dark:bg-sky-500/10" />

            {/* LABEL + CHANNEL STATUS BADGES */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-[#CBD5E1] xl:text-base">
                  Total Gross Revenue
                </span>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Gross Collections
                </span>
              </div>

              {/* Interactive Channel Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => setPaymentChannelFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      paymentChannelFilter === 'ALL'
                        ? 'bg-white dark:bg-[#0c1a2c] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    All Channels
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentChannelFilter('GCASH')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      paymentChannelFilter === 'GCASH'
                        ? 'bg-[#007DFE] text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-[#007DFE]'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#007DFE] inline-block" />
                    GCash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentChannelFilter('MAYA')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      paymentChannelFilter === 'MAYA'
                        ? 'bg-[#00D664] text-slate-950 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-[#00D664]'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00D664] inline-block" />
                    Maya
                  </button>
                </div>

                {/* Area / Bar Mode Switch */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => setRevenueGraphType('area')}
                    title="Smooth Curve View"
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      revenueGraphType === 'area'
                        ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <LucideLineChart className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevenueGraphType('bar')}
                    title="Bar Comparison View"
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      revenueGraphType === 'bar'
                        ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* AMOUNT AND BREAKDOWN */}
            <div className="relative z-10 mt-5">
              <motion.div
                key={paymentChannelFilter}
                initial={{ opacity: 0.4, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: easeCurve }}
                className="break-words bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text font-heading text-4xl sm:text-5xl xl:text-6xl 2xl:text-7xl font-black leading-tight tracking-tight text-transparent drop-shadow-sm dark:from-white dark:to-slate-300"
              >
                {paymentChannelFilter === 'GCASH'
                  ? gcashAmount
                  : paymentChannelFilter === 'MAYA'
                  ? mayaAmount
                  : totalGrossAmount}
              </motion.div>

              {/* Interactive Channel Breakdown Pills */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5 sm:gap-4 font-mono text-xs">
                {/* GCash Chip */}
                <button
                  type="button"
                  onClick={() => setPaymentChannelFilter(paymentChannelFilter === 'GCASH' ? 'ALL' : 'GCASH')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer active:scale-95 ${
                    paymentChannelFilter === 'GCASH'
                      ? 'bg-[#007DFE] text-white border-[#007DFE] shadow-sm shadow-[#007DFE]/25'
                      : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60 text-[#007DFE] dark:text-sky-400 hover:border-[#007DFE]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${paymentChannelFilter === 'GCASH' ? 'bg-white' : 'bg-[#007DFE]'}`} />
                  <span>GCash: {gcashAmount}</span>
                  {gcashPercent > 0 && <span className="text-[10px] opacity-80 font-normal">({gcashPercent}%)</span>}
                </button>

                {/* Maya Chip */}
                <button
                  type="button"
                  onClick={() => setPaymentChannelFilter(paymentChannelFilter === 'MAYA' ? 'ALL' : 'MAYA')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer active:scale-95 ${
                    paymentChannelFilter === 'MAYA'
                      ? 'bg-[#00D664] text-slate-950 border-[#00D664] shadow-sm shadow-[#00D664]/25'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 hover:border-[#00D664]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${paymentChannelFilter === 'MAYA' ? 'bg-slate-950' : 'bg-[#00D664]'}`} />
                  <span>Maya: {mayaAmount}</span>
                  {mayaPercent > 0 && <span className="text-[10px] opacity-80 font-normal">({mayaPercent}%)</span>}
                </button>

                {/* Verified Indicator */}
                <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                  Verified Settlements
                </span>
              </div>
            </div>

            {/* REVENUE GRAPH (SEPARATING MAYA AND GCASH) */}
            <div className="relative z-10 mt-auto pt-6 xl:pt-8">
              <div className="h-44 sm:h-52 xl:h-60 w-full -mx-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${revenueGraphType}-${paymentChannelFilter}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.35, ease: easeOutCurve }}
                    className="w-full h-full"
                  >
                    <ImmersiveChartFrame
                      ready={!loading && Boolean(data)}
                      triggerKey={`rev-${revenueGraphType}-${paymentChannelFilter}-${revenueChartInView ? 'in' : 'wait'}`}
                      duration={1.9}
                      className="w-full h-full"
                    >
                    <ResponsiveContainer width="100%" height="100%">
                  {revenueGraphType === 'area' ? (
                    <AreaChart
                      data={revenueChartData}
                      margin={{
                        top: 12,
                        right: 12,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <defs>
                        {/* GCash Blue Gradient */}
                        <linearGradient id="gcashRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#007DFE" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#007DFE" stopOpacity={0.02} />
                        </linearGradient>

                        {/* Maya Green Gradient */}
                        <linearGradient id="mayaRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00D664" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#00D664" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={resolvedTheme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'}
                      />

                      <XAxis
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={11}
                        fontFamily="monospace"
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
                      />

                      <YAxis
                        hide
                        domain={[0, 'auto']}
                      />

                      <Tooltip
                        cursor={{ stroke: '#007DFE', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const dataItem = payload[0]?.payload || {};
                          const gcashVal = Number(dataItem.gcash || 0);
                          const mayaVal = Number(dataItem.maya || 0);
                          const totalVal = gcashVal + mayaVal;
                          const gcashShare = totalVal > 0 ? Math.round((gcashVal / totalVal) * 100) : 0;
                          const mayaShare = totalVal > 0 ? Math.round((mayaVal / totalVal) * 100) : 0;

                          return (
                            <div className="rounded-2xl bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-xl text-xs font-mono space-y-2 min-w-[195px]">
                              <div className="font-bold text-slate-900 dark:text-slate-100 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <span>{label} Collections</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">Live</span>
                              </div>
                              {(paymentChannelFilter === 'ALL' || paymentChannelFilter === 'GCASH') && (
                                <div className="flex items-center justify-between text-[#007DFE] dark:text-sky-400 gap-3">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#007DFE]" />
                                    GCash {totalVal > 0 ? `(${gcashShare}%)` : ''}:
                                  </span>
                                  <span className="font-bold tabular-nums">₱{gcashVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {(paymentChannelFilter === 'ALL' || paymentChannelFilter === 'MAYA') && (
                                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 gap-3">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#00D664]" />
                                    Maya {totalVal > 0 ? `(${mayaShare}%)` : ''}:
                                  </span>
                                  <span className="font-bold tabular-nums">₱{mayaVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-bold text-slate-900 dark:text-white">
                                <span>Period Total:</span>
                                <span className="tabular-nums">
                                  ₱{(paymentChannelFilter === 'GCASH' ? gcashVal : paymentChannelFilter === 'MAYA' ? mayaVal : totalVal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          );
                        }}
                      />

                      {/* GCASH AREA */}
                      {(paymentChannelFilter === 'ALL' || paymentChannelFilter === 'GCASH') && (
                        <Area
                          isAnimationActive={true} animationBegin={0} animationDuration={1850} animationEasing="ease-out" type="monotone" dataKey="gcash"
                          stroke="#007DFE"
                          strokeWidth={2.75}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="url(#gcashRevenueGradient)"
                          fillOpacity={1}
                          name="GCash"
                          dot={false}
                          activeDot={{
                            r: 6,
                            strokeWidth: 2.5,
                            stroke: '#ffffff',
                            fill: '#007DFE',
                          }}
                        />
                      )}

                      {/* MAYA AREA */}
                      {(paymentChannelFilter === 'ALL' || paymentChannelFilter === 'MAYA') && (
                        <Area
                          isAnimationActive={true} animationBegin={120} animationDuration={1850} animationEasing="ease-out" type="monotone" dataKey="maya"
                          stroke="#00D664"
                          strokeWidth={2.75}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="url(#mayaRevenueGradient)"
                          fillOpacity={1}
                          name="Maya"
                          dot={false}
                          activeDot={{
                            r: 6,
                            strokeWidth: 2.5,
                            stroke: '#ffffff',
                            fill: '#00D664',
                          }}
                        />
                      )}
                    </AreaChart>
                  ) : (
                    <BarChart
                      data={revenueChartData}
                      margin={{
                        top: 12,
                        right: 12,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={resolvedTheme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={11}
                        fontFamily="monospace"
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
                      />
                      <YAxis hide domain={[0, 'auto']} />
                      <Tooltip
                        cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,125,254,0.05)' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const dataItem = payload[0]?.payload || {};
                          const gcashVal = Number(dataItem.gcash || 0);
                          const mayaVal = Number(dataItem.maya || 0);
                          const totalVal = gcashVal + mayaVal;
                          return (
                            <div className="rounded-2xl bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-xl text-xs font-mono space-y-2 min-w-[185px]">
                              <div className="font-bold text-slate-900 dark:text-slate-100 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                                {label} Collections
                              </div>
                              {(paymentChannelFilter === 'ALL' || paymentChannelFilter === 'GCASH') && (
                                <div className="flex items-center justify-between text-[#007DFE] dark:text-sky-400">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#007DFE]" />
                                    GCash:
                                  </span>
                                  <span className="font-bold tabular-nums">₱{gcashVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {(paymentChannelFilter === 'ALL' || paymentChannelFilter === 'MAYA') && (
                                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#00D664]" />
                                    Maya:
                                  </span>
                                  <span className="font-bold tabular-nums">₱{mayaVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-bold text-slate-900 dark:text-white">
                                <span>Total Gross:</span>
                                <span className="tabular-nums">₱{totalVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      {(paymentChannelFilter === 'ALL' || paymentChannelFilter === 'GCASH') && (
                        <Bar
                          isAnimationActive={true} animationBegin={0} animationDuration={1750} animationEasing="ease-out" dataKey="gcash"
                          name="GCash"
                          fill="#007DFE"
                          radius={[5, 5, 0, 0]}
                          maxBarSize={28}
                        />
                      )}
                      {(paymentChannelFilter === 'ALL' || paymentChannelFilter === 'MAYA') && (
                        <Bar
                          isAnimationActive={true} animationBegin={100} animationDuration={1750} animationEasing="ease-out" dataKey="maya"
                          name="Maya"
                          fill="#00D664"
                          radius={[5, 5, 0, 0]}
                          maxBarSize={28}
                        />
                      )}
                    </BarChart>
                  )}
                </ResponsiveContainer>
                    </ImmersiveChartFrame>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
        )}

        {/* SECONDARY CARDS */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className={
            data?.hasFinancialAccess !== false
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1 xl:gap-8'
              : 'grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-12 xl:gap-8'
          }
        >
          {[
            {
              title: 'Active Enrollments',
              value: kpis.activeEnrollments.value,
              sub: kpis.activeEnrollments.change,
              cardGradient:
                'from-teal-500/10 via-cyan-500/5 to-transparent dark:from-teal-500/15',
              accentBar:
                'from-teal-500 via-cyan-400 to-blue-500',
            },
            {
              title: 'Ongoing Sessions',
              value: kpis.ongoingSessions.value,
              sub: kpis.ongoingSessions.change,
              cardGradient:
                'from-emerald-500/10 via-indigo-500/5 to-transparent dark:from-emerald-500/15',
              accentBar:
                'from-emerald-500 via-teal-400 to-indigo-500',
            },
            ...(data?.hasFinancialAccess !== false && canRoute('/admin/payments')
              ? [
                  {
                    title: 'Payments Pending',
                    value: kpis.pendingPayments.value,
                    sub: kpis.pendingPayments.change,
                    cardGradient:
                      'from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-500/15',
                    accentBar:
                      'from-emerald-500 via-teal-500 to-amber-500',
                  },
                ]
              : canRoute('/admin/grading-policies')
                ? [
                    {
                      title: 'Grading Policies',
                      value: 'Active',
                      sub: 'STCW Weighted Standards',
                      cardGradient:
                        'from-sky-500/10 via-indigo-500/5 to-transparent dark:from-sky-500/15',
                      accentBar:
                        'from-sky-500 via-indigo-400 to-blue-500',
                    },
                  ]
                : []),
          ].map((kpi, index) => {
            const positiveChange =
              kpi.sub.toLowerCase().includes('new') ||
              kpi.sub.includes('+');

            return (
              <motion.div
                key={kpi.title}
                variants={cascadeItem}
                whileHover={{
                  x: -4,
                  transition: { duration: 0.2 },
                }}
                className="relative flex flex-col justify-center space-y-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-300 hover:border-sky-500/50 hover:shadow-md dark:border-slate-800 dark:bg-[#0c1a2c] xl:p-6"
              >

                <span className="relative z-10 font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#CBD5E1] xl:text-sm">
                  {kpi.title}
                </span>

                <div className="relative z-10 mt-auto">
                  <div className="break-words font-heading text-3xl font-black leading-none tracking-tight tabular-nums text-slate-900 dark:text-[#F8FAFC] xl:text-4xl">
                    {kpi.value}
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 font-mono text-xs font-medium leading-tight tabular-nums text-slate-500 dark:text-slate-400 xl:mt-3 xl:text-[13px]">
                    {positiveChange && (
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
                    )}

                    <span
                      className={
                        positiveChange
                          ? 'font-bold text-emerald-600 dark:text-emerald-400'
                          : ''
                      }
                    >
                      {kpi.sub}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* =========================================================
          ENROLLMENT / COMPLETION CHART
      ========================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        onViewportEnter={() => setThroughputChartInView(true)}
        transition={{ duration: 0.45, ease: easeOutCurve }}
        className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#0c1a2c]"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-base font-extrabold tracking-tight text-slate-900 dark:text-[#F8FAFC] sm:text-lg">
                Operational Trainee Throughput &amp; Completions
              </h2>

              <span className="rounded border border-sky-400/40 bg-sky-500/10 dark:bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400">
                Live Telemetry
              </span>
            </div>

            <p className="mt-0.5 font-sans text-xs text-slate-500 dark:text-[#CBD5E1]">
              Monthly trainee enrollments against successfully certified course
              completions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Series Filter Pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              {([
                { id: 'ALL', label: 'Combined' },
                { id: 'ENROLLMENTS', label: 'Enrollments' },
                { id: 'COMPLETIONS', label: 'Completions' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setThroughputFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    throughputFilter === tab.id
                      ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Area / Bar Mode Switch */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setThroughputGraphType('area')}
                title="Smooth Area Curve"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  throughputGraphType === 'area'
                    ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <LucideLineChart className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setThroughputGraphType('bar')}
                title="Bar Comparison"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  throughputGraphType === 'bar'
                    ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="h-56 sm:h-72 w-full pt-4 sm:pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${throughputGraphType}-${throughputFilter}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: easeOutCurve }}
              className="w-full h-full"
            >
              <ImmersiveChartFrame
                ready={!loading && Boolean(data)}
                triggerKey={`throughput-${throughputGraphType}-${throughputFilter}-${throughputChartInView ? 'in' : 'wait'}`}
                duration={1.95}
                className="w-full h-full"
              >
              <ResponsiveContainer width="100%" height="100%">
            {throughputGraphType === 'area' ? (
              <AreaChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 12,
                  left: -20,
                  bottom: 0,
                }}
              >
                <defs>
                  <linearGradient
                    id="newsimColorEnrollments"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#3BA7F2"
                      stopOpacity={0.42}
                    />
                    <stop
                      offset="95%"
                      stopColor="#3BA7F2"
                      stopOpacity={0.02}
                    />
                  </linearGradient>

                  <linearGradient
                    id="newsimColorCompletions"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#10B981"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="#10B981"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={
                    resolvedTheme === 'dark'
                      ? '#1e293b'
                      : '#e2e8f0'
                  }
                />

                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: '#94a3b8',
                    fontSize: 11,
                    fontFamily: 'monospace',
                  }}
                />

                <YAxis
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: '#94a3b8',
                    fontSize: 11,
                    fontFamily: 'monospace',
                  }}
                  allowDecimals={false}
                />

                <Tooltip
                  cursor={{ stroke: '#3BA7F2', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const row = payload[0]?.payload || {};
                    const enrollmentsVal = Number(row.enrollments || 0);
                    const completionsVal = Number(row.completions || 0);
                    const convRate = enrollmentsVal > 0 ? Math.round((completionsVal / enrollmentsVal) * 100) : 0;

                    return (
                      <div className="rounded-2xl bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-xl text-xs font-mono space-y-2 min-w-[195px]">
                        <div className="font-bold text-slate-900 dark:text-slate-100 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span>{label} Cohort</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">
                            {convRate}% Certified
                          </span>
                        </div>
                        {(throughputFilter === 'ALL' || throughputFilter === 'ENROLLMENTS') && (
                          <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 gap-3">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#3BA7F2]" />
                              New Enrollments:
                            </span>
                            <span className="font-bold tabular-nums">{enrollmentsVal.toLocaleString()}</span>
                          </div>
                        )}
                        {(throughputFilter === 'ALL' || throughputFilter === 'COMPLETIONS') && (
                          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 gap-3">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                              Completions:
                            </span>
                            <span className="font-bold tabular-nums">{completionsVal.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />

                {(throughputFilter === 'ALL' || throughputFilter === 'ENROLLMENTS') && (
                  <Area
                    isAnimationActive={true} animationBegin={0} animationDuration={1850} animationEasing="ease-out" type="monotone" dataKey="enrollments"
                    stroke="#3BA7F2"
                    strokeWidth={hoveredThroughputSeries === 'enrollments' ? 3.5 : 2.5}
                    strokeOpacity={hoveredThroughputSeries === 'completions' ? 0.35 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fillOpacity={hoveredThroughputSeries === 'completions' ? 0.25 : 1}
                    fill="url(#newsimColorEnrollments)"
                    name="New Enrollments"
                    activeDot={{
                      r: 6,
                      strokeWidth: 2.5,
                      stroke: '#ffffff',
                      fill: '#3BA7F2',
                    }}
                  />
                )}

                {(throughputFilter === 'ALL' || throughputFilter === 'COMPLETIONS') && (
                  <Area
                    isAnimationActive={true} animationBegin={120} animationDuration={1850} animationEasing="ease-out" type="monotone" dataKey="completions"
                    stroke="#10B981"
                    strokeWidth={hoveredThroughputSeries === 'completions' ? 3.5 : 2.5}
                    strokeOpacity={hoveredThroughputSeries === 'enrollments' ? 0.35 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fillOpacity={hoveredThroughputSeries === 'enrollments' ? 0.25 : 1}
                    fill="url(#newsimColorCompletions)"
                    name="Certified Completions"
                    activeDot={{
                      r: 6,
                      strokeWidth: 2.5,
                      stroke: '#ffffff',
                      fill: '#10B981',
                    }}
                  />
                )}
              </AreaChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 12,
                  left: -20,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={resolvedTheme === 'dark' ? '#1e293b' : '#e2e8f0'}
                />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(59,167,242,0.06)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const row = payload[0]?.payload || {};
                    const enrollmentsVal = Number(row.enrollments || 0);
                    const completionsVal = Number(row.completions || 0);
                    const convRate = enrollmentsVal > 0 ? Math.round((completionsVal / enrollmentsVal) * 100) : 0;

                    return (
                      <div className="rounded-2xl bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-xl text-xs font-mono space-y-2 min-w-[195px]">
                        <div className="font-bold text-slate-900 dark:text-slate-100 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span>{label} Cohort</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">
                            {convRate}% Certified
                          </span>
                        </div>
                        {(throughputFilter === 'ALL' || throughputFilter === 'ENROLLMENTS') && (
                          <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 gap-3">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#3BA7F2]" />
                              New Enrollments:
                            </span>
                            <span className="font-bold tabular-nums">{enrollmentsVal.toLocaleString()}</span>
                          </div>
                        )}
                        {(throughputFilter === 'ALL' || throughputFilter === 'COMPLETIONS') && (
                          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 gap-3">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                              Completions:
                            </span>
                            <span className="font-bold tabular-nums">{completionsVal.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                {(throughputFilter === 'ALL' || throughputFilter === 'ENROLLMENTS') && (
                  <Bar
                    isAnimationActive={true} animationBegin={0} animationDuration={1750} animationEasing="ease-out" dataKey="enrollments"
                    name="New Enrollments"
                    fill="#3BA7F2"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={32}
                  />
                )}
                {(throughputFilter === 'ALL' || throughputFilter === 'COMPLETIONS') && (
                  <Bar
                    isAnimationActive={true} animationBegin={100} animationDuration={1750} animationEasing="ease-out" dataKey="completions"
                    name="Certified Completions"
                    fill="#10B981"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={32}
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
              </ImmersiveChartFrame>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-4 font-mono text-xs text-slate-500 dark:border-slate-800 dark:text-[#CBD5E1] gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onMouseEnter={() => setHoveredThroughputSeries('enrollments')}
              onMouseLeave={() => setHoveredThroughputSeries(null)}
              onClick={() => setThroughputFilter(throughputFilter === 'ENROLLMENTS' ? 'ALL' : 'ENROLLMENTS')}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                throughputFilter === 'ENROLLMENTS'
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-400 font-bold'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#3BA7F2]" />
              <span>New Enrollments</span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                ({chartData.reduce((acc, d) => acc + Number(d.enrollments || 0), 0)})
              </span>
            </button>

            <button
              type="button"
              onMouseEnter={() => setHoveredThroughputSeries('completions')}
              onMouseLeave={() => setHoveredThroughputSeries(null)}
              onClick={() => setThroughputFilter(throughputFilter === 'COMPLETIONS' ? 'ALL' : 'COMPLETIONS')}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                throughputFilter === 'COMPLETIONS'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
              <span>Certified Completions</span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                ({chartData.reduce((acc, d) => acc + Number(d.completions || 0), 0)})
              </span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            Click legend pills to isolate series
          </span>
        </div>
      </motion.div>

      {/* =========================================================
          OPERATIONAL 3-COLUMN SECTION
      ========================================================== */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        {/* ATTENDANCE */}
        <motion.div
          variants={cascadeItem}
          whileHover={{ y: -2 }}
          className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-[#071521] dark:to-[#0d1512]"
        >
          <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 to-teal-500/15 text-emerald-600 shadow-inner dark:text-emerald-400">
                  <Calendar className="h-4 w-4" />
                </div>

                <div>
                  <h3 className="font-heading text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                    Today&apos;s Attendance
                  </h3>

                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>

                    Live Classroom Quorum
                  </div>
                </div>
              </div>

              {canRoute('/admin/attendance') && (
                <Link
                  href="/admin/attendance"
                  className="font-mono text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  View Roster →
                </Link>
              )}
            </div>

            {/* ATTENDANCE SUMMARY */}
            <div className="my-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent p-3.5">
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                  <svg
                    className="h-14 w-14 -rotate-90"
                    viewBox="0 0 36 36"
                    aria-hidden="true"
                  >
                    <path
                      className="text-slate-200 dark:text-[#F8FAFC]/10"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />

                    <motion.path
                      className={
                        activeAttendanceSegment === 'LATE'
                          ? 'text-amber-500'
                          : activeAttendanceSegment === 'ABSENT'
                          ? 'text-rose-500'
                          : 'text-emerald-500'
                      }
                      strokeDasharray="100, 100"
                      initial={{
                        strokeDashoffset: 100,
                      }}
                      whileInView={{
                        strokeDashoffset:
                          100 -
                          (activeAttendanceSegment === 'LATE'
                            ? attendanceToday.lateRate
                            : activeAttendanceSegment === 'ABSENT'
                            ? attendanceToday.absentRate
                            : attendanceToday.presentRate),
                      }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.9,
                        ease: easeOutCurve,
                      }}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                    <span className="text-xs font-extrabold leading-none text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                      {activeAttendanceSegment === 'LATE'
                        ? `${attendanceToday.lateRate}%`
                        : activeAttendanceSegment === 'ABSENT'
                        ? `${attendanceToday.absentRate}%`
                        : `${attendanceToday.presentRate}%`}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                    {activeAttendanceSegment === 'LATE'
                      ? 'Late Check-in'
                      : activeAttendanceSegment === 'ABSENT'
                      ? 'Absent Count'
                      : 'Total Check-in'}
                  </span>

                  <div className="font-heading text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                    {activeAttendanceSegment === 'LATE'
                      ? attendanceToday.late
                      : activeAttendanceSegment === 'ABSENT'
                      ? attendanceToday.absent
                      : attendanceToday.present}{' '}
                    /{' '}
                    {attendanceToday.totalCheckedIn}{' '}
                    <span className="font-mono text-xs font-normal text-slate-500">
                      {activeAttendanceSegment === 'LATE'
                        ? 'Late'
                        : activeAttendanceSegment === 'ABSENT'
                        ? 'Absent'
                        : 'Present'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ATTENDANCE BARS */}
            <div className="space-y-3">
              {/* PRESENT */}
              <motion.div
                onMouseEnter={() => setActiveAttendanceSegment('PRESENT')}
                onMouseLeave={() => setActiveAttendanceSegment(null)}
                whileHover={{ x: 2 }}
                className="p-1.5 -mx-1.5 rounded-xl hover:bg-emerald-500/5 transition-colors cursor-pointer"
              >
                <div className="mb-1 flex justify-between font-mono text-xs text-slate-600 dark:text-[#CBD5E1]">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    Present ({attendanceToday.presentRate}%)
                  </span>

                  <span className="font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                    {attendanceToday.present} Trainees
                  </span>
                </div>

                <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{
                      width: `${attendanceToday.presentRate}%`,
                    }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.8,
                      ease: easeOutCurve,
                    }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"
                  />
                </div>
              </motion.div>

              {/* LATE */}
              <motion.div
                onMouseEnter={() => setActiveAttendanceSegment('LATE')}
                onMouseLeave={() => setActiveAttendanceSegment(null)}
                whileHover={{ x: 2 }}
                className="p-1.5 -mx-1.5 rounded-xl hover:bg-amber-500/5 transition-colors cursor-pointer"
              >
                <div className="mb-1 flex justify-between font-mono text-xs text-slate-600 dark:text-[#CBD5E1]">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Late ({attendanceToday.lateRate}%)
                  </span>

                  <span className="font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                    {attendanceToday.late} Trainees
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{
                      width: `${attendanceToday.lateRate}%`,
                    }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.8,
                      delay: 0.08,
                      ease: easeOutCurve,
                    }}
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                  />
                </div>
              </motion.div>

              {/* ABSENT */}
              <motion.div
                onMouseEnter={() => setActiveAttendanceSegment('ABSENT')}
                onMouseLeave={() => setActiveAttendanceSegment(null)}
                whileHover={{ x: 2 }}
                className="p-1.5 -mx-1.5 rounded-xl hover:bg-rose-500/5 transition-colors cursor-pointer"
              >
                <div className="mb-1 flex justify-between font-mono text-xs text-slate-600 dark:text-[#CBD5E1]">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Absent ({attendanceToday.absentRate}%)
                  </span>

                  <span className="font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                    {attendanceToday.absent} Trainees
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{
                      width: `${attendanceToday.absentRate}%`,
                    }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.8,
                      delay: 0.16,
                      ease: easeOutCurve,
                    }}
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-red-600"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* TODAY'S SCHEDULE */}
        <motion.div
          variants={cascadeItem}
          whileHover={{ y: -2 }}
          className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-[#071521] dark:to-[#0d1512]"
        >
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-teal-500" />

                <h3 className="font-heading text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                  Today&apos;s Training Sessions
                </h3>
              </div>

              {canRoute('/admin/schedules') && (
                <Link
                  href="/admin/schedules"
                  className="font-mono text-xs text-teal-600 hover:underline dark:text-teal-400"
                >
                  Full Calendar →
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {todaySchedules.length > 0 ? (
                todaySchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800"
                  >
                    <div className="mt-0.5 shrink-0 rounded bg-teal-500/10 px-2 py-1 font-mono text-[10px] font-bold text-teal-600 dark:text-teal-400">
                      {schedule.startTime}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-slate-900 dark:text-[#F8FAFC]">
                        {schedule.courseTitle}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11px] text-slate-500 dark:text-[#CBD5E1]">
                        <span>{schedule.room} •</span>
                        <UserAvatar
                          src={schedule.instructorAvatarUrl}
                          name={schedule.instructorName}
                          alt={schedule.instructorName || 'Instructor'}
                          className="w-4 h-4 rounded-md"
                          fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold"
                        />
                        <span className="truncate">{schedule.instructorName}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  No sessions scheduled for today
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* PENDING PAYMENTS OR ACADEMIC STANDARDS */}
        <motion.div
          variants={cascadeItem}
          whileHover={{ y: -2 }}
          className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-[#071521] dark:to-[#0d1512]"
        >
          <div>
            {data?.hasFinancialAccess !== false && canRoute('/admin/payments') ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-emerald-500" />

                    <h3 className="font-heading text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                      Payment Verification Queue
                    </h3>
                  </div>

                  <Link
                    href="/admin/payments"
                    className="font-mono text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    Verify All →
                  </Link>
                </div>

                <div className="space-y-3">
                  {pendingPaymentsList.length > 0 ? (
                    pendingPaymentsList.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            src={payment.traineeAvatarUrl}
                            name={payment.traineeName}
                            alt={payment.traineeName || 'Trainee'}
                            className="w-8 h-8 rounded-xl"
                            fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-slate-900 dark:text-[#F8FAFC]">
                              {payment.traineeName}
                            </div>

                            <div className="w-32 truncate font-mono text-[11px] text-slate-400">
                              {payment.courseTitle}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                            ₱{formatAmount(payment.amount)}
                          </div>

                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] text-amber-600 dark:text-amber-400">
                            {payment.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                      No pending payments
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-sky-500" />

                    <h3 className="font-heading text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                      Grading & Evaluation Policy
                    </h3>
                  </div>

                  {canRoute('/admin/grading-policies') && (
                    <Link
                      href="/admin/grading-policies"
                      className="font-mono text-xs text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Manage Policies →
                    </Link>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <span>Formula Breakdown</span>
                      <span className="font-mono text-sky-600 dark:text-sky-400">100% Total</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                        <div className="font-bold text-slate-900 dark:text-white">10%</div>
                        <div className="text-slate-400 text-[9px]">Attendance</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                        <div className="font-bold text-sky-600 dark:text-sky-400">50%</div>
                        <div className="text-slate-400 text-[9px]">Practical</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400">40%</div>
                        <div className="text-slate-400 text-[9px]">Quizzes</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Mandatory Min. Attendance</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">80.0%</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* =========================================================
          QUICK ACTIONS
      ========================================================== */}
      {quickActions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.35,
            ease: easeCurve,
          }}
          className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-[#071521] dark:to-[#0d1512]"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-emerald-500" />

            <h3 className="font-heading text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC]">
              Operational Quick Actions
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickActions.map((act) => {
              const Icon = act.icon;
              return (
                <Link
                  key={act.href}
                  href={act.href}
                  className={`group flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50 p-3 text-left transition-all dark:border-slate-800 dark:bg-slate-800 ${act.cardHover}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${act.iconBox} group-hover:scale-105 transition-transform`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC]">
                        {act.title}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {act.subtitle}
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className={`h-4 w-4 text-slate-400 opacity-60 group-hover:opacity-100 transition-all ${act.arrowHover}`} />
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
