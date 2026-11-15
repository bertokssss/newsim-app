'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  X,
  FileCheck,
  GraduationCap,
  Compass,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Save,
  Send,
  HelpCircle,
  Edit3,
  BookOpen,
  Filter,
  UserCheck
} from 'lucide-react';
import { CardGridSkeleton, UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface PracticalRubricCriterion {
  id: string;
  criterionName: string;
  description: string;
  competency: string;
  performanceIndicators: string;
  maxPoints: number;
  weightPct: number;
  sortOrder: number;
  isCritical: boolean;
  ratingLevels: Array<{ label: string; minPct: number; maxPct: number; description: string }>;
}

interface PracticalRubric {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  assessmentId?: string;
  title: string;
  stcwReference: string;
  description: string;
  instructions: string;
  passingScore: number;
  maxScore: number;
  status: string;
  criteria: PracticalRubricCriterion[];
}

interface TraineeEvaluationRow {
  traineeId: string;
  traineeName: string;
  email: string;
  avatarUrl?: string | null;
  srn: string;
  rank: string;
  evaluationId: string | null;
  score: number | null;
  maxScore: number;
  percentage: number | null;
  competencyStatus: string;
  status: string;
  evaluationDate: string | null;
  feedback: string;
}

export default function AssessmentsClient() {
  const [activeTab, setActiveTab] = useState<'ASSESSMENTS' | 'RUBRICS'>('ASSESSMENTS');

  // Assessments Tab State
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedAssessment, setSelectedAssessment] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Practical Rubrics Tab State
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [rubrics, setRubrics] = useState<PracticalRubric[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState('');
  const [rubricDetails, setRubricDetails] = useState<PracticalRubric | null>(null);
  const [traineeRoster, setTraineeRoster] = useState<TraineeEvaluationRow[]>([]);
  const [loadingRubrics, setLoadingRubrics] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  // Evaluation Grading Modal State
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evaluatingTrainee, setEvaluatingTrainee] = useState<TraineeEvaluationRow | null>(null);
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});
  const [criteriaComments, setCriteriaComments] = useState<Record<string, string>>({});
  const [criteriaRatings, setCriteriaRatings] = useState<Record<string, string>>({});
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [strengths, setStrengths] = useState('');
  const [improvementsRequired, setImprovementsRequired] = useState('');
  const [remediationPlan, setRemediationPlan] = useState('');
  const [amendmentReason, setAmendmentReason] = useState('');
  const [isExistingFinalized, setIsExistingFinalized] = useState(false);
  const [submittingEval, setSubmittingEval] = useState(false);

  // 1. Fetch Assessments for Tab 1
  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (typeFilter !== 'ALL') query.set('type', typeFilter);

      const res = await fetch(`/api/instructor/assessments?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setAssessments(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [search, typeFilter]);

  // 2. Fetch Courses for Tab 2
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res = await fetch('/api/instructor/my-courses');
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setCourses(json.data);
          setSelectedCourseId(json.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load courses:', err);
      }
    };
    loadCourses();
  }, []);

  // 3. Fetch Rubrics when selectedCourseId changes
  useEffect(() => {
    if (!selectedCourseId) {
      setRubrics([]);
      setSelectedRubricId('');
      setRubricDetails(null);
      return;
    }
    const loadRubrics = async () => {
      try {
        setLoadingRubrics(true);
        const res = await fetch(`/api/instructor/rubrics?courseId=${selectedCourseId}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setRubrics(json.data);
          setSelectedRubricId(json.data[0].id);
          setRubricDetails(json.data[0]);
        } else {
          setRubrics([]);
          setSelectedRubricId('');
          setRubricDetails(null);
        }
      } catch (err) {
        console.error('Failed to load rubrics:', err);
      } finally {
        setLoadingRubrics(false);
      }
    };
    loadRubrics();
  }, [selectedCourseId]);

  // 4. Update Rubric Details when selectedRubricId changes
  useEffect(() => {
    if (!selectedRubricId) {
      setRubricDetails(null);
      return;
    }
    const found = rubrics.find((r) => r.id === selectedRubricId);
    if (found) {
      setRubricDetails(found);
    } else {
      fetch(`/api/instructor/rubrics/${selectedRubricId}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) setRubricDetails(json.data);
        })
        .catch(() => {});
    }
  }, [selectedRubricId, rubrics]);

  // 5. Fetch Trainee Roster when rubric or course changes
  const fetchTraineeRoster = async () => {
    if (!selectedCourseId || !selectedRubricId) {
      setTraineeRoster([]);
      return;
    }
    try {
      setLoadingRoster(true);
      const res = await fetch(
        `/api/instructor/practical-evaluations?courseId=${selectedCourseId}&rubricId=${selectedRubricId}`
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTraineeRoster(json.data);
      } else {
        setTraineeRoster([]);
      }
    } catch (err) {
      console.error('Failed to load practical evaluation roster:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  useEffect(() => {
    fetchTraineeRoster();
  }, [selectedCourseId, selectedRubricId]);

  const handleOpenSubmissions = async (asm: any) => {
    setSelectedAssessment(asm);
    setSubmissionModalOpen(true);
    setLoadingSubmissions(true);
    try {
      const res = await fetch(`/api/instructor/assessments/${asm.id}/submissions`);
      const json = await res.json();
      if (json.success) {
        setSubmissions(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Open Practical Evaluation Modal for a Trainee
  const handleOpenEvaluationModal = async (trainee: TraineeEvaluationRow) => {
    setEvaluatingTrainee(trainee);
    setEvalModalOpen(true);

    // Initialize blank criteria scores
    const initialScores: Record<string, number> = {};
    const initialComments: Record<string, string> = {};
    const initialRatings: Record<string, string> = {};

    (rubricDetails?.criteria || []).forEach((c) => {
      initialScores[c.id] = 0;
      initialComments[c.id] = '';
      initialRatings[c.id] = '';
    });

    setCriteriaScores(initialScores);
    setCriteriaComments(initialComments);
    setCriteriaRatings(initialRatings);
    setGeneralFeedback('');
    setStrengths('');
    setImprovementsRequired('');
    setRemediationPlan('');
    setAmendmentReason('');
    setIsExistingFinalized(trainee.status === 'FINALIZED');

    // If trainee has an existing evaluation, load details
    if (trainee.evaluationId && selectedRubricId) {
      try {
        const res = await fetch(
          `/api/instructor/practical-evaluations/${selectedRubricId}?traineeId=${trainee.traineeId}`
        );
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setGeneralFeedback(d.generalFeedback || '');
          setStrengths(d.strengths || '');
          setImprovementsRequired(d.improvementsRequired || '');
          setRemediationPlan(d.remediationPlan || '');
          setIsExistingFinalized(d.status === 'FINALIZED');

          const loadedScores: Record<string, number> = { ...initialScores };
          const loadedComments: Record<string, string> = { ...initialComments };
          const loadedRatings: Record<string, string> = { ...initialRatings };

          (d.scores || []).forEach((s: any) => {
            loadedScores[s.criterionId] = Number(s.score) || 0;
            loadedComments[s.criterionId] = s.comments || '';
            loadedRatings[s.criterionId] = s.ratingLabel || '';
          });

          setCriteriaScores(loadedScores);
          setCriteriaComments(loadedComments);
          setCriteriaRatings(loadedRatings);
        }
      } catch (err) {
        console.error('Failed to load existing evaluation details:', err);
      }
    }
  };

  // Calculation in real time
  const calculateModalTelemetry = () => {
    if (!rubricDetails) return { totalScore: 0, maxScore: 100, percentage: 0, criticalFailed: false };

    let totalScore = 0;
    let maxScore = 0;
    let criticalFailed = false;

    rubricDetails.criteria.forEach((c) => {
      maxScore += c.maxPoints;
      const score = criteriaScores[c.id] || 0;
      totalScore += score;

      // Fail condition: < 60% of max points for critical items
      if (c.isCritical && (score === 0 || score < c.maxPoints * 0.6)) {
        criticalFailed = true;
      }
    });

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    return { totalScore, maxScore, percentage, criticalFailed };
  };

  const modalTelemetry = calculateModalTelemetry();

  // Save / Finalize Evaluation
  const handleSaveEvaluation = async (submitStatus: 'DRAFT' | 'FINALIZED') => {
    if (!selectedRubricId || !evaluatingTrainee || !selectedCourseId || !rubricDetails) return;

    try {
      setSubmittingEval(true);

      const formattedScores = rubricDetails.criteria.map((c) => ({
        criterionId: c.id,
        score: criteriaScores[c.id] || 0,
        ratingLabel: criteriaRatings[c.id] || '',
        comments: criteriaComments[c.id] || '',
      }));

      const res = await fetch('/api/instructor/practical-evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rubricId: selectedRubricId,
          traineeId: evaluatingTrainee.traineeId,
          courseId: selectedCourseId,
          scores: formattedScores,
          generalFeedback,
          strengths,
          improvementsRequired,
          remediationPlan,
          status: submitStatus,
          amendmentReason: isExistingFinalized ? amendmentReason : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEvalModalOpen(false);
        await fetchTraineeRoster();
      } else {
        alert(json.error || 'Failed to save practical evaluation');
      }
    } catch (err: any) {
      console.error('Failed to save evaluation:', err);
      alert('Network or server error saving evaluation.');
    } finally {
      setSubmittingEval(false);
    }
  };

  // Filter roster
  const filteredRoster = traineeRoster.filter(
    (t) =>
      (t.traineeName || '').toLowerCase().includes(rosterSearch.toLowerCase()) ||
      (t.srn || '').toLowerCase().includes(rosterSearch.toLowerCase()) ||
      (t.rank || '').toLowerCase().includes(rosterSearch.toLowerCase())
  );

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
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              STCW Practical Rubrics & Testing
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Maritime Assessment & Practical Simulator Grading
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed font-sans">
            Score bridge maneuvers, engine room casualty drills, and fire rescue practicals against accredited STCW rubrics.
            Enforce non-negotiable critical safety requirements, record criterion feedback, and release audited competency evaluations.
          </p>
        </div>
      </motion.div>

      {/* Primary Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm w-fit">
        <button
          onClick={() => setActiveTab('ASSESSMENTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'ASSESSMENTS'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Assessments Inventory & Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab('RUBRICS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'RUBRICS'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Practical Rubric Grading Workspace</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ASSESSMENTS INVENTORY (Original Enhanced) */}
      {/* ======================================================== */}
      {activeTab === 'ASSESSMENTS' && (
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assessment code, title, course..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {['ALL', 'MODULAR', 'PRACTICAL', 'FINAL', 'QUIZ'].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold uppercase whitespace-nowrap transition-all ${
                    typeFilter === type
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Assessments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-3">
                <CardGridSkeleton numCards={6} showHeader={false} />
              </div>
            ) : assessments.length === 0 ? (
              <div className="col-span-3 py-12 text-center text-slate-400 font-mono text-xs">
                No assessments found.
              </div>
            ) : (
              assessments.map((a, idx) => {
                const isModular = a.category === 'MODULAR' || a.type === 'MODULAR_THEORY';
                const passRate =
                  a.submissionsCount > 0 ? Math.round((a.passedCount / a.submissionsCount) * 100) : 0;
                const avgMeetsPass = a.averageScore >= a.passingScore;

                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, ease: easeCurve, delay: idx * 0.04 }}
                    whileHover={{ y: -2 }}
                    className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-sky-500/20 transition-all flex flex-col justify-between relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          {a.code}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            isModular
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isModular ? 'Modular Theory' : 'Practical Simulator'}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-3">
                        {a.title}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-[#CBD5E1] mt-1 font-mono">
                        {a.courseTitle}
                      </div>

                      {/* Criteria Container */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase">Benchmark Pass</span>
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {a.passingScore} / {a.totalPoints} pts
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase">Duration</span>
                          <div className="font-semibold text-slate-900 dark:text-[#F8FAFC] mt-0.5">
                            {a.durationMinutes} mins
                          </div>
                        </div>
                      </div>

                      {/* Score Telemetry Container */}
                      <div
                        className={`mt-3 p-3.5 rounded-2xl border text-xs font-mono space-y-2 ${
                          isModular
                            ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40'
                            : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px]">
                            Recorded Score Telemetry
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              a.submissionsCount === 0
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                : avgMeetsPass
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {a.submissionsCount === 0
                              ? 'NO ATTEMPTS'
                              : avgMeetsPass
                              ? 'BENCHMARK MET'
                              : 'REMEDIAL NEEDED'}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                              {a.submissionsCount > 0 ? `${a.averageScore}` : '--'}
                            </span>
                            <span className="text-slate-400 text-xs ml-1">/ {a.totalPoints} pts avg</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {a.submissionsCount > 0 ? `${passRate}%` : 'N/A'}
                            </span>
                            <div className="text-[10px] text-slate-400">Pass Rate</div>
                          </div>
                        </div>

                        <div className="w-full bg-slate-200/80 dark:bg-black/30 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              avgMeetsPass ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, a.averageScore || 0)}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                          <span>
                            Tested:{' '}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {a.submissionsCount} Trainees
                            </strong>
                          </span>
                          <span>
                            Passed:{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {a.passedCount}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      {!isModular ? (
                        <button
                          onClick={() => {
                            setActiveTab('RUBRICS');
                            if (a.courseId) setSelectedCourseId(a.courseId);
                          }}
                          className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                        >
                          <Compass className="w-3.5 h-3.5" /> Grade with Rubric →
                        </button>
                      ) : (
                        <Link
                          href="/grades"
                          className="text-[11px] font-mono text-sky-600 dark:text-sky-400 font-bold hover:underline"
                        >
                          View in Matrix →
                        </Link>
                      )}

                      <button
                        onClick={() => handleOpenSubmissions(a)}
                        className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-mono text-[11px] font-bold shadow-md shadow-sky-500/20 transition-all flex items-center gap-1.5"
                      >
                        <span>Submissions</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20">
                          {a.submissionsCount}
                        </span>
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PRACTICAL RUBRICS & TRAINEE GRADING WORKSPACE */}
      {/* ======================================================== */}
      {activeTab === 'RUBRICS' && (
        <div className="space-y-6">
          {/* Course & Rubric Selectors Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono font-bold uppercase text-slate-400 shrink-0">
                  Course:
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-[#F8FAFC] outline-none"
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
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-mono font-bold uppercase text-slate-400 shrink-0">
                  Rubric:
                </label>
                <select
                  value={selectedRubricId}
                  onChange={(e) => setSelectedRubricId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-[#F8FAFC] outline-none"
                >
                  {loadingRubrics ? (
                    <option value="">Loading course rubrics...</option>
                  ) : rubrics.length === 0 ? (
                    <option value="">No practical rubrics defined</option>
                  ) : (
                    rubrics.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.stcwReference})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search trainee name or SRN..."
                className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Active Rubric Specifications Card (Section 2.2) */}
          {rubricDetails && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-emerald-200/70 dark:border-emerald-900/50 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      {rubricDetails.stcwReference}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Passing Benchmark: {rubricDetails.passingScore}% • Max Points: {rubricDetails.maxScore} pts
                    </span>
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {rubricDetails.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/50">
                    {rubricDetails.criteria.length} Criteria Defined
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold border border-rose-200/50">
                    {rubricDetails.criteria.filter((c) => c.isCritical).length} Critical Safety Items
                  </span>
                </div>
              </div>

              {rubricDetails.instructions && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 text-xs font-sans text-slate-600 dark:text-[#CBD5E1] space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white font-mono text-[10px] uppercase block">
                    Scenario & Assessment Instructions:
                  </span>
                  <p>{rubricDetails.instructions}</p>
                </div>
              )}

              {/* Rubric Criteria Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {rubricDetails.criteria.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3.5 rounded-2xl border text-xs font-mono space-y-1.5 ${
                      c.isCritical
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate" title={c.criterionName}>
                        {c.criterionName}
                      </span>
                      <span className="font-bold text-slate-600 dark:text-slate-300 shrink-0">
                        {c.maxPoints} pts
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans line-clamp-2" title={c.description}>
                      {c.description || 'Standard maritime practical criterion.'}
                    </p>

                    <div className="pt-1 flex items-center justify-between text-[9px]">
                      {c.isCritical ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Mandatory Safety Pass
                        </span>
                      ) : (
                        <span className="text-slate-400">Standard Criterion</span>
                      )}
                      <span className="text-slate-400 font-bold">Weight: {c.weightPct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Trainee Evaluation Roster Table (Section 2.1) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                  Enrolled Trainee Practical Evaluation Roster
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Isolates seafarers strictly enrolled in selected course & batch. Unattempted drills display as Not Evaluated.
                </p>
              </div>

              <div className="text-xs font-mono text-slate-400">
                Total Enrolled: <strong className="text-slate-900 dark:text-white">{filteredRoster.length}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100/80 dark:bg-slate-900/60 text-slate-500 dark:text-[#CBD5E1] text-[11px] uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 pl-6">Trainee Seafarer</th>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Evaluation Status</th>
                    <th className="py-3 px-4">Practical Score</th>
                    <th className="py-3 px-4">Competency Result</th>
                    <th className="py-3 px-4 pr-6 text-right">Grading Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {loadingRoster ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Loading trainee roster for practical grading...
                      </td>
                    </tr>
                  ) : filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No enrolled trainees found for this course.
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((t) => {
                      const isFinalized = t.status === 'FINALIZED';
                      const isDraft = t.status === 'DRAFT';
                      const isCompetent = t.competencyStatus === 'COMPETENT';

                      return (
                        <tr key={t.traineeId} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4 pl-6">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar
                                src={t.avatarUrl}
                                name={t.traineeName}
                                alt={t.traineeName || 'Trainee'}
                                className="w-8 h-8 rounded-xl"
                                fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-bold"
                              />
                              <div className="min-w-0">
                                <div className="font-sans font-bold text-slate-900 dark:text-[#F8FAFC]">
                                  {t.traineeName}
                                </div>
                                <div className="text-[10px] text-slate-400">{t.srn}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-sans text-slate-600 dark:text-[#CBD5E1]">
                            {t.rank}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isFinalized
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                  : isDraft
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                  : 'bg-slate-500/15 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {isFinalized ? 'FINALIZED' : isDraft ? 'DRAFT SAVED' : 'NOT EVALUATED'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-[#F8FAFC]">
                            {t.score !== null ? (
                              <span>
                                {t.score} / {t.maxScore} pts ({t.percentage}%)
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">-- / {t.maxScore} pts</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {t.competencyStatus && t.competencyStatus !== 'NOT_STARTED' ? (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isCompetent
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                {(t.competencyStatus || 'PENDING').replace(/_/g, ' ')}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Pending Evaluation</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 pr-6 text-right">
                            <button
                              onClick={() => handleOpenEvaluationModal(t)}
                              className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold transition-all flex items-center gap-1.5 ml-auto ${
                                isFinalized
                                  ? 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-white'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{isFinalized ? 'Amend Score' : isDraft ? 'Resume Draft' : 'Grade Rubric'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PRACTICAL RUBRIC GRADING MODAL */}
      {/* ======================================================== */}
      <AnimatePresence>
        {evalModalOpen && evaluatingTrainee && rubricDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEvalModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      {rubricDetails.stcwReference}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <UserAvatar
                        src={evaluatingTrainee.avatarUrl}
                        name={evaluatingTrainee.traineeName}
                        alt={evaluatingTrainee.traineeName || 'Trainee'}
                        className="w-6 h-6 rounded-lg"
                        fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[9px] font-bold"
                      />
                      <span className="text-xs font-mono text-slate-400">
                        Candidate: <strong className="text-slate-900 dark:text-white">{evaluatingTrainee.traineeName}</strong> ({evaluatingTrainee.srn})
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {rubricDetails.title}
                  </h3>
                </div>
                <button
                  onClick={() => setEvalModalOpen(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Real-time Telemetry & Critical Safety Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase">Calculated Score</span>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                    {modalTelemetry.totalScore} / {modalTelemetry.maxScore} pts
                  </div>
                  <div className="text-[10px] text-slate-400">{modalTelemetry.percentage}% calculated</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase">Passing Threshold</span>
                  <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {rubricDetails.passingScore}%
                  </div>
                  <div className="text-[10px] text-slate-400">STCW minimum</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase">Projected Competency</span>
                  <div
                    className={`text-sm font-extrabold uppercase mt-1 ${
                      modalTelemetry.criticalFailed || modalTelemetry.percentage < rubricDetails.passingScore
                        ? 'text-rose-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {modalTelemetry.criticalFailed || modalTelemetry.percentage < rubricDetails.passingScore
                      ? 'NOT YET COMPETENT'
                      : 'COMPETENT'}
                  </div>
                </div>
              </div>

              {/* Critical Safety Alert Banner if triggered */}
              {modalTelemetry.criticalFailed && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold">CRITICAL SAFETY OVERRIDE ACTIVE</div>
                    <p className="text-[11px] leading-relaxed">
                      One or more critical safety criteria are scored below required passing standard.
                      Per STCW Section A-I/12, the trainee competency result is automatically locked to <strong>NOT YET COMPETENT</strong>, regardless of the numerical total score.
                    </p>
                  </div>
                </div>
              )}

              {/* Criteria Scoring List (Section 2.1) */}
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold uppercase text-slate-500 dark:text-slate-400">
                  Rubric Criteria Scoring Matrix
                </h4>

                <div className="space-y-3">
                  {rubricDetails.criteria.map((c) => {
                    const currentScore = criteriaScores[c.id] || 0;
                    const isFailingCrit = c.isCritical && (currentScore === 0 || currentScore < c.maxPoints * 0.6);

                    return (
                      <div
                        key={c.id}
                        className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                          c.isCritical
                            ? isFailingCrit
                              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                              : 'bg-amber-50/30 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/40'
                            : 'bg-slate-50/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-[#F8FAFC] text-xs font-mono">
                                {c.sortOrder}. {c.criterionName}
                              </span>
                              {c.isCritical && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                  CRITICAL SAFETY
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                              {c.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                              {currentScore} / {c.maxPoints} pts
                            </span>
                          </div>
                        </div>

                        {/* Quick Rating Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                          <span className="text-slate-400 mr-1 uppercase">Rating:</span>
                          {[
                            { label: 'Unsatisfactory', pct: 0 },
                            { label: 'Needs Improvement', pct: 0.5 },
                            { label: 'Competent', pct: 0.8 },
                            { label: 'Exemplary', pct: 1.0 },
                          ].map((rating) => {
                            const val = Math.round(c.maxPoints * rating.pct);
                            const isSelected = currentScore === val;

                            return (
                              <button
                                key={rating.label}
                                type="button"
                                onClick={() => {
                                  setCriteriaScores((prev) => ({ ...prev, [c.id]: val }));
                                  setCriteriaRatings((prev) => ({ ...prev, [c.id]: rating.label }));
                                }}
                                className={`px-2.5 py-1 rounded-lg border font-bold transition-all ${
                                  isSelected
                                    ? 'bg-sky-600 dark:bg-sky-600 text-white border-transparent shadow-sm'
                                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                {rating.label} ({val} pts)
                              </button>
                            );
                          })}

                          {/* Custom Number Input */}
                          <input
                            type="number"
                            min={0}
                            max={c.maxPoints}
                            value={currentScore}
                            onChange={(e) => {
                              const val = Math.min(c.maxPoints, Math.max(0, Number(e.target.value) || 0));
                              setCriteriaScores((prev) => ({ ...prev, [c.id]: val }));
                            }}
                            className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-xs font-bold text-center text-slate-900 dark:text-white outline-none ml-2"
                          />
                        </div>

                        {/* Criterion Comment */}
                        <input
                          type="text"
                          placeholder="Criterion-specific feedback or observations..."
                          value={criteriaComments[c.id] || ''}
                          onChange={(e) =>
                            setCriteriaComments((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overall Feedback & Remediation Plan */}
              <div className="space-y-3 font-sans text-xs">
                <div>
                  <label className="font-mono font-bold text-[11px] uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    Overall Practical Feedback & Remarks:
                  </label>
                  <textarea
                    rows={2}
                    value={generalFeedback}
                    onChange={(e) => setGeneralFeedback(e.target.value)}
                    placeholder="Provide overarching commentary on bridge or engine room simulator execution..."
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 block mb-1">
                      Strengths Demonstrated:
                    </label>
                    <textarea
                      rows={2}
                      value={strengths}
                      onChange={(e) => setStrengths(e.target.value)}
                      placeholder="Observed competencies, effective communications, safe maneuvers..."
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-mono font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 block mb-1">
                      Areas Requiring Improvement:
                    </label>
                    <textarea
                      rows={2}
                      value={improvementsRequired}
                      onChange={(e) => setImprovementsRequired(e.target.value)}
                      placeholder="Identified procedural gaps, slow reaction times, radar blindspots..."
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-rose-600 dark:text-rose-400 block mb-1">
                    Remediation & Re-Assessment Plan (Required if Not Yet Competent):
                  </label>
                  <textarea
                    rows={2}
                    value={remediationPlan}
                    onChange={(e) => setRemediationPlan(e.target.value)}
                    placeholder="Specific simulator training sessions, coaching drills, or scheduled re-test date..."
                    className="w-full p-2.5 rounded-xl bg-rose-50/30 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-slate-900 dark:text-[#F8FAFC] outline-none"
                  />
                </div>

                {isExistingFinalized && (
                  <div>
                    <label className="font-mono font-bold text-[10px] uppercase text-amber-600 block mb-1">
                      Reason for Amending Finalized Grade (Audit Trail):
                    </label>
                    <input
                      type="text"
                      required
                      value={amendmentReason}
                      onChange={(e) => setAmendmentReason(e.target.value)}
                      placeholder="Formal justification for updating a finalized assessment..."
                      className="w-full p-2.5 rounded-xl bg-amber-50/30 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-slate-900 dark:text-[#F8FAFC] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setEvalModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={submittingEval}
                    onClick={() => handleSaveEvaluation('DRAFT')}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-slate-200 font-bold transition-all flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Draft</span>
                  </button>

                  <button
                    type="button"
                    disabled={submittingEval}
                    onClick={() => handleSaveEvaluation('FINALIZED')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    <span>Finalize & Submit</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Existing Submissions Modal */}
      <AnimatePresence>
        {submissionModalOpen && selectedAssessment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSubmissionModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    {selectedAssessment.code}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-1">
                    {selectedAssessment.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSubmissionModalOpen(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Course: {selectedAssessment.courseTitle}</span>
                  <Link href="/grades" className="text-sky-600 dark:text-sky-400 font-bold hover:underline">
                    Open Gradebook Matrix →
                  </Link>
                </div>

                {loadingSubmissions ? (
                  <div className="py-8 text-center text-xs font-mono text-slate-400">Loading submissions...</div>
                ) : submissions.length === 0 ? (
                  <div className="py-8 text-center text-xs font-mono text-slate-400">
                    No submissions recorded for this assessment.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {submissions.map((sub: any) => (
                      <div
                        key={sub.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between gap-4 text-xs font-mono"
                      >
                        <div className="flex items-start gap-2.5">
                          <UserAvatar
                            src={sub.traineeAvatarUrl}
                            name={sub.traineeName}
                            alt={sub.traineeName || 'Trainee'}
                            className="w-8 h-8 rounded-xl mt-0.5"
                            fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                          />
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC] font-sans">
                              {sub.traineeName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {sub.traineeSrn} • Submitted: {new Date(sub.submittedAt).toLocaleDateString()}
                            </div>
                            {sub.feedback && (
                              <p className="text-[11px] text-slate-500 font-sans italic pt-1">{sub.feedback}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`font-bold text-sm ${
                              sub.result === 'PASSED'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {sub.score} / {sub.maxScore} pts
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              sub.result === 'PASSED'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/15 text-rose-600'
                            }`}
                          >
                            {sub.result}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
