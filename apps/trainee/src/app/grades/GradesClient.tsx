'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  BookOpen,
  Compass,
  ShieldCheck,
  CalendarCheck2,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  Clock,
  Info
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

interface QuizBreakdownDetail {
  assessmentId: string;
  title: string;
  score: number;
  passed: boolean;
  attemptNumber: number;
  passingScoreRequired: number;
}

interface CourseBreakdownComponent {
  score: number;
  weight: number;
  weightedContribution: number;
  meetsRequirement?: boolean;
  minRequired?: number;
  competencyStatus?: string;
  totalSessions?: number;
  present?: number;
  late?: number;
  completedCount?: number;
  totalCount?: number;
  quizDetails?: QuizBreakdownDetail[];
}

interface CourseBreakdown {
  courseId: string;
  courseTitle: string;
  courseCode: string;
  isFullModular?: boolean;
  requiresPractical?: boolean;
  deliveryMode?: 'FULL_MODULAR' | 'MODULAR_AND_PRACTICAL';
  overallGrade: number;
  status: 'PASSED' | 'FAILED' | 'IN_PROGRESS' | 'NEEDS_REMEDIATION' | 'PENDING_GRADING';
  policyName: string;
  passingGrade: number;
  minAttendancePct: number;
  practicalCompetencyRequired: boolean;
  isCompliant: boolean;
  hasMandatoryFailures?: boolean;
  mandatoryFailureReasons?: string[];
  weights: {
    attendance: number;
    practical: number;
    moduleQuiz: number;
  };
  components: {
    attendance?: CourseBreakdownComponent;
    practical?: CourseBreakdownComponent;
    moduleQuiz: CourseBreakdownComponent;
  };
}

interface RubricCriterionScore {
  criterionName: string;
  score: number;
  maxPoints: number;
  isCritical: boolean;
  ratingLabel: string;
  comments: string;
}

interface PracticalFeedback {
  evaluationId: string;
  courseId: string;
  courseTitle: string;
  rubricTitle: string;
  stcwReference: string;
  instructorName: string;
  instructorAvatarUrl?: string | null;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  passingScore: number;
  competencyStatus: 'COMPETENT' | 'NOT_YET_COMPETENT';
  status: string;
  generalFeedback: string;
  strengths: string;
  improvementsRequired: string;
  remediationPlan: string;
  evaluationDate: string;
  criteriaBreakdown: RubricCriterionScore[];
}

