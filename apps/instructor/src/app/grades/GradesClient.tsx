'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Search,
  CheckCircle2,
  AlertTriangle,
  Award,
  X,
  Edit3,
  Sparkles,
  BookOpen,
  Compass,
  FileCheck,
  ShieldCheck,
  Filter
} from 'lucide-react';
import { TablePageSkeleton, ImmersiveChartFrame, UserAvatar } from '@newsim/ui';
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

export default function GradesClient() {
  const [chartInView, setChartInView] = useState(false);
  const [chartMetric, setChartMetric] = useState<'ALL' | 'MODULAR' | 'PRACTICAL'>('ALL');
  const [gradebook, setGradebook] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [modularAssessments, setModularAssessments] = useState<any[]>([]);
  const [practicalAssessments, setPracticalAssessments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [courseId, setCourseId] = useState('');
  const [viewFilter, setViewFilter] = useState<'ALL' | 'MODULAR' | 'PRACTICAL'>('ALL');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    traineeId: string;
    assessmentId: string;
    traineeName: string;
    traineeAvatarUrl?: string | null;
    assessmentTitle: string;
    category: string;
    submissionId: string;
    currentScore: number;
    maxScore: number;
    feedback: string;
  } | null>(null);

  const [newScore, setNewScore] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/instructor/my-courses');
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setCourses(json.data);
          setCourseId(json.data[0].id);
        } else {
          setCourses([]);
          setCourseId('');
        }
      } catch (err) {
        console.error('Failed to load instructor courses:', err);
      }
    };
    fetchCourses();
  }, []);

  const fetchGradebook = async () => {
    if (!courseId) {
      setGradebook([]);
      setAssessments([]);
      setModularAssessments([]);
      setPracticalAssessments([]);
      setSummary({});
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/instructor/grades?courseId=${courseId}`);
      const json = await res.json();
      if (json.success) {
        setGradebook(json.data.gradebook || []);
        setAssessments(json.data.assessments || []);
        setModularAssessments(json.data.modularAssessments || []);
        setPracticalAssessments(json.data.practicalAssessments || []);
        setSummary(json.data.summary || {});
      }
    } catch (err) {
      console.error('Failed to load gradebook data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGradebook();
  }, [courseId]);

  const handleEditGrade = (trainee: any, asm: any, cellData: any) => {
    setSelectedCell({
      traineeId: trainee.traineeId,
      assessmentId: asm.id,
      traineeName: trainee.traineeName,
      traineeAvatarUrl: trainee.traineeAvatarUrl || null,
      assessmentTitle: asm.title,
      category: asm.category || 'MODULAR',
      submissionId: cellData?.submissionId || `sub-new-${Date.now()}`,
      currentScore: cellData?.score ?? 0,
      maxScore: asm.totalPoints || 100,
      feedback: cellData?.feedback || '',
    });
    setNewScore(cellData?.score ?? 85);
    setFeedback(cellData?.feedback || '');
    setReason('');
    setEditModalOpen(true);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCell) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/instructor/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: selectedCell.submissionId,
          traineeId: selectedCell.traineeId,
          assessmentId: selectedCell.assessmentId,
          score: Number(newScore),
          feedback,
          reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditModalOpen(false);
        await fetchGradebook();
      }
    } catch (err) {
      console.error('Failed to save assessment score:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = gradebook.filter(
    (t) =>
      t.traineeName.toLowerCase().includes(search.toLowerCase()) ||
      t.srn.toLowerCase().includes(search.toLowerCase()) ||
      t.rank.toLowerCase().includes(search.toLowerCase())
  );

  const chartGradeData = React.useMemo(() => {
    return filtered.slice(0, 10).map((t) => {
      const modularScore = typeof t.modularAverage === 'number' ? t.modularAverage : 80;
      const practicalScore = typeof t.practicalAverage === 'number' ? t.practicalAverage : 85;
      const finalGrade = typeof t.finalGrade === 'number' ? t.finalGrade : 82;
      return {
        name: t.traineeName?.split(' ')[0] || t.srn || 'Trainee',
        fullName: t.traineeName,
        modular: modularScore,
        practical: practicalScore,
        final: finalGrade,
      };
    });
  }, [filtered]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOutCurve }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm"
      >
        <div className="relative z-10 space-y-2 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              STCW Gradebook Matrix
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Modular Theory & Practical Simulator Gradebook
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed font-sans">
            Validate theoretical modular quizzes and practical simulator drill evaluations separately. All recorded scores sync to the trainee records and trigger audited change logs.
          </p>
        </div>
      </motion.div>

      {/* Telemetry Metric Score Containers (Modular vs Practical Differentiation) */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Modular Theory Class Average */}
        <motion.div variants={cascadeItem} className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-blue-200/60 dark:border-blue-900/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
              Modular Theory
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            {summary.classModularAverage ? `${summary.classModularAverage}%` : '--'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-[#CBD5E1] mt-1">
            Benchmark: 75% • {summary.totalModularAssessments ?? modularAssessments.length} Tests
          </div>
        </motion.div>

        {/* Practical Simulator Class Average */}
        <motion.div variants={cascadeItem} className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-emerald-200/60 dark:border-emerald-900/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              Practical Simulator
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            {summary.classPracticalAverage ? `${summary.classPracticalAverage}%` : '--'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-[#CBD5E1] mt-1">
            Benchmark: 75% • {summary.totalPracticalAssessments ?? practicalAssessments.length} Drills
          </div>
        </motion.div>

        {/* STCW Qualification Status */}
        <motion.div variants={cascadeItem} className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-violet-200/60 dark:border-violet-900/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
              STCW Qualification
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            {summary.qualifiedCount ?? 0} / {summary.totalTrainees ?? gradebook.length}
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-[#CBD5E1] mt-1">
            {summary.totalTrainees > 0 ? Math.round(((summary.qualifiedCount || 0) / summary.totalTrainees) * 100) : 0}% Dual-Competency Qualified
          </div>
        </motion.div>

        {/* Total Evaluations Logged */}
        <motion.div variants={cascadeItem} className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
              Evaluation Battery
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            {assessments.length} Tests
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-[#CBD5E1] mt-1">
            {modularAssessments.length} Modular • {practicalAssessments.length} Practical
          </div>
        </motion.div>
      </motion.div>

      {/* Interactive Gradebook Telemetry Chart */}
      {filtered.length > 0 && (
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
              <GraduationCap className="w-5 h-5 text-sky-500" />
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                  STCW Modular Theory vs Practical Simulator Performance
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Comparative analysis across cohort seafarers against the 75% benchmark
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold self-start sm:self-auto">
              <button
                onClick={() => setChartMetric('ALL')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMetric === 'ALL'
                    ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All Metrics
              </button>
              <button
                onClick={() => setChartMetric('MODULAR')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMetric === 'MODULAR'
                    ? 'bg-white dark:bg-[#0c1a2c] text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Modular Only
              </button>
              <button
                onClick={() => setChartMetric('PRACTICAL')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMetric === 'PRACTICAL'
                    ? 'bg-white dark:bg-[#0c1a2c] text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Practical Only
              </button>
            </div>
          </div>

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
                triggerKey={`inst-grades-${courseId}-${chartMetric}-${chartInView ? 'in' : 'wait'}`}
                duration={1.85}
                className="w-full h-full"
              >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartGradeData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
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
                            <div className="flex justify-between gap-4 text-blue-300">
                              <span>Modular Theory:</span>
                              <span className="font-bold">{item.modular}%</span>
                            </div>
                            <div className="flex justify-between gap-4 text-emerald-300">
                              <span>Practical Simulator:</span>
                              <span className="font-bold">{item.practical}%</span>
                            </div>
                            <div className="flex justify-between gap-4 text-amber-300 pt-1 border-t border-slate-800">
                              <span>Final Grade:</span>
                              <span className="font-bold">{item.final}%</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '75% Pass Benchmark', fill: '#f59e0b', fontSize: 9, position: 'insideTopRight' }} />
                  {(chartMetric === 'ALL' || chartMetric === 'MODULAR') && (
                    <Bar dataKey="modular" name="Modular Theory" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1800} animationEasing="ease-out" />
                  )}
                  {(chartMetric === 'ALL' || chartMetric === 'PRACTICAL') && (
                    <Bar dataKey="practical" name="Practical Simulator" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={true} animationBegin={100} animationDuration={1800} animationEasing="ease-out" />
                  )}
                </BarChart>
              </ResponsiveContainer>
              </ImmersiveChartFrame>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}

      {/* Course Selector, Search, & View Filter Tabs */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-mono font-bold uppercase text-slate-400 shrink-0">Course:</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-[#F8FAFC] outline-none focus:border-sky-500"
          >
            {courses.length === 0 ? (
              <option value="">No courses assigned</option>
            ) : (
              courses.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code}: ` : ''}{c.title || c.name}
                </option>
              ))
            )}
          </select>

          {/* Assessment View Mode Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <button
              onClick={() => setViewFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                viewFilter === 'ALL'
                  ? 'bg-white dark:bg-[#0c1a2c] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              All Assessments ({assessments.length})
            </button>
            <button
              onClick={() => setViewFilter('MODULAR')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                viewFilter === 'MODULAR'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Modular Theory Only ({modularAssessments.length})
            </button>
            <button
              onClick={() => setViewFilter('PRACTICAL')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                viewFilter === 'PRACTICAL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Practical Simulator Only ({practicalAssessments.length})
            </button>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter seafarer name or SRN..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* Gradebook Matrix Table with Distinct Modular & Practical Groupings */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: easeOutCurve }}
        className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            {/* Super Header: Groupings for Modular Theory and Practical Simulator */}
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-900/60 text-[10px] font-mono uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th colSpan={2} className="py-2.5 px-4 font-bold text-slate-500 dark:text-slate-400 border-r border-slate-200/60 dark:border-slate-800">
                  Trainee Roster
                </th>

                {(viewFilter === 'ALL' || viewFilter === 'MODULAR') && modularAssessments.length > 0 && (
                  <th
                    colSpan={modularAssessments.length + 1}
                    className="py-2.5 px-4 font-bold text-center bg-blue-500/10 text-blue-700 dark:text-blue-300 border-r border-slate-200/60 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Modular Theory Competencies (Pre-Tests & Knowledge Quizzes)</span>
                    </div>
                  </th>
                )}

                {(viewFilter === 'ALL' || viewFilter === 'PRACTICAL') && practicalAssessments.length > 0 && (
                  <th
                    colSpan={practicalAssessments.length + 1}
                    className="py-2.5 px-4 font-bold text-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-r border-slate-200/60 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Compass className="w-3.5 h-3.5" />
                      <span>Practical Simulator Evaluations (Maneuvering & Post-Tests)</span>
                    </div>
                  </th>
                )}

                <th colSpan={2} className="py-2.5 px-4 font-bold text-center text-slate-500 dark:text-slate-400">
                  Evaluation Summary
                </th>
              </tr>

              {/* Specific Assessment Columns Sub-Header */}
              <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-[#CBD5E1] font-mono uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-bold">Seafarer Trainee</th>
                <th className="py-3 px-4 font-bold border-r border-slate-200/60 dark:border-slate-800">Rank</th>

                {/* Modular Assessment Columns */}
                {(viewFilter === 'ALL' || viewFilter === 'MODULAR') &&
                  modularAssessments.map((asm) => (
                    <th key={asm.id} className="py-3 px-3 font-bold text-center min-w-[105px]">
                      <div className="text-blue-600 dark:text-blue-400 font-extrabold">{asm.code}</div>
                      <div className="text-[9px] text-slate-400 font-normal truncate max-w-[110px]" title={asm.title}>
                        {asm.title}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">Pass: {asm.passingScore}%</div>
                    </th>
                  ))}

                {(viewFilter === 'ALL' || viewFilter === 'MODULAR') && modularAssessments.length > 0 && (
                  <th className="py-3 px-3 font-bold text-center bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-r border-slate-200/60 dark:border-slate-800 min-w-[90px]">
                    <div>Modular Avg</div>
                    <div className="text-[9px] font-normal text-blue-500/80">Benchmark: 75%</div>
                  </th>
                )}

                {/* Practical Assessment Columns */}
                {(viewFilter === 'ALL' || viewFilter === 'PRACTICAL') &&
                  practicalAssessments.map((asm) => (
                    <th key={asm.id} className="py-3 px-3 font-bold text-center min-w-[105px]">
                      <div className="text-emerald-600 dark:text-emerald-400 font-extrabold">{asm.code}</div>
                      <div className="text-[9px] text-slate-400 font-normal truncate max-w-[110px]" title={asm.title}>
                        {asm.title}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">Pass: {asm.passingScore}%</div>
                    </th>
                  ))}

                {(viewFilter === 'ALL' || viewFilter === 'PRACTICAL') && practicalAssessments.length > 0 && (
                  <th className="py-3 px-3 font-bold text-center bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-r border-slate-200/60 dark:border-slate-800 min-w-[90px]">
                    <div>Practical Avg</div>
                    <div className="text-[9px] font-normal text-emerald-500/80">Benchmark: 75%</div>
                  </th>
                )}

                <th className="py-3 px-4 font-bold text-center min-w-[85px]">Overall Avg</th>
                <th className="py-3 px-4 font-bold text-right min-w-[110px]">STCW Result</th>
              </tr>
            </thead>

            {/* Trainee Gradebook Rows */}
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={30} className="p-4">
                    <TablePageSkeleton rows={5} showHeader={false} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={30} className="py-12 text-center text-slate-400 font-mono">
                    No enrolled trainees found for this course program.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.traineeId} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-[#F8FAFC]">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          src={t.traineeAvatarUrl}
                          name={t.traineeName}
                          alt={t.traineeName || 'Trainee'}
                          className="w-8 h-8 rounded-xl"
                          fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-bold"
                        />
                        <div className="min-w-0">
                          <div>{t.traineeName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{t.srn}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-[#CBD5E1] font-sans text-xs border-r border-slate-200/60 dark:border-slate-800">
                      {t.rank}
                    </td>

                    {/* Modular Columns */}
                    {(viewFilter === 'ALL' || viewFilter === 'MODULAR') &&
                      modularAssessments.map((asm) => {
                        const cell = t.modularGrades?.[asm.id] || t.grades?.[asm.id];
                        return (
                          <td key={asm.id} className="py-3 px-3 text-center">
                            {cell ? (
                              <button
                                onClick={() => handleEditGrade(t, asm, cell)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-transform hover:scale-105 border ${
                                  cell.result === 'PASSED'
                                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                }`}
                                title="Click to view or edit score"
                              >
                                {cell.score} pts
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEditGrade(t, asm, null)}
                                className="px-2 py-1 rounded-xl text-[10px] text-slate-400 hover:text-blue-600 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              >
                                + Enter
                              </button>
                            )}
                          </td>
                        );
                      })}

                    {/* Modular Average Cell */}
                    {(viewFilter === 'ALL' || viewFilter === 'MODULAR') && modularAssessments.length > 0 && (
                      <td className="py-3 px-3 text-center font-extrabold bg-blue-50/30 dark:bg-blue-950/15 border-r border-slate-200/60 dark:border-slate-800">
                        {t.modularCount > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className={t.modularPassed ? 'text-blue-700 dark:text-blue-300' : 'text-rose-500'}>
                              {t.modularAverage}%
                            </span>
                            {t.modularPassed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">--</span>
                        )}
                      </td>
                    )}

                    {/* Practical Columns */}
                    {(viewFilter === 'ALL' || viewFilter === 'PRACTICAL') &&
                      practicalAssessments.map((asm) => {
                        const cell = t.practicalGrades?.[asm.id] || t.grades?.[asm.id];
                        return (
                          <td key={asm.id} className="py-3 px-3 text-center">
                            {cell ? (
                              <button
                                onClick={() => handleEditGrade(t, asm, cell)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-transform hover:scale-105 border ${
                                  cell.result === 'PASSED'
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                }`}
                                title="Click to view or edit score"
                              >
                                {cell.score} pts
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEditGrade(t, asm, null)}
                                className="px-2 py-1 rounded-xl text-[10px] text-slate-400 hover:text-emerald-600 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              >
                                + Enter
                              </button>
                            )}
                          </td>
                        );
                      })}

                    {/* Practical Average Cell */}
                    {(viewFilter === 'ALL' || viewFilter === 'PRACTICAL') && practicalAssessments.length > 0 && (
                      <td className="py-3 px-3 text-center font-extrabold bg-emerald-50/30 dark:bg-emerald-950/15 border-r border-slate-200/60 dark:border-slate-800">
                        {t.practicalCount > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className={t.practicalPassed ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-500'}>
                              {t.practicalAverage}%
                            </span>
                            {t.practicalPassed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">--</span>
                        )}
                      </td>
                    )}

                    {/* Overall Average */}
                    <td className="py-3 px-4 text-center font-extrabold text-slate-900 dark:text-[#F8FAFC] text-sm">
                      {t.averageGrade > 0 ? `${t.averageGrade}%` : '--'}
                    </td>

                    {/* Final STCW Result Status */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          t.finalStatus === 'PASSED'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : t.finalStatus === 'NEEDS_REMEDIAL'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-slate-500/15 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {t.finalStatus === 'PASSED' ? 'QUALIFIED' : t.finalStatus?.replace('_', ' ') || 'PENDING'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Grade Entry & Audit Modal */}
      <AnimatePresence>
        {editModalOpen && selectedCell && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      selectedCell.category === 'MODULAR'
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                    }`}
                  >
                    {selectedCell.category === 'MODULAR' ? 'Modular Theory Quiz' : 'Practical Simulator Drill'}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-1">
                    Record / Modify Evaluation Score
                  </h3>
                </div>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveGrade} className="space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex items-center gap-3 font-mono">
                  <UserAvatar
                    src={selectedCell.traineeAvatarUrl}
                    name={selectedCell.traineeName}
                    alt={selectedCell.traineeName || 'Trainee'}
                    className="w-9 h-9 rounded-xl"
                    fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-xs font-bold"
                  />
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate">{selectedCell.traineeName}</div>
                    <div className="text-[11px] text-slate-400 truncate">{selectedCell.assessmentTitle}</div>
                  </div>
                </div>

                {selectedCell.category === 'PRACTICAL' && (
                  <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 text-[11px] font-mono flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-300">Grade against STCW criteria rubrics?</span>
                    <Link href="/assessments" className="font-bold text-emerald-700 dark:text-emerald-300 underline">
                      Open Rubrics Workspace →
                    </Link>
                  </div>
                )}

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                    Evaluation Score (Max: {selectedCell.maxScore} pts • Pass: 75 pts)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={selectedCell.maxScore}
                    required
                    value={newScore}
                    onChange={(e) => setNewScore(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] font-mono font-extrabold text-base outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                    Instructor Evaluation Remarks & Drill Observations
                  </label>
                  <textarea
                    rows={2}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="e.g. Demonstrated satisfactory bridge maneuvering and collision regulation adherence."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
                  />
                </div>

                {selectedCell.currentScore > 0 && (
                  <div>
                    <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                      Reason for Grade Modification (Required for Audit Log)
                    </label>
                    <input
                      type="text"
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="State reason for score change (e.g. Simulator re-drill completed)..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[#CBD5E1] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-sky-600 text-white font-semibold shadow-md shadow-sky-500/20 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Record & Sync Score'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
