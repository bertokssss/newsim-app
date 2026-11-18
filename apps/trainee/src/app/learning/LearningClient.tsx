'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Video,
  Radio,
  Check,
  AlertCircle,
  Layers,
  Sparkles,
  HelpCircle,
  GraduationCap,
  Calendar,
  Award,
  ArrowRight,
  CheckCircle,
  Lock,
  Unlock
} from 'lucide-react';
import Link from 'next/link';
import { DetailPageSkeleton } from '@newsim/ui';

export default function LearningClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLessonId = searchParams.get('lessonId') || '';
  const rawCourseId = searchParams.get('courseId') || '';

  const [lessons, setLessons] = useState<any[]>([]);
  const [activeLesson, setActiveLesson] = useState<any | null>(null);
  const [postTest, setPostTest] = useState<any | null>(null);
  const [isPracticalCompetent, setIsPracticalCompetent] = useState(false);
  const [practicalEvaluation, setPracticalEvaluation] = useState<any | null>(null);
  const [courseCategory, setCourseCategory] = useState<string>('Safety and Other STCW Courses');
  const [requiresPractical, setRequiresPractical] = useState<boolean>(true);
  const [practicalRubric, setPracticalRubric] = useState<any | null>(null);
  const [practicalSchedule, setPracticalSchedule] = useState<any | null>(null);
  const [modularDeadline, setModularDeadline] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completedSuccess, setCompletedSuccess] = useState(false);

  // Final Course Post-Test panel & After-Modules Practical Assessment panel
  const [postTestOpen, setPostTestOpen] = useState(false);
  const [practicalOpen, setPracticalOpen] = useState(false);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const endpoint =
        rawCourseId && rawCourseId !== 'crs-001'
          ? `/api/trainee/learning?courseId=${encodeURIComponent(rawCourseId)}`
          : '/api/trainee/learning';

      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLessons(json.data);
        setPostTest(json.postTest || null);
        if (json.isPracticalCompetent !== undefined) {
          setIsPracticalCompetent(Boolean(json.isPracticalCompetent));
        }
        setPracticalEvaluation(json.practicalEvaluation || null);
        if (json.courseCategory) {
          setCourseCategory(json.courseCategory);
        }
        if (json.requiresPractical !== undefined) {
          setRequiresPractical(Boolean(json.requiresPractical));
        }
        setPracticalRubric(json.practicalRubric || null);
        setPracticalSchedule(json.practicalSchedule || null);
        setModularDeadline(json.modularDeadline || null);
        setPracticalOpen(false);
        setPostTestOpen(false);
        if (initialLessonId) {
          const match = json.data.find((l: any) => l.id === initialLessonId);
          setActiveLesson(match || json.data[0]);
        } else {
          // Default to first incomplete unlocked lesson or first lesson
          const firstIncomplete = json.data.find((l: any) => !l.isCompleted && !l.isLocked);
          setActiveLesson(firstIncomplete || json.data.find((l: any) => !l.isLocked) || json.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load lessons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, [rawCourseId, initialLessonId]);


  const handleMarkComplete = async () => {
    if (!activeLesson) return;
    if (activeLesson.isRead) {
      const assessmentId = activeLesson.moduleAssessment?.id;
      const courseId = activeLesson.courseId || rawCourseId;
      if (assessmentId && !activeLesson.moduleAssessment?.isAttempted) {
        router.push(`/assessments?assessmentId=${assessmentId}&courseId=${courseId}`);
      }
      return;
    }
    try {
      setCompleting(true);
      const res = await fetch('/api/trainee/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeLesson.courseId || rawCourseId,
          lessonId: activeLesson.id,
          moduleId: activeLesson.moduleId,
          moduleName: activeLesson.moduleName,
          lessonTitle: activeLesson.title,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCompletedSuccess(true);
        const hasQuiz = Boolean(activeLesson.moduleAssessment);
        const isPassed = Boolean(activeLesson.moduleAssessment?.isPassed);
        const isCompleted = !hasQuiz || isPassed;

        const updated = { ...activeLesson, isRead: true, isCompleted };
        setActiveLesson(updated);
        setLessons((prev) =>
          prev.map((l) => (l.id === activeLesson.id ? { ...l, isRead: true, isCompleted } : l))
        );
        setTimeout(() => setCompletedSuccess(false), 3000);

        // When module is marked as read and its assessment unlocks, navigate to the Assessments Center (sidebar)
        const assessmentId = activeLesson.moduleAssessment?.id;
        const courseId = activeLesson.courseId || rawCourseId;
        const nowAllRead = lessons.every((l) => l.id === activeLesson.id || l.isRead);
        const targetId = assessmentId && !activeLesson.moduleAssessment?.isAttempted
          ? assessmentId
          : nowAllRead && postTest?.id && !postTest.isAttempted
          ? postTest.id
          : null;
        if (targetId) {
          setTimeout(() => {
            router.push(`/assessments?assessmentId=${targetId}&courseId=${courseId}`);
          }, 350);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCompleting(false);
    }
  };

  const currentIndex = lessons.findIndex((l) => l.id === activeLesson?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < lessons.length - 1;

  const handlePrev = () => {
    if (hasPrev) setActiveLesson(lessons[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) setActiveLesson(lessons[currentIndex + 1]);
  };

  // Progress metrics:
  // - In-House Courses (requiresPractical === false): 100% Full Modular-Based Course (modules + post-test if present).
  // - Safety and Other STCW Courses (requiresPractical === true): Modules (50%) + Post-Test (10%) + Course Practical After Modules (40%/50%).
  const completedCount = lessons.filter((l) => l.isCompleted).length;
  const failedCount = lessons.filter((l) => l.isFailed).length;
  const readCount = lessons.filter((l) => l.isRead).length;
  const totalCount = lessons.length;
  const allModulesRead = totalCount > 0 && lessons.every((l) => l.isRead);
  const allModulesCompleted = totalCount > 0 && completedCount >= totalCount;
  const hasPostTest = Boolean(postTest);
  const isPostTestPassed = Boolean(postTest?.isPassed);
  const isPracticalUnlocked = requiresPractical && ((allModulesCompleted && (!hasPostTest || isPostTestPassed)) || isPracticalCompetent);

  let overallProgress = 0;
  if (!requiresPractical) {
    if (allModulesCompleted && (!hasPostTest || isPostTestPassed)) {
      overallProgress = 100;
    } else {
      const modWeight = hasPostTest ? 85 : 100;
      const theoryProgressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * modWeight) : 0;
      const postTestBonus = hasPostTest && isPostTestPassed ? 15 : 0;
      overallProgress = Math.min(100, theoryProgressPercent + postTestBonus);
    }
  } else if (allModulesCompleted && isPracticalCompetent && (!hasPostTest || isPostTestPassed)) {
    overallProgress = 100;
  } else {
    const theoryProgressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 50) : 0;
    const postTestBonus = isPostTestPassed ? 10 : 0;
    const practicalBonus = isPracticalCompetent ? (hasPostTest ? 40 : 50) : 0;
    overallProgress = Math.min(100, theoryProgressPercent + postTestBonus + practicalBonus);
  }

  if (loading && lessons.length === 0) {
    return <DetailPageSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Course Delivery Mode & Progression Banner */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
        !requiresPractical
          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60'
          : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            !requiresPractical
              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
              : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
          }`}>
            {!requiresPractical ? <BookOpen className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
          </div>
          <div>
            <span className={`font-bold block text-xs font-heading ${
              !requiresPractical ? 'text-indigo-900 dark:text-indigo-200' : 'text-sky-900 dark:text-sky-200'
            }`}>
              {!requiresPractical
                ? 'Category A: MODULAR / IN-HOUSE • 3-Day Modular Completion Window (Academic Record Review)'
                : `Category B: MODULAR + PRACTICAL • 3-Day Modular Window, Then Practical in ${activeLesson?.courseCode || 'Enrolled Course'}`}
            </span>
            <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5">
              {!requiresPractical
                ? 'Complete lessons & assessments within 3 days (can finish in 1, 2, or 3 days). No practical schedule or physical attendance required — an assigned instructor reviews and validates your academic record.'
                : `Complete modular lessons & assessments within 3 days (can finish in 1, 2, or 3 days). After modular completion, status transitions to WAITING_FOR_INSTRUCTOR for your scheduled Practical Training in ${activeLesson?.courseCode || 'this course'}.`}
            </p>
            {modularDeadline && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  Workflow: {modularDeadline.workflowStatus}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                  {modularDeadline.isCompleted
                    ? '✓ Modular Requirements Completed (Countdown Stopped)'
                    : `3-Day Modular Deadline: ${modularDeadline.formattedDeadline} (${modularDeadline.remainingHours}h remaining)`}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {requiresPractical ? (
            <button
              type="button"
              onClick={() => {
                setPracticalOpen(true);
                setPostTestOpen(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
            >
              {isPracticalUnlocked ? `Open ${activeLesson?.courseCode || 'Course'} Practical →` : `Preview ${activeLesson?.courseCode || 'Course'} Practical →`}
            </button>
          ) : (
            <Link
              href="/assessments"
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors"
            >
              Modular Assessments →
            </Link>
          )}
        </div>
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              {courseCategory}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
              !requiresPractical
                ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
            }`}>
              {!requiresPractical ? 'Full Modular-Based' : `Modular + Practical (${activeLesson?.courseCode || 'STCW'})`}
            </span>
            <span className="text-xs font-mono text-slate-500">
              {activeLesson?.courseCode || 'BT'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            {activeLesson?.courseTitle || 'STCW Maritime Training Program'}
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={!hasPrev}
            className="p-2.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Previous lesson"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={handleMarkComplete}
            disabled={activeLesson?.isCompleted || completing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs shadow-md transition-all ${
              activeLesson?.isCompleted
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-default'
                : activeLesson?.isRead
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 cursor-pointer'
                : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/20 cursor-pointer'
            }`}
          >
            {activeLesson?.isCompleted ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Module Completed ✓</span>
              </>
            ) : activeLesson?.isRead ? (
              <>
                <Unlock className="w-4 h-4 text-amber-500" />
                <span>Read • Open Assessment →</span>
              </>
            ) : completing ? (
              <span>Unlocking Assessment...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Mark as Read &amp; Open Assessment</span>
              </>
            )}
          </button>

          <button
            onClick={handleNext}
            disabled={!hasNext}
            className="p-2.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Next lesson"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Lesson Navigation List (1 Column) */}
        <div className="lg:col-span-1 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 space-y-4 overflow-hidden relative">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-500" />
              <span className="font-extrabold text-xs text-slate-900 dark:text-[#F8FAFC] font-heading">
                Course Syllabus
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {completedCount}/{totalCount} Modules Done
            </span>
          </div>

          {/* Syllabus Completion Bar (Caps at 60% max until practical session, 100% when practical competent) */}
          <div className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>Progress</span>
              <span className={`font-bold ${overallProgress >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'}`}>
                {overallProgress}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-50 dark:bg-slate-900/60 overflow-hidden border border-slate-200/80 dark:border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  overallProgress >= 100 ? 'bg-emerald-500' : 'bg-sky-500'
                }`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-[10px] font-mono text-slate-400 leading-tight">
              {!requiresPractical
                ? (overallProgress >= 100
                    ? 'Full Modular Course 100% Completed! Qualified for certificate release.'
                    : 'In-House Full Modular Course: Complete all modules & written assessments to reach 100% (no practical required).')
                : overallProgress >= 100
                ? 'Modules & Course Practical 100% Completed! Qualified for certificate release.'
                : isPracticalCompetent
                ? 'Course Practical marked COMPETENT (+40%). Complete all modular lessons to reach 100%.'
                : isPracticalUnlocked
                ? `All modules completed! Proceed to the ${activeLesson?.courseCode || 'Course'} Practical Assessment below.`
                : 'Complete all modular lessons first; after the modules is the Practical Assessment for this course.'}
            </p>
          </div>

          {/* Module List */}
          <div className="space-y-1 max-h-[55vh] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-xs font-mono text-slate-400">
                Loading syllabus...
              </div>
            ) : (
              lessons.map((lesson, idx) => {
                const isActive = lesson.id === activeLesson?.id;

                return (
                  <button
                    key={lesson.id}
                    onClick={() => {
                      if (lesson.isLocked) {
                        alert(lesson.lockReason || 'This module is locked. Modules unlock 1 per day.');
                        return;
                      }
                      setActiveLesson(lesson);
                      setPostTestOpen(false);
                      setPracticalOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-start gap-2.5 cursor-pointer ${
                      lesson.isFailed
                        ? 'border border-rose-300 dark:border-rose-900/60 bg-rose-500/5 text-rose-700 dark:text-rose-300'
                        : lesson.isDueToday
                        ? 'border border-amber-300 dark:border-amber-900/60 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                        : lesson.isLocked
                        ? 'opacity-60 hover:bg-slate-100/50 dark:hover:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        : isActive && !postTestOpen && !practicalOpen
                        ? 'bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent border-l-4 border-[#0B3D91] text-sky-600 dark:text-sky-400 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-[#CBD5E1]'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {lesson.isFailed ? (
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      ) : lesson.isLocked ? (
                        <Lock className="w-4 h-4 text-slate-400" />
                      ) : lesson.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : lesson.isDueToday ? (
                        <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                      ) : lesson.isRead ? (
                        <Unlock className="w-4 h-4 text-amber-500" />
                      ) : isActive ? (
                        <PlayCircle className="w-4 h-4 text-sky-500 animate-pulse" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-800" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-sans truncate line-clamp-1">
                        Day {lesson.dayNumber || idx + 1}. {lesson.title}
                      </p>
                      <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                        {lesson.isCompleted
                          ? '✓ Completed'
                          : lesson.isRead
                          ? 'Assessment Ready'
                          : lesson.isFailed
                          ? `Assessment Not Passed (${lesson.moduleAssessment?.score ?? 0}%)`
                          : lesson.isLocked
                          ? `🔒 Locked (Complete previous module)`
                          : lesson.isDueToday
                          ? 'Unlocked • Ready to Start'
                          : 'Theory Guide'} • {lesson.readingMinutes || 45} mins
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Final Course Post-Test Button in Syllabus Sidebar */}
          {postTest && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  if (allModulesRead) {
                    router.push(`/assessments?assessmentId=${postTest.id}&courseId=${activeLesson?.courseId || rawCourseId}`);
                  } else {
                    setPostTestOpen(true);
                  }
                }}
                className={`w-full text-left p-3 rounded-2xl transition-all flex items-start gap-2.5 border cursor-pointer ${
                  postTestOpen
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold'
                    : postTest.isPassed
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : postTest.isAttempted
                    ? 'border-indigo-500/30 bg-indigo-500/5 text-indigo-700 dark:text-indigo-300'
                    : allModulesRead
                    ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 animate-pulse'
                    : 'border-slate-200 dark:border-slate-800 opacity-70'
                }`}
              >
                {allModulesRead ? (
                  <GraduationCap className={`w-4 h-4 mt-0.5 shrink-0 ${postTest.isPassed ? 'text-emerald-500' : 'text-indigo-600'}`} />
                ) : (
                  <Lock className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold font-heading truncate flex items-center gap-1.5">
                    <span>Course Post-Test</span>
                    {postTest.isPassed ? (
                      <span className="text-[10px] text-emerald-600 font-mono">✓ Passed</span>
                    ) : postTest.isAttempted ? (
                      <span className="text-[10px] text-indigo-600 font-mono">Attempted</span>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                    {postTest.isPassed
                      ? (!requiresPractical ? 'Full Modular Completed ✓' : 'Unlocked: Proceed to Course Practical')
                      : postTest.isAttempted
                      ? `Attempt recorded (${postTest.score ?? 0}%)`
                      : allModulesRead
                      ? 'Unlocked — 1 Attempt Only'
                      : `Locked • Complete all daily modules`}
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Delivery Mode Milestone: After-Modules Practical (STCW) vs Full Modular Completion (In-House) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            {requiresPractical ? (
              <button
                type="button"
                onClick={() => {
                  setPracticalOpen(true);
                  setPostTestOpen(false);
                }}
                className={`w-full text-left p-3 rounded-2xl transition-all flex items-start gap-2.5 border cursor-pointer ${
                  practicalOpen
                    ? 'border-sky-500 bg-sky-500/15 text-sky-900 dark:text-sky-200 font-bold'
                    : isPracticalCompetent
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : isPracticalUnlocked
                    ? 'border-sky-500/50 bg-sky-500/10 hover:bg-sky-500/15 text-sky-900 dark:text-sky-200'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400'
                }`}
              >
                {isPracticalCompetent ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                ) : isPracticalUnlocked ? (
                  <Award className="w-4 h-4 mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
                ) : (
                  <Lock className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold font-heading flex items-center justify-between gap-1">
                    <span className="truncate">Practical: {activeLesson?.courseCode || 'STCW'}</span>
                    <span className={`text-[10px] font-mono font-bold shrink-0 ${
                      isPracticalCompetent
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isPracticalUnlocked
                        ? 'text-sky-600 dark:text-sky-400'
                        : 'text-slate-400'
                    }`}>
                      {isPracticalCompetent ? '✓ Competent' : isPracticalUnlocked ? 'Unlocked' : 'After Modules'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block mt-0.5 leading-snug">
                    {isPracticalCompetent
                      ? `Certified Competent (${practicalEvaluation?.percentage ?? 100}%) in ${activeLesson?.courseCode || 'course'}`
                      : isPracticalUnlocked
                      ? `All modules done! Click for ${activeLesson?.courseCode || 'course'} Practical Assessment`
                      : `Locked • Unlocks after ${totalCount} modular lesson${totalCount === 1 ? '' : 's'}`}
                  </span>
                </div>
              </button>
            ) : (
              <div className="w-full text-left p-3 rounded-2xl flex items-start gap-2.5 border border-indigo-500/30 bg-indigo-500/5 text-indigo-900 dark:text-indigo-200">
                <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${overallProgress >= 100 ? 'text-emerald-500' : 'text-indigo-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold font-heading flex items-center justify-between">
                    <span>Full Modular Course</span>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      100% Modular
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block mt-0.5 leading-snug">
                    In-House Course: No practical simulator required after modules.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Footer Curriculum Status */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-mono">Curriculum Syllabus</span>
            <span className="font-medium text-sky-600 dark:text-sky-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              <span>{!requiresPractical ? 'Full Modular' : 'STCW + Practical'}</span>
            </span>
          </div>
        </div>

        {/* Right Area: Active Lesson Learning View OR Practical View OR Post-Test View (3 Columns) */}
        <div className="lg:col-span-3 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6 relative overflow-hidden">
          {loading ? (
            <div className="py-24 text-center text-xs font-mono text-slate-400">
              Loading course curriculum...
            </div>
          ) : !activeLesson ? (
            <div className="py-24 text-center text-sm font-sans text-slate-500">
              <div className="mb-4 text-sky-600 dark:text-sky-400 font-bold text-lg">Waiting for Instructor</div>
              Your assigned batch is currently waiting for an instructor to be officially assigned by the administrator.<br />
              Please check back later. Training modules and assessments will unlock automatically once an instructor is assigned.
            </div>
          ) : practicalOpen && requiresPractical ? (
            /* ================= COURSE-SPECIFIC PRACTICAL ASSESSMENT VIEW (AFTER MODULES) ================= */
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className={`rounded-3xl border p-6 sm:p-8 space-y-4 ${
                isPracticalCompetent
                  ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20'
                  : isPracticalUnlocked
                  ? 'border-sky-500/30 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 dark:bg-[#0c1a2c]'
                  : 'border-dashed border-amber-500/40 bg-amber-500/5 dark:bg-[#0c1a2c]'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                      isPracticalCompetent
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        : isPracticalUnlocked
                        ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                        : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}>
                      {isPracticalCompetent
                        ? 'Practical Competency Certified ✓'
                        : isPracticalUnlocked
                        ? 'Unlocked • Ready for Course Practical'
                        : 'Step 2 (Locked Until Modules Complete)'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {practicalRubric?.stcwReference || `STCW ${activeLesson?.courseCode || 'Practical'}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPracticalOpen(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    ← Back to Modules
                  </button>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {practicalRubric?.title || `${activeLesson?.courseCode || 'STCW'} — ${activeLesson?.courseTitle || 'Course'} Practical Assessment`}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    {practicalRubric?.description || `Course-specific practical competency evaluation for ${activeLesson?.courseTitle || 'this STCW course'}, conducted after completing all modular lessons.`}
                  </p>
                </div>

                {!isPracticalUnlocked ? (
                  <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-amber-500" />
                        <span>Complete All Modular Lessons First</span>
                      </span>
                      <span className="font-mono">{completedCount}/{totalCount} Modules Completed</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      In <strong>Safety and Other STCW Courses</strong>, you first complete the modular lessons{hasPostTest ? ' and course post-test' : ''}. Once all modules are completed, this Practical Assessment for <strong>{activeLesson?.courseTitle} ({activeLesson?.courseCode})</strong> unlocks automatically.
                    </p>
                  </div>
                ) : isPracticalCompetent ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        Practical Evaluation Score: {practicalEvaluation?.percentage ?? 100}% • Status: COMPETENT
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {practicalEvaluation?.general_feedback || 'You have successfully demonstrated all required STCW practical competencies for this course.'}
                      </p>
                    </div>
                    <Link
                      href="/grades"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0"
                    >
                      View Official Grade →
                    </Link>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-sky-900 dark:text-sky-200">
                        Modular Phase Complete! Ready for {activeLesson?.courseCode} Practical Evaluation
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {practicalSchedule
                          ? `Scheduled Venue: ${practicalSchedule.room || 'NEWSIM Talisay Training Center Simulator Bay'} • Status: ${practicalSchedule.status || 'SCHEDULED'}`
                          : 'Report to your assigned instructor at NEWSIM Talisay Training Center for your hands-on practical evaluation using the course rubric below.'}
                      </p>
                    </div>
                    <Link
                      href="/schedules"
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shrink-0"
                    >
                      View Practical Schedule →
                    </Link>
                  </div>
                )}
              </div>

              {/* Course-Specific Practical Rubric Criteria List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {activeLesson?.courseCode || 'STCW'} Practical Competency Criteria (Passing Benchmark: {practicalRubric?.passingScore ?? 75}%)
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    {practicalRubric?.criteria?.length || 4} Mandatory Criteria • 100 Pts Total
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(practicalRubric?.criteria || []).map((crit: any, cIdx: number) => (
                    <div
                      key={crit.id || cIdx}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white font-heading">
                          {cIdx + 1}. {crit.title}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 shrink-0">
                          {crit.maxPoints} pts ({crit.weightPct}%)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {crit.description}
                      </p>
                      {crit.isCritical && (
                        <span className="inline-block text-[10px] font-mono font-semibold text-rose-600 dark:text-rose-400">
                          • Critical STCW Safety Competency
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : postTestOpen && postTest ? (
            /* ================= FINAL COURSE POST-TEST VIEW ================= */
            !allModulesRead ? (
              /* Locked State: Trainee attempted to view post-test before all modules are read */
              <div className="rounded-3xl border-2 border-dashed border-indigo-500/30 bg-indigo-500/5 dark:bg-[#0c1a2c] p-8 sm:p-12 text-center space-y-5 animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center border border-indigo-500/30">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                    Course Post-Test Locked
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    Read All Modules First
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    The final course post-test is accessible only after you have marked all modules as read. Currently, you have completed reading <strong>{readCount} of {totalCount}</strong> modules.
                  </p>
                </div>

                <div className="max-w-xs mx-auto">
                  <div className="flex justify-between text-[11px] font-mono text-slate-500 mb-1">
                    <span>Reading Progress</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{readCount}/{totalCount} Modules</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-750 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${totalCount > 0 ? (readCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      const firstUnread = lessons.find((l) => !l.isRead) || lessons[0];
                      if (firstUnread) setActiveLesson(firstUnread);
                      setPostTestOpen(false);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Continue Reading Modules</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* ===== Post-Test Ready: answered in the Assessments Center, not in the Learning Player ===== */
              <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-sky-500/5 dark:bg-[#0c1a2c] p-8 sm:p-12 text-center space-y-5 animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center border border-indigo-500/30">
                  {postTest.isAttempted ? <CheckCircle2 className="w-8 h-8 text-emerald-500" /> : <GraduationCap className="w-8 h-8" />}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap justify-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                      {postTest.isAttempted ? 'Post-Test Submitted' : 'Course Post-Test Unlocked'}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      1 Attempt Only
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {postTest.title}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    {postTest.isAttempted
                      ? `Your single attempt was recorded (${postTest.score ?? 0}%). Your attendance has been logged to your instructor's practical training roster.`
                      : 'All modules are read. The Course Post-Test is answered in the Assessments Center. Submitting it records your attendance in your instructor\u2019s practical training roster.'}
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  <Link
                    href={`/assessments?assessmentId=${postTest.id}&courseId=${activeLesson?.courseId || rawCourseId}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all"
                  >
                    <Award className="w-4 h-4" />
                    <span>{postTest.isAttempted ? 'View Result in Assessments' : 'Take Post-Test in Assessments Center'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  {postTest.isAttempted && (
                    <Link
                      href="/schedules"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-sky-600 dark:text-sky-400 font-bold text-xs transition-all"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Practical Training Schedule</span>
                    </Link>
                  )}
                  <button
                    onClick={() => setPostTestOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    Back to Modules
                  </button>
                </div>
              </div>
            )
          ) : activeLesson?.isLocked ? (
            /* ================= LOCKED MODULE PREREQUISITE VIEW ================= */
            <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 dark:bg-[#0c1a2c] p-8 sm:p-12 text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  Module Prerequisite Locked
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                  {activeLesson.title}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  {activeLesson.lockReason || 'This module is locked. You must complete and pass the assessment for the previous module (minimum 70%) before unlocking.'}
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => {
                    const firstUnlocked = lessons.find((l) => !l.isLocked) || lessons[0];
                    if (firstUnlocked) setActiveLesson(firstUnlocked);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Go to Current Unlocked Module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* ================= ACTIVE MODULE LEARNING VIEW ================= */
            <div className="space-y-6">
              {/* Lesson Title Header */}
              <div className="space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                    {activeLesson.moduleName}
                  </span>
                  <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-500" />
                    Est. Reading: {activeLesson.readingMinutes} mins
                  </span>
                  {activeLesson.isCompleted && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600">
                      ✓ Module Completed
                    </span>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                  {activeLesson.title}
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#CBD5E1] font-sans leading-relaxed">
                  {activeLesson.description}
                </p>
              </div>

              {/* Video Player (if available) */}
              {activeLesson.videoUrl && (
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 text-white aspect-video flex flex-col items-center justify-center p-6 border border-white/10 shadow-xl group">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
                  <div className="relative z-10 text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-sky-500 text-white flex items-center justify-center mx-auto shadow-xl group-hover:scale-110 transition-transform cursor-pointer">
                      <PlayCircle className="w-8 h-8 fill-white/20" />
                    </div>
                    <div>
                      <div className="font-bold text-sm font-heading">{activeLesson.title}</div>
                      <div className="text-xs text-slate-300 font-mono">Maritime Training Video Stream • 1080p HD</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Module Reading Content */}
              <div className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 text-sm leading-relaxed space-y-4">
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 font-sans whitespace-pre-wrap leading-relaxed">
                  {activeLesson.contentBody || activeLesson.content || activeLesson.description || 'Comprehensive training module overview and STCW guidelines.'}
                </div>
              </div>

              {/* Supplemental Materials Download Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-[#F8FAFC]">
                      {activeLesson.title || 'Official STCW Reference Material'}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-[#CBD5E1] font-mono">
                      {activeLesson.fileUrl ? 'Course Syllabus Document File' : 'Official Maritime Study Guide • PDF Document'}
                    </div>
                  </div>
                </div>
                {activeLesson.fileUrl ? (
                  <a
                    href={activeLesson.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-900 dark:text-[#F8FAFC] border border-slate-200/80 dark:border-slate-800 font-mono text-xs font-bold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-500" />
                    <span>Download Material</span>
                  </a>
                ) : (
                  <button
                    onClick={() => alert('Official maritime reference material downloaded.')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-900 dark:text-[#F8FAFC] border border-slate-200/80 dark:border-slate-800 font-mono text-xs font-bold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-500" />
                    <span>Download PDF</span>
                  </button>
                )}
              </div>

              {/* Mark as Read CTA banner if module reading is not yet completed */}
              {!activeLesson.isRead && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-sky-600 dark:text-sky-400 font-heading">
                      <BookOpen className="w-4 h-4 text-sky-500" />
                      <span>Finished reviewing {activeLesson.title}?</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans">
                      Mark this module as read to unlock its connected competency pre-test below.
                    </p>
                  </div>
                  <button
                    onClick={handleMarkComplete}
                    disabled={completing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all shrink-0 cursor-pointer"
                  >
                    {completing ? (
                      <span>Unlocking Assessment...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Mark as Read &amp; Open Assessment</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ================= MODULE PRE-TEST / ASSESSMENT SECTION ================= */}
              {activeLesson.moduleAssessment && (
                <div id="module-assessment-section" className="space-y-4">
                  {!activeLesson.isRead ? (
                    /* Locked Assessment State: Specifically prompts trainee to finish reading first */
                    <div className="rounded-3xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 dark:bg-[#0c1a2c] p-8 text-center space-y-4 shadow-xs">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30">
                        <Lock className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          Assessment Locked
                        </span>
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                          {activeLesson.moduleAssessment.title || 'Module Competency Pre-Test'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                          This assessment will specifically open once you mark <strong>{activeLesson.title}</strong> as read.
                        </p>
                      </div>
                      <div>
                        <button
                          onClick={handleMarkComplete}
                          disabled={completing}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/25 transition-all cursor-pointer"
                        >
                          {completing ? (
                            <span>Unlocking...</span>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Mark as Read &amp; Unlock Assessment</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Unlocked Assessment State -> Navigates to Assessments page in sidebar */
                    <div className="rounded-3xl border border-amber-500/30 bg-white dark:bg-[#0c1a2c] p-6 space-y-5 shadow-xs">
                      {/* Unlocked Announcement Banner */}
                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="font-bold">
                            Module read! Assessment for {activeLesson.moduleName} is ready in the Assessments Center.
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300 shrink-0">
                          UNLOCKED
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold">
                            <HelpCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                              {activeLesson.moduleAssessment.title || 'Module Competency Pre-Test'}
                            </h3>
                            <p className="text-[11px] font-mono text-slate-500">
                              Total Questions: {activeLesson.moduleAssessment.questionsCount || activeLesson.moduleAssessment.questions?.length || 10} • Passing Score: {activeLesson.moduleAssessment.passingScore || 75}% • 1 Attempt Allowed
                            </p>
                          </div>
                        </div>

                        {activeLesson.moduleAssessment.isAttempted ? (
                          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 flex items-center gap-1 self-start sm:self-auto">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>
                              Score: {activeLesson.moduleAssessment.scoreDisplay || `${Math.round(((activeLesson.moduleAssessment.score ?? 0) * (activeLesson.moduleAssessment.questionsCount || 10)) / 100)}/${activeLesson.moduleAssessment.questionsCount || 10} (${activeLesson.moduleAssessment.score ?? 0}%)`}
                            </span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 self-start sm:self-auto">
                            1 Attempt Available
                          </span>
                        )}
                      </div>

                      {/* Direction Notice */}
                      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-slate-900/60 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 text-xs">
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-1.5 font-heading">
                            <Award className="w-4 h-4 text-amber-600" />
                            <span>Trainee Assessment Center</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 font-sans max-w-md">
                            {activeLesson.moduleAssessment.isAttempted
                              ? `Your single attempt has been recorded with a score of ${activeLesson.moduleAssessment.score ?? 0}%. You can review the evaluation on the Assessments page.`
                              : 'Under STCW training evaluation procedures, competency tests are taken on the official Assessments page (located in the left sidebar).'}
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            router.push(`/assessments?assessmentId=${activeLesson.moduleAssessment.id}&courseId=${activeLesson.courseId || rawCourseId}`);
                          }}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-600 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs shadow-md shadow-amber-600/25 transition-all cursor-pointer shrink-0"
                        >
                          <span>{activeLesson.moduleAssessment.isAttempted ? 'View in Assessments Page' : 'Go to Assessments Page to Answer'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= ALL MODULES READ -> POST-TEST BANNER ================= */}
              {allModulesRead && postTest ? (
                <div className={`p-5 rounded-3xl border shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  postTest.isPassed
                    ? 'border-emerald-500/40 bg-white dark:bg-[#0c1a2c]'
                    : 'border-indigo-500/40 bg-white dark:bg-[#0c1a2c]'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                        {postTest.isPassed ? 'Theory Stage Completed' : 'All Modules Read — Post-Test Unlocked'}
                      </span>
                      <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                        Course Theory Progress: {overallProgress}%
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                      {postTest.isPassed
                        ? 'Course Post-Test Passed ✓'
                        : postTest.isAttempted
                        ? 'Post-Test Attempt Logged'
                        : 'Final Step: Take Course Post-Test'}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-sans">
                      {postTest.isPassed
                        ? 'All theory requirements satisfied! Your attendance is recorded in the instructor roster. Proceed to your scheduled practical training session.'
                        : postTest.isAttempted
                        ? 'Your post-test attempt and attendance record have been logged for your instructor.'
                        : 'All course modules are read! You can now take the comprehensive 1-attempt course post-test to qualify for practical training.'}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {postTest.isPassed ? (
                      <Link
                        href="/schedules"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>View Training Schedule</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <button
                        onClick={() => router.push(`/assessments?assessmentId=${postTest.id}&courseId=${activeLesson?.courseId || rawCourseId}`)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                      >
                        <GraduationCap className="w-4 h-4" />
                        <span>{postTest.isAttempted ? 'View in Assessments' : 'Take Course Post-Test in Assessments'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : postTest && (
                <div className="p-4 rounded-2xl border border-dashed border-indigo-500/30 bg-indigo-500/5 dark:bg-sky-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-indigo-300 font-medium">
                    <Lock className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Course Post-Test unlocks specifically once all modules are marked as read ({readCount}/{totalCount} read).</span>
                  </div>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 self-end sm:self-auto shrink-0">
                    {Math.round((readCount / (totalCount || 1)) * 100)}% Modules Read
                  </span>
                </div>
              )}

              {/* Bottom Navigation */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Lesson</span>
                </button>

                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="flex items-center gap-1 text-xs font-bold text-sky-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <span>Next Lesson</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
