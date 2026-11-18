'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Lock,
  BookOpen,
  Calendar,
  GraduationCap,
  ClipboardCheck,
  Check,
  Layers,
  Sparkles,
  HelpCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { CardGridSkeleton } from '@newsim/ui';

type Choice = { id: string; text: string; isCorrect?: boolean };
type Question = {
  id: string;
  question: string;
  questionType?: string;
  points: number;
  options: Choice[];
  correctChoiceId?: string | null;
  correctAnswerText?: string | null;
};

type QuestionResult = {
  questionId: string;
  questionText: string;
  questionType?: string;
  selectedChoiceId: string | null;
  selectedChoiceText?: string | null;
  isCorrect: boolean;
  pointsEarned: number;
  pointsPossible: number;
  correctChoiceId?: string | null;
  correctChoiceText?: string | null;
};

type Assessment = {
  id: string;
  code: string;
  title: string;
  description: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  type: string;
  durationMinutes: number;
  passingScore: number;
  status: string;
  isAttempted: boolean;
  isPassed: boolean;
  score: number | null;
  correctCount?: number | null;
  totalQuestions?: number;
  scoreDisplay?: string | null;
  submittedAt: string | null;
  attemptId: string | null;
  questionsCount: number;
  moduleId: string | null;
  moduleTitle: string | null;
  moduleSortOrder: number | null;
  isLocked: boolean;
  lockReason: string | null;
  dayNumber?: number | null;
  scheduledDate?: string | null;
  isDueToday?: boolean;
  isFailed?: boolean;
  canRetry?: boolean;
  attemptsUsed?: number;
  attemptsAllowed?: number | null;
  requiresPractical?: boolean;
  questions: Question[];
  userAnswers?: Record<string, string>;
};

type SubmissionResult = {
  score: number;
  passed: boolean;
  passingScore?: number;
  earnedPoints?: number;
  totalPoints?: number;
  correctCount?: number;
  totalQuestions?: number;
  isPostTest: boolean;
  alreadyAttempted?: boolean;
  attemptNumber?: number;
  canRetry?: boolean;
  requiresPractical?: boolean;
  certificateIssued?: boolean;
  feedback: string;
  questionResults?: QuestionResult[];
};