export default function GradesClient() {
  const [grades, setGrades] = useState<any[]>([]);
  const [courseBreakdowns, setCourseBreakdowns] = useState<CourseBreakdown[]>([]);
  const [practicalFeedbacks, setPracticalFeedbacks] = useState<PracticalFeedback[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'ALL' | 'MODULAR' | 'PRACTICAL' | 'PRE_TEST' | 'POST_TEST'>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [chartMetric, setChartMetric] = useState<'CONTRIBUTION' | 'RAW_SCORE'>('RAW_SCORE');
  const [chartInView, setChartInView] = useState(false);
  const [expandedEvaluations, setExpandedEvaluations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/trainee/grades')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const breakdowns: CourseBreakdown[] = json.courseBreakdowns || [];
          setGrades(json.data || []);
          setCourseBreakdowns(breakdowns);
          setPracticalFeedbacks(json.practicalFeedbacks || []);
          setSummary(json.summary || {});
          if (breakdowns.length > 0) {
            setSelectedCourseId((prev) => prev || breakdowns[0].courseId);
            const primaryIsFullMod =
              breakdowns[0].isFullModular || breakdowns[0].requiresPractical === false;
            if (!primaryIsFullMod) {
              setChartMetric('CONTRIBUTION');
            }
          }
        }
      })
      .catch((err) => console.error('Failed to load trainee grades:', err))
      .finally(() => setLoading(false));
  }, []);

  const toggleEvaluation = (id: string) => {
    setExpandedEvaluations((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const modularList = grades.filter((g) => g.category === 'MODULAR');
  const practicalList = grades.filter((g) => g.category === 'PRACTICAL');

  const hasPracticalCourses =
    typeof summary.hasPracticalCourses === 'boolean'
      ? summary.hasPracticalCourses
      : courseBreakdowns.length > 0
      ? courseBreakdowns.some(
          (cb) =>
            cb.requiresPractical !== false &&
            !cb.isFullModular &&
            cb.deliveryMode !== 'FULL_MODULAR'
        )
      : practicalList.length > 0 || practicalFeedbacks.length > 0;

  const allFullModular = courseBreakdowns.length > 0 && !hasPracticalCourses;

  const preTestList = modularList.filter((g) => g.assessmentCode !== 'MOD-POST');
  const postTestList = modularList.filter((g) => g.assessmentCode === 'MOD-POST');

  const filteredGrades =
    filterMode === 'ALL'
      ? allFullModular
        ? modularList
        : grades
      : filterMode === 'MODULAR'
      ? modularList
      : filterMode === 'PRE_TEST'
      ? preTestList
      : filterMode === 'POST_TEST'
      ? postTestList
      : practicalList;

  const getStatusBadge = (status: string, result?: string, score?: number) => {
    if (status === 'IN_PROGRESS' || status === 'SUBMITTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
          <Clock className="w-3 h-3" /> PENDING GRADING
        </span>
      );
    }
    if (status === 'NOT_STARTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">
          NOT STARTED
        </span>
      );
    }
    if (result === 'PASSED' || (score !== undefined && score >= 75)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> PASSED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
        <AlertTriangle className="w-3 h-3" /> FAILED
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm"
      >
        <div className="relative z-10 space-y-2 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-slate-200/80 dark:border-slate-800">
              STCW Reg. I/12 Academic Performance
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Transparent Scoring
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Official Course Grades & Competency Transcript
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] font-sans leading-relaxed">
            {allFullModular
              ? 'Monitor verified academic performance across your modular competency quizzes and comprehensive final modular assessments. Full Modular courses are graded 100% from modular quizzes with no practical training or physical attendance required.'
              : 'Monitor verified academic performance across theoretical knowledge quizzes, practical simulator maneuvering evaluations, and contact-hour attendance. Final grades reflect approved institutional weighting formulas where unattempted assessments are never arbitrarily calculated as zero.'}
          </p>
        </div>
      </motion.div>

      {/* High-Level Telemetry Cards: Animated in sequence (not in sync) when showed on screen */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className={`grid grid-cols-1 gap-4 ${
          allFullModular ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {/* Modular Quizzes Average */}
        <motion.div
          variants={cascadeItem}
          whileHover={{ y: -2, transition: { duration: 0.2, ease: easeOutCurve } }}
          className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-blue-200/70 dark:border-blue-900/50 shadow-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
              {allFullModular ? 'Modular Quizzes' : 'Modular Theory'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            {summary.modularAverage ? `${summary.modularAverage}%` : '--'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-[#CBD5E1] mt-1">
            {summary.modularPassedCount ?? 0} / {summary.modularTotal ?? modularList.length} Passed (Min: 75% per Quiz)
          </div>
        </motion.div>

        {/* Practical Simulator Average (Only for Modular + Practical courses) */}
        {!allFullModular && (
          <motion.div
            variants={cascadeItem}
            whileHover={{ y: -2, transition: { duration: 0.2, ease: easeOutCurve } }}
            className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-emerald-200/70 dark:border-emerald-900/50 shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                Practical Simulator
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
              {summary.practicalAverage ? `${summary.practicalAverage}%` : '--'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-[#CBD5E1] mt-1">
              {summary.practicalPassedCount ?? 0} / {summary.practicalTotal ?? practicalList.length} Passed (Pass: 75%)
            </div>
          </motion.div>
        )}

        {/* Attendance Weight Contribution OR Quizzes Scope Card for Full Modular */}
        {!allFullModular ? (
          <motion.div
            variants={cascadeItem}
            whileHover={{ y: -2, transition: { duration: 0.2, ease: easeOutCurve } }}
            className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-purple-200/70 dark:border-purple-900/50 shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                Contact Attendance
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <CalendarCheck2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
              {(() => {
                const pracCourse = courseBreakdowns.find((c) => !c.isFullModular && c.components?.attendance);
                return pracCourse?.components?.attendance ? `${pracCourse.components.attendance.score}%` : 'Active';
              })()}
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-[#CBD5E1] mt-1">
              Min. 80% Required for Certification
            </div>
          </motion.div>
        ) : (
          <motion.div
            variants={cascadeItem}
            whileHover={{ y: -2, transition: { duration: 0.2, ease: easeOutCurve } }}
            className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-indigo-200/70 dark:border-indigo-900/50 shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                Grading Mode
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
              100% Quizzes
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-[#CBD5E1] mt-1">
              Full Modular • No Practical or Attendance
            </div>
          </motion.div>
        )}

        {/* Competency Qualification Status */}
        <motion.div
          variants={cascadeItem}
          whileHover={{ y: -2, transition: { duration: 0.2, ease: easeOutCurve } }}
          className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-slate-200/80 dark:border-slate-800">
              Qualification Status
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-sky-600 dark:text-sky-400 font-heading">
            {allFullModular
              ? summary.isOverallQualified
                ? 'QUALIFIED'
                : courseBreakdowns.some((cb) => cb.status === 'NEEDS_REMEDIATION' || cb.status === 'FAILED')
                ? 'RETAKE NEEDED'
                : 'IN PROGRESS'
              : summary.isModularQualified && summary.isPracticalQualified
              ? 'QUALIFIED'
              : 'IN PROGRESS'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-[#CBD5E1] mt-1">
            {allFullModular ? 'Full Modular Quiz Standards' : 'Dual Theory & Simulator Standards'}
          </div>
        </motion.div>
      </motion.div>

      {/* Interactive Grade Composition & Weighting Graph */}
      {(() => {
        const primaryCourse =
          courseBreakdowns.find((c) => c.courseId === selectedCourseId) || courseBreakdowns[0] || null;
        const primaryWeights = primaryCourse?.weights || {
          attendance: allFullModular ? 0 : 10,
          practical: allFullModular ? 0 : 50,
          moduleQuiz: allFullModular ? 100 : 40,
        };
        const isPrimaryFullModular = primaryCourse
          ? Boolean(
              primaryCourse.isFullModular ||
                primaryCourse.requiresPractical === false ||
                primaryCourse.deliveryMode === 'FULL_MODULAR' ||
                (primaryWeights.attendance === 0 && primaryWeights.practical === 0)
            )
          : allFullModular;

        const gradeGraphData: Array<{
          pillar: string;
          fullName: string;
          score: number;
          weight: number;
          contribution: number;
          benchmark: number;
          color: string;
        }> = [];

        if (isPrimaryFullModular) {
          const quizDetails = primaryCourse?.components?.moduleQuiz?.quizDetails || [];
          const attemptedQuizzes = quizDetails.filter((q) => q.attemptNumber > 0);

          if (attemptedQuizzes.length > 0) {
            const perQuizWeight = Number((100 / quizDetails.length).toFixed(1));
            attemptedQuizzes.forEach((q, idx) => {
              const shortLabel = q.title.toLowerCase().includes('post')
                ? 'Post-Test'
                : `Module ${q.title.match(/Module\s*(\d+)/i)?.[1] || idx + 1}`;
              gradeGraphData.push({
                pillar: shortLabel,
                fullName: q.title,
                score: Number(q.score) || 0,
                weight: perQuizWeight,
                contribution: Number(((Number(q.score) || 0) / quizDetails.length).toFixed(2)),
                benchmark: q.passingScoreRequired || 75,
                color: q.passed ? '#0284c7' : '#f59e0b',
              });
            });
          } else {
            const modAvg = primaryCourse?.components?.moduleQuiz?.score ?? (summary.modularAverage || 0);
            gradeGraphData.push({
              pillar: 'Modular Quizzes (100%)',
              fullName: 'Modular Theory Quizzes & Final Assessment',
              score: modAvg,
              weight: 100,
              contribution: primaryCourse?.components?.moduleQuiz?.weightedContribution ?? modAvg,
              benchmark: 70,
              color: '#0284c7',
            });
          }
        } else {
          if (primaryWeights.attendance > 0 && primaryCourse?.components?.attendance) {
            gradeGraphData.push({
              pillar: `Attendance (${primaryWeights.attendance}%)`,
              fullName: 'Attendance Quorum',
              score: primaryCourse.components.attendance.score ?? 0,
              weight: primaryWeights.attendance,
              contribution: primaryCourse.components.attendance.weightedContribution ?? 0,
              benchmark: primaryCourse.minAttendancePct || 80,
              color: '#a855f7',
            });
          }
          if (primaryWeights.practical > 0) {
            gradeGraphData.push({
              pillar: `Practical (${primaryWeights.practical}%)`,
              fullName: 'Simulator Performance Drills',
              score: primaryCourse?.components?.practical?.score ?? (summary.practicalAverage || 0),
              weight: primaryWeights.practical,
              contribution:
                primaryCourse?.components?.practical?.weightedContribution ??
                (summary.practicalAverage ? (summary.practicalAverage * primaryWeights.practical) / 100 : 0),
              benchmark: 70,
              color: '#10b981',
            });
          }
          if (primaryWeights.moduleQuiz > 0) {
            gradeGraphData.push({
              pillar: `Theory (${primaryWeights.moduleQuiz}%)`,
              fullName: 'Modular Knowledge Assessments',
              score: primaryCourse?.components?.moduleQuiz?.score ?? (summary.modularAverage || 0),
              weight: primaryWeights.moduleQuiz,
              contribution:
                primaryCourse?.components?.moduleQuiz?.weightedContribution ??
                (summary.modularAverage ? (summary.modularAverage * primaryWeights.moduleQuiz) / 100 : 0),
              benchmark: 75,
              color: '#0284c7',
            });
          }
        }

        const chartMetricKey = chartMetric;

        return (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            onViewportEnter={() => setChartInView(true)}
            transition={{ duration: 0.5, ease: easeOutCurve }}
            className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden space-y-6"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-sky-500" />
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {isPrimaryFullModular
                      ? `Modular Quiz Performance Distribution${primaryCourse ? ` (${primaryCourse.courseCode})` : ''}`
                      : `STCW Weighting & Performance Distribution${primaryCourse ? ` (${primaryCourse.courseCode})` : ''}`}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-sans">
                  {isPrimaryFullModular
                    ? 'Formula: Final Grade = Average of Modular Quizzes × 100% (No Practical or Attendance Required)'
                    : `Formula: Final Grade = ${
                        primaryWeights.attendance > 0 ? `(Attendance × ${primaryWeights.attendance}%) + ` : ''
                      }(Practical Simulator × ${primaryWeights.practical}%) + (Theory Quizzes × ${primaryWeights.moduleQuiz}%)`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {courseBreakdowns.length > 1 && (
                  <select
                    value={primaryCourse?.courseId || ''}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedCourseId(nextId);
                      const nextCourse = courseBreakdowns.find((c) => c.courseId === nextId);
                      const nextFullMod =
                        nextCourse?.isFullModular || nextCourse?.requiresPractical === false;
                      setChartMetric(nextFullMod ? 'RAW_SCORE' : 'CONTRIBUTION');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-[#F8FAFC] outline-none"
                  >
                    {courseBreakdowns.map((c) => (
                      <option key={c.courseId} value={c.courseId}>
                        {c.courseCode}: {c.courseTitle}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
                  <button
                    onClick={() => setChartMetric('RAW_SCORE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                      chartMetricKey === 'RAW_SCORE'
                        ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Raw Score (%)
                  </button>
                  <button
                    onClick={() => setChartMetric('CONTRIBUTION')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                      chartMetricKey === 'CONTRIBUTION'
                        ? 'bg-white dark:bg-[#0c1a2c] text-sky-600 dark:text-sky-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Weighted Points (+pts)
                  </button>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${primaryCourse?.courseId || 'default'}-${chartMetricKey}`}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.2, ease: easeOutCurve } }}
                  transition={{ duration: 0.35, ease: easeOutCurve }}
                  className="w-full h-full"
                >
                  <ImmersiveChartFrame
                    ready={!loading}
                    triggerKey={`trainee-grades-${primaryCourse?.courseId || 'default'}-${chartMetricKey}-${chartInView ? 'in' : 'wait'}`}
                    duration={1.85}
                    className="w-full h-full"
                  >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeGraphData} margin={{ top: 15, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                      <XAxis
                        dataKey="pillar"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.2 }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, chartMetricKey === 'CONTRIBUTION' && !isPrimaryFullModular ? 65 : 100]}
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        axisLine={false}
                        tickLine={false}
                        unit={chartMetricKey === 'CONTRIBUTION' ? ' pts' : '%'}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const item = payload[0].payload;
                            return (
                              <div className="p-3 rounded-2xl bg-slate-900/95 text-white border border-slate-700 shadow-xl text-xs space-y-1 font-mono">
                                <div className="font-bold text-sky-400">{item.fullName}</div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Weight Share:</span>
                                  <span className="font-bold text-slate-200">{item.weight}% Total</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Actual Score:</span>
                                  <span className="font-bold text-emerald-400">{item.score}%</span>
                                </div>
                                <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
                                  <span className="text-slate-400">Points Contribution:</span>
                                  <span className="font-bold text-sky-300">+{Number(item.contribution).toFixed(2)} pts</span>
                                </div>
                                <div className="flex justify-between gap-4 text-[10px] text-amber-400">
                                  <span>Benchmark:</span>
                                  <span>Min. {item.benchmark}% required</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey={chartMetricKey === 'CONTRIBUTION' ? 'contribution' : 'score'}
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={true}
                        animationDuration={1800}
                        animationEasing="ease-out"
                      >
                        {gradeGraphData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  </ImmersiveChartFrame>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-500">
              <div className="flex flex-wrap items-center gap-4">
                {isPrimaryFullModular ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" />
                      <span>Passed Quiz (≥75%)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                      <span>Below Benchmark (&lt;75%)</span>
                    </span>
                  </>
                ) : (
                  <>
                    {primaryWeights.attendance > 0 && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                        <span>Attendance ({primaryWeights.attendance}% Weight)</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span>Practical Simulator ({primaryWeights.practical}% Weight)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                      <span>Theory Quizzes ({primaryWeights.moduleQuiz}% Weight)</span>
                    </span>
                  </>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {isPrimaryFullModular
                  ? 'Full Modular Grading: 100% Quiz-Based • 70% Overall Passing Benchmark'
                  : 'Passing Benchmark: 70.00% Cumulative STCW Score'}
              </span>
            </div>
          </motion.div>
        );
      })()}

      {/* SECTION 1: COURSE-LEVEL TRANSPARENT WEIGHTED BREAKDOWNS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-sky-500" />
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            Course Grade Calculations & Weighting Breakdowns
          </h2>
        </div>

        {loading ? (
          <TablePageSkeleton rows={5} showHeader={false} />
        ) : courseBreakdowns.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs bg-white dark:bg-[#0c1a2c] rounded-3xl border border-slate-200 dark:border-slate-800">
            No course enrollment grade computations recorded yet.
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="space-y-6"
          >
            {courseBreakdowns.map((cb) => {
              const weights = cb.weights || { attendance: 0, practical: 0, moduleQuiz: 0 };
              const isFullModular = Boolean(
                cb.isFullModular ||
                  cb.requiresPractical === false ||
                  cb.deliveryMode === 'FULL_MODULAR' ||
                  (weights.attendance === 0 && weights.practical === 0)
              );
              const hasAtt = !isFullModular && cb.components?.attendance !== undefined && weights.attendance > 0;
              const hasPrac = !isFullModular && cb.components?.practical !== undefined && weights.practical > 0;
              const hasMod = cb.components?.moduleQuiz !== undefined;
              const cbStatus = cb.status || 'IN_PROGRESS';
              const isFailedStatus = cbStatus === 'FAILED' || cbStatus === 'NEEDS_REMEDIATION';
              const fmtPts = (v?: number) => (Number(v) || 0).toFixed(2);
              const componentColCount = (hasAtt ? 1 : 0) + (hasPrac ? 1 : 0) + (hasMod ? 1 : 0);
              const quizDetails = cb.components?.moduleQuiz?.quizDetails || [];

              return (
                <motion.div
                  key={cb.courseId}
                  variants={cascadeItem}
                  className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5"
                >
                {/* Course Header & Overall Score */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        {cb.courseCode}
                      </span>
                      {isFullModular && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                          Full Modular • 100% Quizzes
                        </span>
                      )}
                      <span className="text-xs font-mono text-slate-400">
                        Grading Policy: {cb.policyName || 'Standard Institutional Policy'}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                      {cb.courseTitle}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-mono text-slate-400 uppercase">Calculated Grade</div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                        {cbStatus === 'PASSED'
                          ? `${cb.overallGrade}%`
                          : cb.overallGrade > 0
                          ? `${cb.overallGrade}%`
                          : 'In Progress'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        Passing Benchmark: {cb.passingGrade}%
                      </div>
                    </div>
                    <div>
                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                          cbStatus === 'PASSED'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : cbStatus === 'NEEDS_REMEDIATION'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            : isFailedStatus
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                            : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {cbStatus === 'PASSED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {isFailedStatus && <AlertTriangle className="w-3.5 h-3.5" />}
                        {!isFailedStatus && cbStatus !== 'PASSED' && <Clock className="w-3.5 h-3.5" />}
                        {cbStatus === 'NEEDS_REMEDIATION' ? 'RETAKE NEEDED' : cbStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mandatory Quiz / Safety / Attendance Warning if applicable */}
                {cb.hasMandatoryFailures && cb.mandatoryFailureReasons && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <div>
                      <span className="font-bold">
                        {isFullModular ? 'Modular Assessment Notice: ' : 'Mandatory STCW Requirement Notice: '}
                      </span>
                      {cb.mandatoryFailureReasons.join(' • ')}
                    </div>
                  </div>
                )}

                {/* Weighted Component Cards */}
                <div
                  className={`grid grid-cols-1 gap-4 font-mono ${
                    componentColCount >= 3
                      ? 'md:grid-cols-3'
                      : componentColCount === 2
                      ? 'md:grid-cols-2'
                      : 'md:grid-cols-1'
                  }`}
                >
                  {/* Attendance Component (Never shown for Full Modular courses) */}
                  {hasAtt && cb.components.attendance && (
                    <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-sky-500/15 border border-purple-200/60 dark:border-purple-900/40 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-purple-900 dark:text-purple-300">
                          1. Attendance Record
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-200/50 dark:bg-sky-500/15 text-purple-800 dark:text-purple-300">
                          Weight: {weights.attendance}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <div className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                            {cb.components.attendance.score}%
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Sessions: {cb.components.attendance.present ?? 0} Present • {cb.components.attendance.late ?? 0} Late
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-purple-700 dark:text-purple-300">
                            +{fmtPts(cb.components.attendance.weightedContribution)} pts
                          </div>
                          <div className="text-[10px] text-slate-400">Contribution</div>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-purple-200/40 dark:border-purple-900/40 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Min. Required: {cb.components.attendance.minRequired ?? 80}%</span>
                        <span className={`font-bold ${cb.components.attendance.meetsRequirement ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {cb.components.attendance.meetsRequirement ? 'Satisfied' : `Below ${cb.components.attendance.minRequired ?? 80}%`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Practical Simulator Component (Never shown for Full Modular courses) */}
                  {hasPrac && cb.components.practical && (
                    <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-900 dark:text-emerald-300">
                          {hasAtt ? '2. ' : '1. '}Practical Simulator Drills
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                          Weight: {weights.practical}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <div className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                            {cb.components.practical.competencyStatus === 'COMPETENT' && cb.components.practical.score > 0
                              ? `${cb.components.practical.score}%`
                              : 'Pending'}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Competency: {cb.components.practical.competencyStatus || 'Pending Evaluation'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                            +{fmtPts(cb.components.practical.weightedContribution)} pts
                          </div>
                          <div className="text-[10px] text-slate-400">Contribution</div>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-emerald-200/40 dark:border-emerald-900/40 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Critical Safety Passed</span>
                        <span className={`font-bold ${cb.components.practical.competencyStatus === 'COMPETENT' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {cb.components.practical.competencyStatus || 'Pending'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Modular Quizzes Component */}
                  {hasMod && (
                    <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-blue-900 dark:text-blue-300">
                          {isFullModular ? 'Modular Quizzes & Assessments' : `${hasAtt ? '3. ' : '2. '}Modular Theory Quizzes`}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200/50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                          Weight: {weights.moduleQuiz}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <div className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                            {(cb.components.moduleQuiz.completedCount ?? 0) > 0 && cb.components.moduleQuiz.score > 0
                              ? `${cb.components.moduleQuiz.score}%`
                              : 'Pending'}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Completed: {cb.components.moduleQuiz.completedCount ?? 0} of {cb.components.moduleQuiz.totalCount ?? 0} quizzes
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-blue-700 dark:text-blue-300">
                            +{fmtPts(cb.components.moduleQuiz.weightedContribution)} pts
                          </div>
                          <div className="text-[10px] text-slate-400">Contribution</div>
                        </div>
                      </div>

                      {isFullModular && quizDetails.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-blue-200/40 dark:border-blue-900/40">
                          {quizDetails.map((qd, qIdx) => {
                            const label = qd.title.toLowerCase().includes('post')
                              ? 'Course Post-Assessment'
                              : `Module ${qd.title.match(/Module\s*(\d+)/i)?.[1] || qIdx + 1} Quiz`;
                            const isAttempted = qd.attemptNumber > 0;
                            return (
                              <div
                                key={qd.assessmentId}
                                className={`px-3 py-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
                                  !isAttempted
                                    ? 'bg-white/60 dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800 text-slate-500'
                                    : qd.passed
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                <span className="truncate font-semibold">{label}</span>
                                <span className="font-extrabold shrink-0">
                                  {isAttempted ? `${qd.score}%` : '--'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="pt-2 border-t border-blue-200/40 dark:border-blue-900/40 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Knowledge Benchmark</span>
                        <span className="font-bold text-blue-600">Min. 75% per Quiz</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Grade Calculation Transparency Explainer */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-sky-500" />
                    <span>
                      {isFullModular
                        ? 'Formula: Final Grade = Modular Quizzes × 100% (No Practical Training or Physical Attendance)'
                        : weights.attendance > 0
                        ? `Formula: Final = (Attendance × ${weights.attendance}%) + (Practical × ${weights.practical}%) + (Quizzes × ${weights.moduleQuiz}%) = 100% Total`
                        : `Formula: Final = (Practical × ${weights.practical}%) + (Quizzes × ${weights.moduleQuiz}%) = 100% Total`}
                    </span>
                  </div>
                  <span className="text-[10px] italic">
                    Pending assessments are not treated as zero until finalized.
                  </span>
                </div>
              </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* SECTION 2: RELEASED PRACTICAL ASSESSMENT RUBRIC FEEDBACK */}
      {hasPracticalCourses && practicalFeedbacks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
              Released Practical Assessment Rubric Evaluations
            </h2>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="space-y-4"
          >
            {practicalFeedbacks.map((pf) => {
              const isExpanded = !!expandedEvaluations[pf.evaluationId];
              const isCompetent = pf.competencyStatus === 'COMPETENT';

              return (
                <motion.div
                  key={pf.evaluationId}
                  variants={cascadeItem}
                  className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-emerald-200/70 dark:border-emerald-900/50 shadow-sm overflow-hidden"
                >
                  {/* Evaluation Summary Banner */}
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          {pf.stcwReference}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400">
                          <UserAvatar
                            src={pf.instructorAvatarUrl}
                            name={pf.instructorName}
                            alt={pf.instructorName || 'Instructor'}
                            className="w-4 h-4 rounded-md"
                            fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold"
                          />
                          <span>Evaluated by {pf.instructorName} • {new Date(pf.evaluationDate).toLocaleDateString()}</span>
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                        {pf.rubricTitle} ({pf.courseTitle})
                      </h3>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right font-mono">
                        <div className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                          {pf.totalScore} / {pf.maxPossibleScore} pts
                        </div>
                        <div className="text-xs text-slate-400">
                          {pf.percentage}% (Benchmark: {pf.passingScore}%)
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                          isCompetent
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isCompetent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {(pf.competencyStatus || 'PENDING').replace(/_/g, ' ')}
                      </span>

                      <button
                        onClick={() => toggleEvaluation(pf.evaluationId)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                        title={isExpanded ? 'Collapse Criteria Breakdown' : 'Expand Criteria Breakdown'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Feedback Comments Section */}
                  <div className="p-5 space-y-3 text-xs font-sans">
                    {pf.generalFeedback && (
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 font-mono text-[11px] uppercase block mb-1">
                          Instructor Evaluator Remarks:
                        </span>
                        <p className="text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800">
                          &quot;{pf.generalFeedback}&quot;
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {pf.strengths && (
                        <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30">
                          <span className="font-bold text-emerald-800 dark:text-emerald-400 font-mono text-[10px] uppercase block mb-0.5">
                            Demonstrated Strengths
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 text-[11px]">{pf.strengths}</p>
                        </div>
                      )}

                      {pf.improvementsRequired && (
                        <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30">
                          <span className="font-bold text-amber-800 dark:text-amber-400 font-mono text-[10px] uppercase block mb-0.5">
                            Areas Requiring Improvement
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 text-[11px]">{pf.improvementsRequired}</p>
                        </div>
                      )}
                    </div>

                    {pf.remediationPlan && (
                      <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30">
                        <span className="font-bold text-rose-800 dark:text-rose-400 font-mono text-[10px] uppercase block mb-0.5">
                          Required Remediation & Re-Assessment Plan
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 text-[11px]">{pf.remediationPlan}</p>
                      </div>
                    )}
                  </div>

                  {/* Expandable Criteria Breakdown */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 p-5 space-y-3"
                      >
                        <h4 className="text-xs font-mono font-bold uppercase text-slate-500 dark:text-slate-400">
                          Individual Rubric Criteria Scores & Comments
                        </h4>

                        <div className="space-y-2">
                          {pf.criteriaBreakdown.map((crit, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                                    {crit.criterionName}
                                  </span>
                                  {crit.isCritical && (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                      CRITICAL SAFETY ITEM
                                    </span>
                                  )}
                                </div>
                                {crit.comments && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic font-sans">
                                    &quot;{crit.comments}&quot;
                                  </p>
                                )}
                              </div>

                              <div className="text-right shrink-0">
                                <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                                  {crit.score} / {crit.maxPoints} pts
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  {crit.ratingLabel || 'Rated'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      {/* SECTION 3: GRANULAR ASSESSMENTS LEDGER */}
      <div className="space-y-4">
        {/* Filter Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-500" />
            <span className="text-xs font-mono font-bold uppercase text-slate-500 dark:text-slate-300">
              Granular Assessments Filter:
            </span>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                filterMode === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {allFullModular ? `All Quizzes (${modularList.length})` : `All Assessments (${grades.length})`}
            </button>
            {allFullModular ? (
              <>
                <button
                  onClick={() => setFilterMode('PRE_TEST')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    filterMode === 'PRE_TEST'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Module Quizzes ({preTestList.length})
                </button>
                <button
                  onClick={() => setFilterMode('POST_TEST')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    filterMode === 'POST_TEST'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Final Post-Assessments ({postTestList.length})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setFilterMode('MODULAR')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    filterMode === 'MODULAR'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Modular Quizzes ({modularList.length})
                </button>
                {(hasPracticalCourses || practicalList.length > 0) && (
                  <button
                    onClick={() => setFilterMode('PRACTICAL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      filterMode === 'PRACTICAL'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Practical Drills ({practicalList.length})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Assessments Table */}
        <div className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-100/80 dark:bg-slate-900/60 text-slate-500 dark:text-[#CBD5E1] text-[11px] uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4 pl-6">Assessment Code & Title</th>
                  <th className="p-4">Course Program</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Recorded Score</th>
                  <th className="p-4">Status & Result</th>
                  <th className="p-4">Remarks</th>
                  <th className="p-4 pr-6 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Loading individual assessments...
                    </td>
                  </tr>
                ) : filteredGrades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No assessment attempts found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredGrades.map((g: any) => (
                    <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-slate-900 dark:text-[#F8FAFC] font-sans">
                          {g.assessmentTitle}
                        </div>
                        <div className="text-[10px] text-blue-600 dark:text-blue-400">
                          {g.assessmentCode}
                        </div>
                      </td>
                      <td className="p-4 font-sans text-slate-600 dark:text-[#CBD5E1]">
                        {g.courseTitle}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          g.category === 'MODULAR'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {g.type || g.category}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-900 dark:text-[#F8FAFC]">
                        {g.score !== null && g.score !== undefined ? (
                          <span>{g.score} / {g.maxScore || 100} pts ({g.percentage}%)</span>
                        ) : (
                          <span className="text-slate-400 italic">Ungraded</span>
                        )}
                      </td>
                      <td className="p-4">
                        {getStatusBadge(g.status, g.result, g.score)}
                      </td>
                      <td className="p-4 font-sans text-slate-500 dark:text-slate-400 italic max-w-xs">
                        {g.feedback || g.remarks || 'Standard evaluation recorded.'}
                      </td>
                      <td className="p-4 pr-6 text-right text-slate-400 text-[10px]">
                        {g.date}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
