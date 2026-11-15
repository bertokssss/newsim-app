'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Users,
  GraduationCap,
  UserCheck,
  TrendingUp,
  RefreshCw,
  Calendar,
  Layers,
  ShieldCheck,
  LineChart as LucideLineChart,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, Area, AreaChart, Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Button, useTheme, ImmersiveChartFrame } from '@newsim/ui';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
 } from '@newsim/ui';
import { 
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
 } from '@newsim/ui';
import {  Badge  } from '@newsim/ui';

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

export default function AnalyticsClient() {
  const { resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'USERS' | 'TRAINING' | 'ENROLLMENT' | 'GOVERNANCE' | 'INSTRUCTORS'>('USERS');
  const [timeRange, setTimeRange] = useState('30d');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsChartType, setAnalyticsChartType] = useState<'area' | 'line' | 'bar'>('area');
  const [analyticsSeriesMode, setAnalyticsSeriesMode] = useState<'BOTH' | 'TRAINEES' | 'ENROLLMENTS'>('BOTH');
  const [hoveredPipelineStep, setHoveredPipelineStep] = useState<number | null>(null);
  const [chartInView, setChartInView] = useState(false);
  const [trainingChartInView, setTrainingChartInView] = useState(false);
  const [facultyChartInView, setFacultyChartInView] = useState(false);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/analytics?timeRange=${timeRange}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  if (isLoading && !data) {
    return (
      <div className="space-y-6 sm:space-y-8 animate-pulse pb-8">
        {/* Header Skeleton */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 w-full">
            <div className="h-8 w-72 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-4 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-9 w-9 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>

        {/* Chart Panel Skeleton */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="space-y-2">
            <div className="h-5 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
          <div className="h-[320px] w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  const userOverview = data?.userOverview || {};
  const trainingOverview = data?.trainingOverview || {};
  const pipeline = data?.enrollmentPipeline || {};
  const accountLifecycle = data?.accountLifecycle || {};
  const instructorMetrics = data?.instructorMetrics || {};

  const userGrowthChartData = data?.chartData?.length > 0 
    ? data.chartData.map((d: any) => ({
        month: d.name,
        trainees: Number(d.trainees || 0),
        enrollments: Number(d.enrollments || d.totalEnrollments || 0),
      }))
    : [
        { month: "Jan", trainees: 0, enrollments: 0 },
        { month: "Feb", trainees: 0, enrollments: 0 },
        { month: "Mar", trainees: 0, enrollments: 0 },
        { month: "Apr", trainees: 0, enrollments: 0 },
        { month: "May", trainees: 0, enrollments: 0 },
        { month: "Jun", trainees: 0, enrollments: 0 },
      ];

  const chartConfig = {
    trainees: {
      label: "Registered Seafarers",
      color: "#0ea5e9",
    },
    enrollments: {
      label: "Course Enrollments",
      color: "#0d9488",
    },
  } satisfies ChartConfig;

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-200">
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-heading flex items-center gap-2">
            <span>Global System Analytics</span>
            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/80">
              TELEMETRY
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Macro-level metrics across registered seafarers, maritime training programs, campus cohorts, account governance, and faculty operations.
          </p>
          <div className="pt-1">
            <LiveClock />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
          <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
            {[
              { label: 'Today', value: 'today' },
              { label: '7D', value: '7d' },
              { label: '30D', value: '30d' },
              { label: '3M', value: '90d' },
              { label: '6M', value: '180d' },
              { label: '1Y', value: '1y' },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setTimeRange(item.value)}
                className={`px-3 py-1 text-xs font-mono rounded-lg transition-all cursor-pointer ${
                  timeRange === item.value
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Button variant="secondary" size="sm" onClick={fetchAnalytics} disabled={isLoading} className="cursor-pointer border-slate-200 dark:border-slate-800">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-2">
        {[
          { id: 'USERS', label: 'User Analytics', icon: Users },
          { id: 'TRAINING', label: 'Training Analytics', icon: GraduationCap },
          { id: 'ENROLLMENT', label: 'Enrollment Pipeline', icon: Layers },
          { id: 'GOVERNANCE', label: 'Account Governance', icon: ShieldCheck },
          { id: 'INSTRUCTORS', label: 'Faculty & Simulators', icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer relative ${
                isActive
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 dark:bg-sky-400 rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Animated Tab Content Switcher */}
      <AnimatePresence mode="wait">
        {/* Tab 1: USER ANALYTICS */}
        {activeTab === 'USERS' && (
          <motion.div
            key="tab-users"
            initial={{ opacity: 0, y: 15, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.99 }}
            transition={{ duration: 0.3, ease: easeCurve }}
            className="space-y-6"
          >
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {[
                { label: 'Total System Accounts', value: userOverview.totalAccounts ? userOverview.totalAccounts.toLocaleString() : '0', delta: 'Live Database Records', deltaColor: 'text-emerald-600 dark:text-emerald-400', valueColor: 'text-slate-900 dark:text-white' },
                { label: 'Active Seafarer Trainees', value: userOverview.activeTrainees ? userOverview.activeTrainees.toLocaleString() : '0', delta: 'Registered Trainees', deltaColor: 'text-slate-500 dark:text-slate-400', valueColor: 'text-sky-600 dark:text-sky-400' },
                { label: 'Faculty Instructors', value: instructorMetrics.totalInstructors ? instructorMetrics.totalInstructors.toLocaleString() : '0', delta: 'Assigned Faculty', deltaColor: 'text-slate-500 dark:text-slate-400', valueColor: 'text-slate-900 dark:text-white' },
                { label: 'Operational Admins', value: userOverview.admins ? userOverview.admins.toLocaleString() : '0', delta: 'Center Administrators', deltaColor: 'text-slate-500 dark:text-slate-400', valueColor: 'text-slate-900 dark:text-white' },
              ].map((kpi) => (
                <motion.div
                  key={kpi.label}
                  variants={cascadeItem}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="relative p-5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all overflow-hidden"
                >
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">{kpi.label}</span>
                  <div className={`text-2xl font-bold ${kpi.valueColor} mt-1 font-heading`}>{kpi.value}</div>
                  <div className={`text-[11px] ${kpi.deltaColor} font-mono mt-1 font-semibold`}>{kpi.delta}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Interactive Multi-Mode Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              onViewportEnter={() => setChartInView(true)}
              transition={{ duration: 0.45, ease: easeOutCurve }}
            >
              <Card className="bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <span>Platform User Growth &amp; Active Concurrency</span>
                      <Badge
                        variant="outline"
                        className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 font-semibold"
                      >
                        <TrendingUp className="h-3.5 w-3.5 mr-1" />
                        <span>+18.2% YTD</span>
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Monthly registered STCW seafarers and course enrollments
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Series Filter */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono">
                      {([
                        { id: 'BOTH', label: 'Dual' },
                        { id: 'TRAINEES', label: 'Seafarers' },
                        { id: 'ENROLLMENTS', label: 'Enrollments' },
                      ] as const).map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setAnalyticsSeriesMode(mode.id)}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            analyticsSeriesMode === mode.id
                              ? 'bg-white dark:bg-slate-700 font-bold text-sky-600 dark:text-sky-400 shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>

                    {/* Chart Type Switcher */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono">
                      {([
                        { id: 'area', label: 'Area' },
                        { id: 'line', label: 'Line' },
                        { id: 'bar', label: 'Bar' },
                      ] as const).map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setAnalyticsChartType(type.id)}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            analyticsChartType === type.id
                              ? 'bg-white dark:bg-slate-700 font-bold text-slate-900 dark:text-white shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`analytics-chart-${analyticsChartType}-${analyticsSeriesMode}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.35, ease: easeOutCurve }}
                      className="w-full h-full"
                    >
                      <ImmersiveChartFrame
                        ready={!isLoading && Boolean(data)}
                        triggerKey={`analytics-${analyticsChartType}-${analyticsSeriesMode}-${timeRange}-${chartInView ? 'in' : 'wait'}`}
                        duration={1.95}
                        className="w-full h-[320px]"
                      >
                      <ChartContainer config={chartConfig} className="aspect-auto h-[320px] w-full">
                    {analyticsChartType === 'area' ? (
                      <AreaChart
                        accessibilityLayer
                        data={userGrowthChartData}
                        margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
                      >
                        <defs>
                          <linearGradient id="analyticsTraineesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.38} />
                            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="analyticsEnrollmentsGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          className="text-xs text-slate-500 font-mono"
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          allowDecimals={false}
                          className="text-xs text-slate-500 font-mono"
                        />
                        <ChartTooltip
                          cursor={{ stroke: '#0ea5e9', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                          content={<ChartTooltipContent />}
                        />
                        {(analyticsSeriesMode === 'BOTH' || analyticsSeriesMode === 'TRAINEES') && (
                          <Area
                            dataKey="trainees"
                            name="Registered Seafarers"
                            type="monotone"
                            stroke="#0ea5e9"
                            fill="url(#analyticsTraineesGrad)"
                            fillOpacity={1}
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            activeDot={{ r: 6, fill: '#0ea5e9', strokeWidth: 2.5, stroke: '#ffffff' }}
                            isAnimationActive={true} animationBegin={0} animationDuration={1850} animationEasing="ease-out"
                          />
                        )}
                        {(analyticsSeriesMode === 'BOTH' || analyticsSeriesMode === 'ENROLLMENTS') && (
                          <Area
                            dataKey="enrollments"
                            name="Course Enrollments"
                            type="monotone"
                            stroke="#0d9488"
                            fill="url(#analyticsEnrollmentsGrad)"
                            fillOpacity={1}
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            activeDot={{ r: 6, fill: '#0d9488', strokeWidth: 2.5, stroke: '#ffffff' }}
                            isAnimationActive={true} animationBegin={120} animationDuration={1850} animationEasing="ease-out"
                          />
                        )}
                      </AreaChart>
                    ) : analyticsChartType === 'line' ? (
                      <LineChart
                        accessibilityLayer
                        data={userGrowthChartData}
                        margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          className="text-xs text-slate-500 font-mono"
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          allowDecimals={false}
                          className="text-xs text-slate-500 font-mono"
                        />
                        <ChartTooltip
                          cursor={{ stroke: '#0ea5e9', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                          content={<ChartTooltipContent />}
                        />
                        {(analyticsSeriesMode === 'BOTH' || analyticsSeriesMode === 'TRAINEES') && (
                          <Line
                            dataKey="trainees"
                            name="Registered Seafarers"
                            type="monotone"
                            stroke="#0ea5e9"
                            dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#ffffff' }}
                            activeDot={{ r: 6, fill: '#0ea5e9', strokeWidth: 2.5, stroke: '#ffffff' }}
                            strokeWidth={2.5}
                            isAnimationActive={true} animationBegin={0} animationDuration={1850} animationEasing="ease-out"
                          />
                        )}
                        {(analyticsSeriesMode === 'BOTH' || analyticsSeriesMode === 'ENROLLMENTS') && (
                          <Line
                            dataKey="enrollments"
                            name="Course Enrollments"
                            type="monotone"
                            stroke="#0d9488"
                            dot={{ r: 4, fill: '#0d9488', strokeWidth: 2, stroke: '#ffffff' }}
                            activeDot={{ r: 6, fill: '#0d9488', strokeWidth: 2.5, stroke: '#ffffff' }}
                            strokeWidth={2.5}
                            isAnimationActive={true} animationBegin={120} animationDuration={1850} animationEasing="ease-out"
                          />
                        )}
                      </LineChart>
                    ) : (
                      <BarChart
                        accessibilityLayer
                        data={userGrowthChartData}
                        margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          className="text-xs text-slate-500 font-mono"
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          allowDecimals={false}
                          className="text-xs text-slate-500 font-mono"
                        />
                        <ChartTooltip
                          cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }}
                          content={<ChartTooltipContent />}
                        />
                        {(analyticsSeriesMode === 'BOTH' || analyticsSeriesMode === 'TRAINEES') && (
                          <Bar
                            dataKey="trainees"
                            name="Registered Seafarers"
                            fill="#0ea5e9"
                            radius={[5, 5, 0, 0]}
                            maxBarSize={32}
                            isAnimationActive={true} animationBegin={0} animationDuration={1750} animationEasing="ease-out"
                          />
                        )}
                        {(analyticsSeriesMode === 'BOTH' || analyticsSeriesMode === 'ENROLLMENTS') && (
                          <Bar
                            dataKey="enrollments"
                            name="Course Enrollments"
                            fill="#0d9488"
                            radius={[5, 5, 0, 0]}
                            maxBarSize={32}
                            isAnimationActive={true} animationBegin={100} animationDuration={1750} animationEasing="ease-out"
                          />
                        )}
                      </BarChart>
                    )}
                  </ChartContainer>
                      </ImmersiveChartFrame>
                    </motion.div>
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}

        {/* Tab 2: TRAINING ANALYTICS */}
        {activeTab === 'TRAINING' && (
          <motion.div
            key="tab-training"
            initial={{ opacity: 0, y: 15, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.99 }}
            transition={{ duration: 0.3, ease: easeCurve }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'STCW Certified Courses', value: trainingOverview.certifiedCourses !== undefined ? trainingOverview.certifiedCourses : 0, sub: 'Published Programs', color: 'text-slate-900 dark:text-white' },
                { label: 'Live Simulator Sessions', value: trainingOverview.liveSessions !== undefined ? trainingOverview.liveSessions : 0, sub: 'Bridge & Engine Sim', color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Trainee Completions YTD', value: trainingOverview.completionsYTD !== undefined ? trainingOverview.completionsYTD.toLocaleString() : 0, sub: 'Completed Enrollments', color: 'text-slate-900 dark:text-white' },
                { label: 'Overall Pass Rate', value: trainingOverview.completionRate || '0%', sub: 'Course Completion Rate', color: 'text-emerald-600 dark:text-emerald-400' },
              ].map((item, idx) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.4, delay: idx * 0.06, ease: easeCurve }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="relative p-5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all overflow-hidden"
                >
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">{item.label}</span>
                  <div className={`text-2xl font-bold ${item.color} mt-1 font-heading`}>{item.value}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1 font-medium">{item.sub}</div>
                </motion.div>
              ))}
            </div>

            {/* Popular Courses Performance Table & Visualizer */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              onViewportEnter={() => setTrainingChartInView(true)}
              transition={{ duration: 0.45, ease: easeOutCurve }}
              className="rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs space-y-4"
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-sky-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">High-Volume Maritime Course Metrics & Enrollment Volume</h3>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Ranked by Enrollment</span>
              </div>

              {/* Course Telemetry BarChart */}
              <div className="px-4 pb-2 h-44 w-full">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`training-course-chart-${timeRange}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.35, ease: easeOutCurve }}
                    className="w-full h-full"
                  >
                    <ImmersiveChartFrame
                      ready={!isLoading && Boolean(data)}
                      triggerKey={`training-${timeRange}-${trainingChartInView ? 'in' : 'wait'}`}
                      duration={1.85}
                      className="w-full h-full"
                    >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trainingOverview.topCourses || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={resolvedTheme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="code" stroke="#94a3b8" fontSize={11} fontFamily="monospace" tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} fontFamily="monospace" tickLine={false} allowDecimals={false} />
                        <Tooltip
                          cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(14,165,233,0.06)' }}
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;
                            const item = payload[0]?.payload || {};
                            return (
                              <div className="rounded-xl bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 shadow-xl text-xs font-mono space-y-1">
                                <div className="font-bold text-slate-900 dark:text-white">{item.code}: {item.name || item.title}</div>
                                <div className="text-sky-600 dark:text-sky-400 font-bold">{(item.trainees || 0).toLocaleString()} Trainees Enrolled</div>
                                <div className="text-emerald-600 dark:text-emerald-400 font-bold">{item.completionRate || 'N/A'} Completion Rate</div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="trainees"
                          name="Enrolled Trainees"
                          fill="#0ea5e9"
                          radius={[5, 5, 0, 0]}
                          maxBarSize={36}
                          isAnimationActive={true}
                          animationDuration={1800}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    </ImmersiveChartFrame>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Course Code & Title</th>
                      <th className="py-3.5 px-4">Trainees Enrolled</th>
                      <th className="py-3.5 px-4">Completion Rate</th>
                      <th className="py-3.5 px-4">Assessment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(trainingOverview.topCourses || []).map((c: any, idx: number) => (
                      <motion.tr
                        key={c.code}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.25, delay: idx * 0.04, ease: easeCurve }}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-sky-600 dark:text-sky-400 font-bold mr-2">{c.code}</span>
                          <span className="text-slate-900 dark:text-white font-semibold">{c.name || c.title}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium">{(c.trainees || 0).toLocaleString()}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">{c.completionRate || 'N/A'}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80 text-[10px] font-mono font-semibold">
                            MARINA Approved
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Tab 3: ENROLLMENT PIPELINE */}
        {activeTab === 'ENROLLMENT' && (
          <motion.div
            key="tab-enrollment"
            initial={{ opacity: 0, y: 15, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.99 }}
            transition={{ duration: 0.3, ease: easeCurve }}
            className="space-y-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ duration: 0.45, ease: easeCurve }}
              className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Global Trainee Conversion Pipeline</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Step-by-step conversion analytics from application submission to certificate issue.</p>
              </div>

              <div className="space-y-3">
                {[
                  { stage: '1. Applications Submitted', count: pipeline.applications !== undefined ? pipeline.applications : 0, pct: pipeline.applicationsPct || '0%', color: 'bg-slate-400 dark:bg-slate-500' },
                  { stage: '2. Approved by Admin Operations', count: pipeline.approved !== undefined ? pipeline.approved : 0, pct: pipeline.approvedPct || '0%', color: 'bg-sky-500' },
                  { stage: '3. Pre-Requisites & Eligibility Verified', count: pipeline.enrolled !== undefined ? pipeline.enrolled : 0, pct: pipeline.enrolledPct || '0%', color: 'bg-indigo-500' },
                  { stage: '4. Officially Enrolled in Cohort', count: pipeline.enrolled !== undefined ? pipeline.enrolled : 0, pct: pipeline.enrolledPct || '0%', color: 'bg-teal-500' },
                  { stage: '5. Training in Progress', count: pipeline.inTraining !== undefined ? pipeline.inTraining : 0, pct: pipeline.inTrainingPct || '0%', color: 'bg-blue-600' },
                  { stage: '6. Completed & Certified', count: pipeline.completed !== undefined ? pipeline.completed : 0, pct: pipeline.completedPct || '0%', color: 'bg-emerald-500' },
                ].map((step, idx) => {
                  const isHovered = hoveredPipelineStep === idx;
                  return (
                    <motion.div
                      key={step.stage}
                      onMouseEnter={() => setHoveredPipelineStep(idx)}
                      onMouseLeave={() => setHoveredPipelineStep(null)}
                      whileHover={{ x: 3 }}
                      className={`p-2 -mx-2 rounded-xl transition-colors cursor-pointer space-y-1.5 ${
                        isHovered ? 'bg-slate-50 dark:bg-slate-800/60' : ''
                      }`}
                    >
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">{step.stage}</span>
                        <span className="text-slate-900 dark:text-white font-bold tabular-nums">{step.count.toLocaleString()} trainees ({step.pct})</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200/80 dark:border-slate-800 p-0.5">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: step.pct }}
                          viewport={{ once: true, amount: 0.2 }}
                          transition={{ duration: 0.85, ease: easeOutCurve, delay: idx * 0.08 }}
                          className={`h-full rounded-full ${step.color} shadow-xs transition-all ${isHovered ? 'brightness-110' : ''}`}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Tab 4: ACCOUNT GOVERNANCE */}
        {activeTab === 'GOVERNANCE' && (
          <motion.div
            key="tab-governance"
            initial={{ opacity: 0, y: 15, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.99 }}
            transition={{ duration: 0.3, ease: easeCurve }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Admin-Provisioned Accounts', value: accountLifecycle.createdByAdmin !== undefined ? accountLifecycle.createdByAdmin.toLocaleString() : 0, delta: 'Managed Provisioning', color: 'text-slate-900 dark:text-white' },
                { label: 'Self-Registered Trainees', value: accountLifecycle.selfRegistered !== undefined ? accountLifecycle.selfRegistered.toLocaleString() : 0, delta: 'Portal Registrations', color: 'text-sky-600 dark:text-sky-400' },
                { label: 'MFA Security Adoption', value: accountLifecycle.mfaCoverage || '0%', delta: 'TOTP Enforced', color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Restricted / Locked Accounts', value: accountLifecycle.lockedAccounts !== undefined ? accountLifecycle.lockedAccounts : 0, delta: 'Security Policies Enforced', color: 'text-amber-600 dark:text-amber-400' },
              ].map((item, idx) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.4, delay: idx * 0.06, ease: easeCurve }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="relative p-5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all overflow-hidden"
                >
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">{item.label}</span>
                  <div className={`text-2xl font-bold ${item.color} mt-1 font-heading`}>{item.value}</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1 font-semibold">{item.delta}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tab 5: INSTRUCTORS & SIMULATORS */}
        {activeTab === 'INSTRUCTORS' && (
          <motion.div
            key="tab-instructors"
            initial={{ opacity: 0, y: 15, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.99 }}
            transition={{ duration: 0.3, ease: easeCurve }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Instructors', value: instructorMetrics.totalInstructors !== undefined ? instructorMetrics.totalInstructors : 0, sub: 'All verified Master/Engineers', color: 'text-slate-900 dark:text-white' },
                { label: 'Active Simulator Instructors', value: instructorMetrics.activeTeaching !== undefined ? instructorMetrics.activeTeaching : 0, sub: 'Currently conducting classes', color: 'text-teal-600 dark:text-teal-400' },
                { label: 'Sessions Handled (Month)', value: instructorMetrics.sessionsConductedMonth !== undefined ? instructorMetrics.sessionsConductedMonth : 0, sub: 'Full mission simulations', color: 'text-indigo-600 dark:text-indigo-400' },
                { label: 'Average Trainee Rating', value: instructorMetrics.avgStudentRating || 'N/A', sub: instructorMetrics.avgStudentRating ? 'Verified trainee feedback' : 'No evaluation survey table yet', color: 'text-amber-600 dark:text-amber-400' },
              ].map((item, idx) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.4, delay: idx * 0.06, ease: easeCurve }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="relative p-5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all overflow-hidden"
                >
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">{item.label}</span>
                  <div className={`text-2xl font-bold ${item.color} mt-1 font-heading`}>{item.value}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1 font-semibold">{item.sub}</div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              onViewportEnter={() => setFacultyChartInView(true)}
              transition={{ duration: 0.45, ease: easeOutCurve }}
              className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Faculty Distribution by Maritime Discipline</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">Certified Faculty</span>
              </div>

              {/* Faculty Specialization Bar Chart */}
              <div className="h-44 w-full pt-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`faculty-spec-chart-${timeRange}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.35, ease: easeOutCurve }}
                    className="w-full h-full"
                  >
                    <ImmersiveChartFrame
                      ready={!isLoading && Boolean(data)}
                      triggerKey={`faculty-${timeRange}-${facultyChartInView ? 'in' : 'wait'}`}
                      duration={1.85}
                      className="w-full h-full"
                    >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={instructorMetrics.topSpecializations || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={resolvedTheme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontFamily="monospace" tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} fontFamily="monospace" tickLine={false} allowDecimals={false} />
                        <Tooltip
                          cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.06)' }}
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;
                            const item = payload[0]?.payload || {};
                            return (
                              <div className="rounded-xl bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 shadow-xl text-xs font-mono space-y-1">
                                <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                                <div className="text-indigo-600 dark:text-indigo-400 font-bold">{item.count} Certified Instructors</div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="count"
                          name="Instructors"
                          fill="#6366f1"
                          radius={[5, 5, 0, 0]}
                          maxBarSize={36}
                          isAnimationActive={true}
                          animationDuration={1800}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    </ImmersiveChartFrame>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(instructorMetrics.topSpecializations || []).map((spec: any, idx: number) => (
                  <motion.div
                    key={spec.name}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: idx * 0.05, ease: easeCurve }}
                    whileHover={{ y: -2, transition: { duration: 0.2 } }}
                    className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800"
                  >
                    <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{spec.name}</div>
                    <div className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1 font-heading">{spec.count}</div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Certified Instructors</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