export default function AssessmentsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramAssessmentId = searchParams.get('assessmentId');
  const paramCourseId = searchParams.get('courseId');
  const paramRetake = searchParams.get('retake') === '1';

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeExam, setActiveExam] = useState<Assessment | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'step' | 'all'>('step');
  const [showReviewList, setShowReviewList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const autoOpenedRef = useRef<string | null>(null);

  const fetchAssessments = async () => {
    try {
      setErrorMsg(null);
      const res = await fetch('/api/trainee/assessments', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAssessments(json.data);
        return json.data as Assessment[];
      }
      setErrorMsg(json.error || 'Failed to load assessments');
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load assessments');
    } finally {
      setLoading(false);
    }
    return [] as Assessment[];
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const openExam = React.useCallback((asm: Assessment, startRetake = false) => {
    if (asm.isLocked) return;
    const isRetaking = startRetake && !asm.isPassed;
    setActiveExam(asm);
    setCurrentQuestionIndex(0);
    setViewMode('step');
    setShowReviewList(false);
    setSelectedAnswers(isRetaking ? {} : asm.userAnswers || {});
    setSubmitError(null);
    setConfirmOpen(false);

    if (asm.isAttempted && !isRetaking) {
      const qResults: QuestionResult[] = asm.questions.map((q) => {
        const isIdent = String(q.questionType || 'MULTIPLE_CHOICE').toUpperCase() === 'IDENTIFICATION';
        const rawUserAnswer = (asm.userAnswers || {})[q.id] || null;
        const picked = isIdent ? null : q.options.find((opt) => opt.id === rawUserAnswer);
        const isCorrect = isIdent
          ? Boolean(
              rawUserAnswer &&
                q.correctAnswerText &&
                rawUserAnswer.trim().toLowerCase() === q.correctAnswerText.trim().toLowerCase()
            )
          : Boolean(q.correctChoiceId && q.correctChoiceId === rawUserAnswer);
        const correctOpt = isIdent ? null : q.options.find((opt) => opt.id === q.correctChoiceId);
        return {
          questionId: q.id,
          questionText: q.question,
          questionType: q.questionType,
          selectedChoiceId: isIdent ? null : rawUserAnswer,
          selectedChoiceText: isIdent ? rawUserAnswer : picked?.text || null,
          isCorrect,
          pointsEarned: isCorrect ? (q.points || 1) : 0,
          pointsPossible: q.points || 1,
          correctChoiceId: q.correctChoiceId || null,
          correctChoiceText: q.correctAnswerText || correctOpt?.text || null,
        };
      });

      const totalPts = qResults.reduce((acc, q) => acc + q.pointsPossible, 0);
      const earnedPts = qResults.reduce((acc, q) => acc + q.pointsEarned, 0);
      const correctCnt = qResults.filter((q) => q.isCorrect).length;

      setSubmissionResult({
        score: asm.score ?? 0,
        passed: asm.isPassed,
        passingScore: asm.passingScore,
        earnedPoints: earnedPts,
        totalPoints: totalPts || asm.questions.length,
        correctCount: correctCnt,
        totalQuestions: asm.questions.length,
        isPostTest: !asm.moduleId,
        alreadyAttempted: true,
        canRetry: !asm.isPassed,
        requiresPractical: asm.requiresPractical,
        feedback: asm.isPassed
          ? `Your attempt passed with an official score of ${asm.score ?? 0}%.`
          : `Your latest attempt scored ${asm.score ?? 0}% (passing mark: ${asm.passingScore}%). You may reattempt this assessment.`,
        questionResults: qResults,
      });
    } else {
      setSubmissionResult(null);
    }
  }, []);

  const handleStartRetake = React.useCallback(() => {
    if (!activeExam || activeExam.isPassed) return;
    setSubmissionResult(null);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setViewMode('step');
    setShowReviewList(false);
    setSubmitError(null);
    setConfirmOpen(false);
  }, [activeExam]);

  // Auto-open the assessment that was just unlocked from the Learning Player
  useEffect(() => {
    if (loading || !paramAssessmentId || autoOpenedRef.current === paramAssessmentId) return;
    const target = assessments.find((a) => a.id === paramAssessmentId);
    if (target) {
      autoOpenedRef.current = paramAssessmentId;
      openExam(target, paramRetake);
    }
  }, [loading, assessments, paramAssessmentId, paramRetake, openExam]);

  // Group assessments by course, order: module pre-tests by syllabus order, post-test last
  const grouped = useMemo(() => {
    const filtered = paramCourseId ? assessments.filter((a) => a.courseId === paramCourseId) : assessments;
    const list = filtered.length > 0 ? filtered : assessments;
    const map = new Map<string, { courseTitle: string; courseCode: string; items: Assessment[] }>();
    list.forEach((a) => {
      if (!map.has(a.courseId)) map.set(a.courseId, { courseTitle: a.courseTitle, courseCode: a.courseCode, items: [] });
      map.get(a.courseId)!.items.push(a);
    });
    map.forEach((g) =>
      g.items.sort((x, y) => {
        if (!x.moduleId && y.moduleId) return 1;
        if (x.moduleId && !y.moduleId) return -1;
        return (x.moduleSortOrder ?? 999) - (y.moduleSortOrder ?? 999) || x.title.localeCompare(y.title);
      })
    );
    return Array.from(map.entries());
  }, [assessments, paramCourseId]);

  const closeExam = () => {
    setActiveExam(null);
    setConfirmOpen(false);
    setShowReviewList(false);
    if (paramAssessmentId) router.replace(paramCourseId ? `/assessments?courseId=${paramCourseId}` : '/assessments');
  };

  const answeredCount = activeExam
    ? activeExam.questions.filter((q) => Boolean(String(selectedAnswers[q.id] || '').trim())).length
    : 0;
  const totalQuestionsCount = activeExam ? activeExam.questions.length : 0;
  const allAnswered = Boolean(activeExam && totalQuestionsCount > 0 && answeredCount === totalQuestionsCount);
  const progressPercent = totalQuestionsCount > 0 ? Math.round((answeredCount / totalQuestionsCount) * 100) : 0;

  const currentQuestion = activeExam?.questions[currentQuestionIndex];

  const handleSelectAnswer = (questionId: string, value: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const renderQuestionAnswerInput = (q: Question, compact = false) => {
    const qType = String(q.questionType || 'MULTIPLE_CHOICE').toUpperCase();
    if (qType === 'IDENTIFICATION') {
      return (
        <div className="space-y-1.5">
          <label className="block text-[10px] font-mono font-bold uppercase text-sky-600 dark:text-sky-400">
            Identification / Direct Answer
          </label>
          <input
            type="text"
            disabled={submitting}
            value={selectedAnswers[q.id] || ''}
            onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
            placeholder="Type your exact answer here..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-[#F8FAFC] outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>
      );
    }

    return q.options.map((opt, optIdx) => {
      const isSelected = selectedAnswers[q.id] === opt.id;
      const letter = String.fromCharCode(65 + optIdx);
      return (
        <button
          key={opt.id}
          type="button"
          disabled={submitting}
          onClick={() => handleSelectAnswer(q.id, opt.id)}
          className={`w-full text-left font-sans transition-all flex items-center cursor-pointer ${
            compact
              ? `p-3 rounded-xl text-xs gap-3 ${
                  isSelected
                    ? 'bg-sky-600 text-white font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-slate-700'
                }`
              : `p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm gap-3.5 border ${
                  isSelected
                    ? 'bg-sky-600 border-[#0B3D91] text-white font-bold shadow-md ring-2 ring-[#3BA7F2]/40'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:border-sky-500/40 hover:bg-slate-100 dark:hover:bg-[#0a2544]'
                }`
          }`}
        >
          <span
            className={`rounded-full border font-mono font-bold flex items-center justify-center shrink-0 ${
              compact
                ? `w-5 h-5 text-[11px] ${isSelected ? 'border-white bg-white/20' : 'border-slate-200/80 dark:border-slate-800'}`
                : `w-6 h-6 text-xs ${
                    isSelected ? 'border-white bg-white/20 text-white' : 'border-slate-200/80 dark:border-slate-800 text-sky-600 dark:text-sky-400'
                  }`
            }`}
          >
            {letter}
          </span>
          <span className={compact ? '' : 'flex-1'}>{opt.text}</span>
          {!compact && isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        </button>
      );
    });
  };

  const handleSubmitExam = async () => {
    if (!activeExam || activeExam.isPassed || submissionResult) return;
    try {
      setSubmitting(true);
      setSubmitError(null);
      const res = await fetch(`/api/trainee/assessments/${activeExam.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 0, answers: selectedAnswers }),
      });
      const json = await res.json();
      if (!json.success) {
        setSubmitError(json.error || 'Failed to submit assessment.');
        return;
      }
      setSubmissionResult(json.data);
      if (json.data?.passed) {
        setActiveExam((prev) => (prev ? { ...prev, isPassed: true, isAttempted: true, score: json.data.score } : prev));
      } else {
        setActiveExam((prev) => (prev ? { ...prev, isAttempted: true, isFailed: true, canRetry: true, score: json.data.score } : prev));
      }
      setConfirmOpen(false);
      setShowReviewList(false);
      await fetchAssessments();
    } catch (err) {
      console.error(err);
      setSubmitError('Failed to submit assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              Assessments Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Module Assessments &amp; Course Post-Test
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] font-sans mt-0.5">
            Complete each module quiz and the final course post-test to fulfill your theoretical competency requirements. If you score below the passing mark, you can reattempt the assessment until you pass and qualify for your certificate.
          </p>
        </div>
        <Link
          href={paramCourseId ? `/learning?courseId=${paramCourseId}` : '/learning'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 text-sky-600 dark:text-sky-400 font-bold text-xs hover:bg-sky-500/10 transition-all"
        >
          <BookOpen className="w-4 h-4" />
          <span>Back to Learning Player</span>
        </Link>
      </div>

      {loading ? (
        <CardGridSkeleton numCards={6} showHeader={false} />
      ) : errorMsg ? (
        <div className="py-16 text-center rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
          <ShieldAlert className="w-8 h-8 text-sky-500 mx-auto" />
          <p className="text-lg font-bold text-slate-800 dark:text-[#CBD5E1]">Assessments Unavailable</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{errorMsg}</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
          <Award className="w-8 h-8 text-sky-500 mx-auto" />
          <p className="text-sm font-bold text-slate-800 dark:text-[#CBD5E1]">No assessments currently assigned.</p>
        </div>
      ) : (
        grouped.map(([courseId, group]) => (
          <section key={courseId} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-slate-200/80 dark:border-slate-800">
                {group.courseCode}
              </span>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">{group.courseTitle}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {group.items.map((asm) => {
                const isPostTest = !asm.moduleId;
                const isHighlighted = asm.id === paramAssessmentId;

                const totalQ = asm.totalQuestions || asm.questionsCount || 10;
                const correctQ =
                  asm.correctCount != null
                    ? asm.correctCount
                    : asm.isAttempted
                    ? Math.round(((asm.score ?? 0) * totalQ) / 100)
                    : null;
                const minPassQ = Math.ceil((totalQ * (asm.passingScore || 75)) / 100);

                let badgeText = 'READY';
                let badgeClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
                if (asm.isAttempted) {
                  badgeText = asm.isPassed
                    ? `PASSED • ${correctQ}/${totalQ} (${asm.score ?? 0}%)`
                    : `FAILED • ${correctQ}/${totalQ} (${asm.score ?? 0}%)`;
                  badgeClass = asm.isPassed
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20';
                } else if (asm.isFailed) {
                  badgeText = 'REATTEMPT AVAILABLE';
                  badgeClass = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
                } else if (asm.isLocked) {
                  const modNum = asm.moduleSortOrder ?? asm.dayNumber;
                  badgeText = modNum ? `LOCKED • MODULE ${modNum}` : 'LOCKED';
                  badgeClass = 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-500/20';
                }

                return (
                  <div
                    key={asm.id}
                    className={`relative rounded-3xl bg-white dark:bg-[#0c1a2c] border shadow-sm flex flex-col justify-between overflow-hidden transition-all ${
                      isHighlighted
                        ? 'border-slate-200/80 dark:border-slate-800 ring-2 ring-[#3BA7F2]/40'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40'
                    } ${asm.isLocked ? 'opacity-70' : ''}`}
                  >
                    <div className="p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded font-mono font-bold text-[10px] border ${
                            isPostTest
                              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30'
                              : 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20'
                          }`}
                        >
                          {isPostTest
                            ? 'COURSE POST-TEST'
                            : (asm.moduleSortOrder ?? asm.dayNumber)
                            ? `MODULE ${asm.moduleSortOrder ?? asm.dayNumber} QUIZ`
                            : 'MODULE ASSESSMENT'}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">{asm.title}</h3>
                        {asm.moduleTitle && (
                          <p className="text-[11px] text-slate-600 dark:text-[#CBD5E1] font-mono mt-1">Module: {asm.moduleTitle}</p>
                        )}
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-[#CBD5E1]">
                        <div className="flex justify-between">
                          <span>Total Questions:</span>
                          <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{totalQ} Questions</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Passing Score:</span>
                          <span className="font-bold text-sky-600 dark:text-sky-400">
                            {asm.passingScore}% ({minPassQ}/{totalQ})
                          </span>
                        </div>
                        {asm.isAttempted && (
                          <div className="flex justify-between">
                            <span>Total Score:</span>
                            <span className={`font-bold ${asm.isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {correctQ}/{totalQ} ({asm.score ?? 0}%)
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Time Limit:</span>
                          <span>{asm.durationMinutes} Minutes</span>
                        </div>
                      </div>

                      {(asm.isFailed || (asm.isAttempted && !asm.isPassed)) && (
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-700 dark:text-amber-300 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                          <span>
                            Score below {asm.passingScore}% passing standard. You can reattempt this assessment now to pass and progress toward certification.
                          </span>
                        </div>
                      )}

                      {asm.isLocked && asm.lockReason && !asm.isFailed && (
                        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
                          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{asm.lockReason}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-slate-500">
                        {asm.isPassed
                          ? `Passed (${asm.attemptsUsed || 1} attempt${(asm.attemptsUsed || 1) > 1 ? 's' : ''})`
                          : asm.isAttempted
                          ? `${asm.attemptsUsed || 1} attempt${(asm.attemptsUsed || 1) > 1 ? 's' : ''} • Reattempt available`
                          : 'Reattempts allowed if failed'}
                      </span>

                      {asm.isLocked ? (
                        <Link
                          href={`/learning?courseId=${asm.courseId}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold text-xs"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Read Module</span>
                        </Link>
                      ) : asm.isAttempted && !asm.isPassed ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openExam(asm, false)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                          >
                            <span>Result</span>
                          </button>
                          <button
                            onClick={() => openExam(asm, true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reattempt</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openExam(asm, false)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer bg-sky-600 hover:bg-sky-500 text-white"
                        >
                          <span>{asm.isAttempted ? 'View Result' : 'Start Assessment'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* Assessment Taking Modal */}
      <AnimatePresence>
        {activeExam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && closeExam()}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[92dvh] bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              <div className="h-1.5 bg-sky-500 w-full shrink-0" />

              {/* Modal Top Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold border border-sky-500/20">
                      {activeExam.moduleId ? 'MODULE ASSESSMENT' : 'COURSE POST-TEST'}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                      {activeExam.isPassed
                        ? 'Passed'
                        : activeExam.isAttempted
                        ? `Reattempt (${activeExam.attemptsUsed || 1} prior attempt${(activeExam.attemptsUsed || 1) > 1 ? 's' : ''})`
                        : 'Passing Required'}
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Questions: <strong>{totalQuestionsCount}</strong>
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Passing: <strong>{activeExam.passingScore}% ({Math.ceil((totalQuestionsCount * activeExam.passingScore) / 100)}/{totalQuestionsCount})</strong>
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sky-500" />
                      <span>{activeExam.durationMinutes} Mins</span>
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading leading-snug">
                    {activeExam.title}
                  </h2>
                  {activeExam.moduleTitle && (
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Module: {activeExam.moduleTitle}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!submissionResult && activeExam.questions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setViewMode(viewMode === 'step' ? 'all' : 'step')}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-sky-500/10 transition-colors flex items-center gap-1"
                    >
                      <Layers className="w-3.5 h-3.5 text-sky-500" />
                      <span>{viewMode === 'step' ? 'All Questions' : 'Step-by-Step'}</span>
                    </button>
                  )}
                  <button
                    onClick={closeExam}
                    disabled={submitting}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-sky-500/10 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Progress and Question Stepper Bar (Only when taking exam) */}
              {!submissionResult && activeExam.questions.length > 0 && (
                <div className="px-4 sm:px-6 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 shrink-0 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-sky-700 dark:text-sky-400 font-bold">
                      Question {currentQuestionIndex + 1} of {totalQuestionsCount}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Answered: <strong>{answeredCount}</strong> / {totalQuestionsCount} ({progressPercent}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Quick Question Stepper Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
                    {activeExam.questions.map((q, idx) => {
                      const isAnswered = Boolean(String(selectedAnswers[q.id] || '').trim());
                      const isCurrent = idx === currentQuestionIndex && viewMode === 'step' && !showReviewList;

                      let pillClass = 'bg-white dark:bg-white/5 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-300';
                      if (isCurrent) {
                        pillClass = 'bg-sky-600 text-white border-[#0B3D91] ring-2 ring-[#3BA7F2] font-bold shadow-xs';
                      } else if (isAnswered) {
                        pillClass = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-bold';
                      }

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setCurrentQuestionIndex(idx);
                            setViewMode('step');
                            setShowReviewList(false);
                          }}
                          className={`min-w-8 h-7 px-2 rounded-lg text-[11px] font-mono border flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 ${pillClass}`}
                        >
                          <span>{idx + 1}</span>
                          {isAnswered && !isCurrent && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-5 flex-1 min-h-0">
                {submissionResult ? (
                  /* ========================================================
                     SUBMISSION RESULT VIEW
                     ======================================================== */
                  <div className="space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="text-center py-4 space-y-3">
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto text-white shadow-xl ${
                          submissionResult.passed ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-rose-500 shadow-rose-500/30'
                        }`}
                      >
                        {submissionResult.passed ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                      </div>

                      <div>
                        <span className="font-mono text-xs uppercase font-bold text-slate-400">
                          {submissionResult.alreadyAttempted
                            ? `Recorded Evaluation (${activeExam.attemptsUsed || 1} attempt${(activeExam.attemptsUsed || 1) > 1 ? 's' : ''})`
                            : submissionResult.attemptNumber && submissionResult.attemptNumber > 1
                            ? `Reattempt #${submissionResult.attemptNumber} Evaluated & Recorded`
                            : 'Assessment Evaluated & Recorded'}
                        </span>
                        <h3 className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-0.5">
                          {submissionResult.passed ? 'Competency Standard Satisfied!' : 'Below Passing Score'}
                        </h3>
                        <div className="text-2xl font-mono font-extrabold text-sky-600 dark:text-sky-400 mt-1">
                          Total Score: {submissionResult.correctCount ?? 0}/{submissionResult.totalQuestions ?? activeExam.questions.length} ({submissionResult.score}%)
                        </div>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          Passing Standard: {submissionResult.passingScore ?? activeExam.passingScore}% (Min. {Math.ceil(((submissionResult.totalQuestions ?? activeExam.questions.length) * (submissionResult.passingScore ?? activeExam.passingScore)) / 100)}/{submissionResult.totalQuestions ?? activeExam.questions.length} Correct)
                        </p>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] max-w-lg mx-auto">
                        {submissionResult.feedback}
                      </p>

                      {/* Score metrics breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md mx-auto pt-2">
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center">
                          <span className="text-[10px] font-mono uppercase text-slate-500 block">Total Score</span>
                          <span className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                            {submissionResult.correctCount ?? 0}/{submissionResult.totalQuestions ?? activeExam.questions.length}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center">
                          <span className="text-[10px] font-mono uppercase text-slate-500 block">Percentage (75% Pass)</span>
                          <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-heading">
                            {submissionResult.score}%
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center col-span-2 sm:col-span-1">
                          <span className="text-[10px] font-mono uppercase text-slate-500 block">STCW Outcome</span>
                          <span
                            className={`text-base font-extrabold font-heading ${
                              submissionResult.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {submissionResult.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </div>
                      </div>

                      {submissionResult.isPostTest && submissionResult.passed && (
                        activeExam.requiresPractical === false || submissionResult.requiresPractical === false ? (
                          <div className="max-w-md mx-auto p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-left">
                            <Award className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            <div className="text-[11px] text-slate-700 dark:text-slate-200">
                              <strong className="text-emerald-700 dark:text-emerald-400 block font-heading mb-0.5">
                                Full Modular Requirements Completed
                              </strong>
                              {submissionResult.certificateIssued
                                ? 'Congratulations! Your grades have been finalized and your official STCW Certificate has been issued.'
                                : 'Your course post-test passed. Visit Certificates to claim or download your official completion certificate.'}
                            </div>
                          </div>
                        ) : (
                          <div className="max-w-md mx-auto p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-left">
                            <ClipboardCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            <div className="text-[11px] text-slate-700 dark:text-slate-200">
                              <strong className="text-emerald-700 dark:text-emerald-400 block font-heading mb-0.5">
                                Practical Attendance Cleared
                              </strong>
                              Your theoretical completion has been recorded in your instructor&apos;s practical training attendance roster.
                            </div>
                          </div>
                        )
                      )}

                      {!submissionResult.passed && (
                        <div className="max-w-md mx-auto p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-left">
                          <RotateCcw className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          <div className="text-[11px] text-slate-700 dark:text-slate-200">
                            <strong className="text-amber-700 dark:text-amber-400 block font-heading mb-0.5">
                              Reattempt Available
                            </strong>
                            Review the questions below, then click <strong>Reattempt Assessment</strong> to retake this exam and reach the passing score ({submissionResult.passingScore ?? activeExam.passingScore}%).
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Detailed Question Review Breakdown */}
                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4 text-sky-500" />
                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                            Review of Questions & Solutions
                          </h4>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {activeExam.questions.length} Questions Evaluated
                        </span>
                      </div>

                      <div className="space-y-3">
                        {activeExam.questions.map((q, idx) => {
                          const res = submissionResult.questionResults?.find((r) => r.questionId === q.id);
                          const isIdent =
                            String(q.questionType || res?.questionType || 'MULTIPLE_CHOICE').toUpperCase() === 'IDENTIFICATION';
                          const rawUserAns = selectedAnswers[q.id] || (activeExam.userAnswers || {})[q.id] || '';
                          const userChoiceId = res ? res.selectedChoiceId : (isIdent ? null : rawUserAns);
                          const isCorrect = res
                            ? res.isCorrect
                            : isIdent
                            ? Boolean(
                                rawUserAns &&
                                  q.correctAnswerText &&
                                  rawUserAns.trim().toLowerCase() === q.correctAnswerText.trim().toLowerCase()
                              )
                            : Boolean(q.correctChoiceId && q.correctChoiceId === userChoiceId);
                          const userChoice = isIdent ? null : q.options.find((opt) => opt.id === userChoiceId);
                          const correctChoice = isIdent
                            ? null
                            : q.options.find((opt) => opt.id === (res?.correctChoiceId || q.correctChoiceId));
                          const userAnswerDisplay =
                            res?.selectedChoiceText ||
                            userChoice?.text ||
                            (isIdent ? rawUserAns : null) ||
                            'No Answer Provided';
                          const correctAnswerDisplay =
                            res?.correctChoiceText || q.correctAnswerText || correctChoice?.text || null;

                          return (
                            <div
                              key={q.id}
                              className={`p-4 rounded-2xl border transition-all ${
                                isCorrect
                                  ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30'
                                  : 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/30'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-[#F8FAFC]">
                                  {idx + 1}. {q.question}
                                </span>
                                <span
                                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                                    isCorrect
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {isCorrect ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span>Correct</span>
                                    </>
                                  ) : (
                                    <>
                                      <X className="w-3 h-3" />
                                      <span>Incorrect</span>
                                    </>
                                  )}
                                </span>
                              </div>

                              <div className="space-y-1.5 text-xs font-sans pl-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-slate-400 font-bold uppercase w-24 shrink-0">
                                    Your Answer:
                                  </span>
                                  <span
                                    className={`font-semibold ${
                                      isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300 line-through'
                                    }`}
                                  >
                                    {userAnswerDisplay}
                                  </span>
                                </div>

                                {!isCorrect && correctAnswerDisplay && (
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase w-24 shrink-0">
                                      Correct Solution:
                                    </span>
                                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                      {correctAnswerDisplay}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : activeExam.questions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No questions have been added to this assessment by the instructor yet.
                  </div>
                ) : showReviewList || viewMode === 'all' ? (
                  /* ========================================================
                     ALL QUESTIONS / REVIEW MODE
                     ======================================================== */
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-[#CBD5E1] flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                      <span>
                        Review all {activeExam.questions.length} questions before submitting. Answered: <strong>{answeredCount}</strong> of {activeExam.questions.length}.
                      </span>
                    </div>

                    <div className="space-y-4">
                      {activeExam.questions.map((q, idx) => {
                        const isAnswered = Boolean(String(selectedAnswers[q.id] || '').trim());
                        return (
                          <div
                            key={q.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              isAnswered
                                ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800'
                                : 'bg-amber-500/5 dark:bg-amber-950/15 border-amber-500/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <p className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC]">
                                {idx + 1}. {q.question}
                              </p>
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                  isAnswered
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {isAnswered ? 'Answered' : 'Pending'}
                              </span>
                            </div>

                            <div className="space-y-2">{renderQuestionAnswerInput(q, true)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ========================================================
                     STEP-BY-STEP QUESTION-BY-QUESTION MODE (DEFAULT)
                     ======================================================== */
                  currentQuestion && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      {/* Active Question Card */}
                      <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                          <span className="font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase">
                            Question {currentQuestionIndex + 1} of {totalQuestionsCount}
                          </span>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                            {currentQuestion.points || 1} Point
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] leading-relaxed">
                          {currentQuestion.question}
                        </h3>

                        <div className="space-y-2.5 pt-1">{renderQuestionAnswerInput(currentQuestion, false)}</div>
                      </div>

                      {/* Stepper Bottom Controls */}
                      <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                          type="button"
                          disabled={currentQuestionIndex === 0}
                          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-[#CBD5E1] hover:bg-sky-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Previous</span>
                        </button>

                        <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                          {String(selectedAnswers[currentQuestion.id] || '').trim()
                            ? 'Answer recorded'
                            : String(currentQuestion.questionType || '').toUpperCase() === 'IDENTIFICATION'
                            ? 'Please type your answer'
                            : 'Please select an option'}
                        </span>

                        {currentQuestionIndex < totalQuestionsCount - 1 ? (
                          <button
                            type="button"
                            onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestionsCount - 1, prev + 1))}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                          >
                            <span>Next Question</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowReviewList(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            <span>Review All &amp; Submit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}

                {submitError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                    {submitError}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                {submissionResult ? (
                  <>
                    <button
                      onClick={closeExam}
                      className="px-4 py-2 rounded-xl text-slate-600 dark:text-[#CBD5E1] hover:bg-sky-500/10 text-xs font-semibold cursor-pointer"
                    >
                      Close
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/grades"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 text-sky-600 dark:text-sky-400 font-bold text-xs hover:bg-sky-500/10 transition-colors"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>View Recorded Grades</span>
                      </Link>
                      {!submissionResult.passed && (
                        <button
                          onClick={handleStartRetake}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reattempt Assessment</span>
                        </button>
                      )}
                      <Link
                        href={`/learning?courseId=${activeExam.courseId}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 text-sky-600 dark:text-sky-400 font-bold text-xs hover:bg-sky-500/10 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Continue to Learning</span>
                      </Link>
                      {submissionResult.isPostTest && submissionResult.passed && (
                        activeExam.requiresPractical === false || submissionResult.requiresPractical === false ? (
                          <Link
                            href="/certificates"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>View Certificate</span>
                          </Link>
                        ) : (
                          <Link
                            href="/schedules"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>View Training Schedule</span>
                          </Link>
                        )
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-slate-500">
                        {allAnswered ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>All {totalQuestionsCount} questions answered</span>
                          </span>
                        ) : (
                          <span>
                            Answered {answeredCount} / {totalQuestionsCount}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={closeExam}
                        disabled={submitting}
                        className="px-4 py-2 rounded-xl text-slate-600 dark:text-[#CBD5E1] hover:bg-sky-500/10 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>

                      {confirmOpen ? (
                        <button
                          onClick={handleSubmitExam}
                          disabled={submitting}
                          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer animate-pulse"
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>{submitting ? 'Submitting & Grading...' : 'Confirm — Submit Assessment'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmOpen(true)}
                          disabled={!allAnswered || submitting}
                          className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-all"
                        >
                          Submit for Evaluation
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
