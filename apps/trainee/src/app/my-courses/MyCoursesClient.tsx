'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookOpen,
  PlayCircle,
  Clock,
  UserCheck,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Building2,
  Calendar,
  X,
  FileText,
  Search,
  Filter
} from 'lucide-react';
import { CardGridSkeleton, UserAvatar, ResponsiveModal } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function MyCoursesClient() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/trainee/my-courses?search=${encodeURIComponent(search)}&status=${statusFilter}`);
      const json = await res.json();
      if (json.success) {
        setCourses(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [search, statusFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              Curriculum Repository
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            My Enrolled Courses
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] font-sans mt-0.5">
            Access your active IMO/STCW certified maritime programs and lesson modules.
          </p>
        </div>

        <Link
          href="/enrollment"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all self-start sm:self-auto"
        >
          <BookOpen className="w-4 h-4" />
          <span>Apply for New Course</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-sky-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, title, category..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-slate-200/80 dark:border-slate-800 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            {['ALL', 'ENROLLED', 'COMPLETED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
                  statusFilter === st
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/20'
                    : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All Courses' : st === 'ENROLLED' ? 'In Progress' : 'Completed'}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {[
            { id: 'ALL', label: 'All Categories' },
            { id: 'Safety and Other STCW Courses', label: 'Safety and Other STCW Courses (Modular + Practical)' },
            { id: 'In-House Courses', label: 'In-House Courses (Full Modular-Based)' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                categoryFilter === cat.id
                  ? 'bg-slate-900 text-white dark:bg-sky-600'
                  : 'bg-slate-100 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Course Cards Grid */}
      {loading ? (
        <CardGridSkeleton numCards={6} showHeader={false} />
      ) : courses.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
          <BookOpen className="w-8 h-8 text-sky-500 mx-auto" />
          <p className="text-sm font-bold text-slate-800 dark:text-[#CBD5E1]">No courses match your filter.</p>
          <p className="text-xs text-slate-500 font-mono">Check available programs in the Enrollment catalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses
            .filter((course) => {
              if (categoryFilter === 'ALL') return true;
              const isInHouse = course.requiresPractical === false || String(course.category || '').toLowerCase().includes('in-house');
              return categoryFilter === 'In-House Courses' ? isInHouse : !isInHouse;
            })
            .map((course, idx) => {
            const progressVal = Math.min(100, Math.max(0, Number(course.progressPercent ?? course.progress ?? 0)));
            const isCompleted = course.enrollmentStatus === 'COMPLETED' || progressVal >= 100;
            const isInHouse = course.requiresPractical === false || String(course.category || '').toLowerCase().includes('in-house');

            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: easeCurve, delay: idx * 0.05 }}
                className="relative rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between overflow-hidden group hover:border-sky-500/40 transition-all"
              >
                <div className="p-6 space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                        {course.code}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        isInHouse
                          ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                      }`}>
                        {isInHouse ? 'Full Modular-Based' : 'Modular + Practical'}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        isCompleted
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      {isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
                    </span>
                  </div>

                  {/* Category label */}
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {course.category || (isInHouse ? 'In-House Courses' : 'Safety and Other STCW Courses')}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] group-hover:text-sky-500 transition-colors font-heading">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-[#CBD5E1] line-clamp-2 mt-1.5 font-sans">
                      {course.description}
                    </p>
                  </div>

                  {/* Metadata Tags */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-[#CBD5E1]">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span>
                        {isInHouse
                          ? `${course.durationHours || 40}h (${course.trainingDays || 1} Days • 100% Modular Lessons)`
                          : `${course.durationHours || 40}h (${course.trainingDays || 1} Days: ${course.theoryDays || 1}d Modular + ${course.practicalDays || 0}d Practical)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        src={course.instructorAvatarUrl}
                        name={course.instructorName}
                        alt={course.instructorName || 'Instructor'}
                        className="w-5 h-5 rounded-md"
                        fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[9px] font-bold"
                      />
                      <span>Instructor: {course.instructorName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span>{course.centerName}</span>
                    </div>
                  </div>

                  {/* Merged Schedule Completion Bar (Theory + Practical) */}
                  <div className="space-y-1.5 font-mono text-xs pt-1">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-xs text-slate-600 dark:text-slate-300">
                        Progress
                      </span>
                      <span className="font-extrabold text-sky-600 dark:text-sky-400">
                        {progressVal}%
                      </span>
                    </div>

                    {/* Merged Single Progress Bar */}
                    <div className="w-full h-2.5 rounded-full bg-slate-50 dark:bg-slate-900/60 overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-inner">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${progressVal}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedCourse(course)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white hover:bg-sky-500/10 transition-colors"
                  >
                    View Syllabus
                  </button>

                  <Link
                    href={`/learning?courseId=${course.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    <span>{isCompleted ? 'Review Content' : 'Study Modules'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Course Syllabus Modal */}
      <ResponsiveModal
        isOpen={Boolean(selectedCourse)}
        onClose={() => setSelectedCourse(null)}
        maxWidthClassName="max-w-2xl"
        topAccentClassName="h-1 bg-sky-500"
      >
        {selectedCourse && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="p-4 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold border border-sky-500/20">
                    {selectedCourse.code}
                  </span>
                  <span className="text-xs font-mono text-slate-500">{selectedCourse.category}</span>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-1">
                  {selectedCourse.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-sky-500/10 cursor-pointer shrink-0"
                aria-label="Close syllabus"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-6 text-xs">
                {/* Description */}
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-[#F8FAFC] font-heading uppercase text-[11px] mb-1">
                    Course Overview
                  </h4>
                  <p className="text-slate-600 dark:text-[#CBD5E1] leading-relaxed">
                    {selectedCourse.description}
                  </p>
                </div>

                {/* Prerequisites */}
                {selectedCourse.prerequisites?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-[#F8FAFC] font-heading uppercase text-[11px] mb-2">
                      Mandatory STCW Prerequisites
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCourse.prerequisites.map((p: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-900/60 font-mono text-slate-800 dark:text-[#CBD5E1] border border-slate-200/80 dark:border-slate-800">
                          ✓ {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dynamic Course Completion Telemetry */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-xs text-slate-600 dark:text-slate-300">Progress</span>
                    <span className="font-extrabold text-sky-600 dark:text-sky-400">
                      {Math.min(100, Math.max(0, Number(selectedCourse.progressPercent ?? selectedCourse.progress ?? 0)))}%
                    </span>
                  </div>

                  {/* Merged Single Progress Bar */}
                  <div className="w-full h-3 rounded-full bg-white dark:bg-slate-900/60 overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-inner">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.min(100, Math.max(0, Number(selectedCourse.progressPercent ?? selectedCourse.progress ?? 0)))}%` }}
                    />
                  </div>

                  {/* Schedule Component Breakdown */}
                  {selectedCourse.requiresPractical === false || String(selectedCourse.category || '').toLowerCase().includes('in-house') ? (
                    <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-[11px] font-mono space-y-1">
                      <div className="font-bold text-indigo-600 dark:text-indigo-400">
                        In-House Full Modular-Based Course ({selectedCourse.trainingDays || 1} Days)
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">
                        Modular Lessons Completed: {selectedCourse.modulesCompleted || 0}/{selectedCourse.totalModules || 4} ({selectedCourse.theoryPercent ?? 0}%) • No practical simulator phase required.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
                      <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-blue-500/20 space-y-0.5">
                        <div className="font-bold text-sky-600 dark:text-sky-400">Step 1: Modular Lessons ({selectedCourse.theoryDays || 1} Days)</div>
                        <div className="text-slate-500">Modules: {selectedCourse.modulesCompleted || 0}/{selectedCourse.totalModules || 4}</div>
                        <div className="text-blue-600 dark:text-blue-400 font-bold">{selectedCourse.theoryPercent ?? 0}% Complete</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-emerald-500/20 space-y-0.5">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400">Step 2: {selectedCourse.code} Practical ({selectedCourse.practicalDays || 0} Days)</div>
                        <div className="text-slate-500">After Modules • {selectedCourse.practicalCompetent ? 'Certified Competent' : 'Unlocks After Modules'}</div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedCourse.practicalPercent ?? 0}% Complete</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modules breakdown */}
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-[#F8FAFC] font-heading uppercase text-[11px] mb-2">
                    Curriculum Structure
                  </h4>
                  <div className="space-y-2">
                    {Array.isArray(selectedCourse.modules) && selectedCourse.modules.length > 0 ? (
                      selectedCourse.modules.map((mod: any, idx: number) => (
                        <div
                          key={mod.id || idx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex justify-between items-center gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
                              {mod.title || `Module ${idx + 1}`}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Module {idx + 1} of {selectedCourse.modules.length}
                            </div>
                          </div>
                          {mod.isCompleted ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold shrink-0">
                              Completed
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400 font-mono shrink-0">
                              Pending
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500">
                        Curriculum modules will appear here once published by your instructor.
                      </div>
                    )}
                    {!(selectedCourse.requiresPractical === false || String(selectedCourse.category || '').toLowerCase().includes('in-house')) && (
                      <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex justify-between items-center gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-sky-900 dark:text-sky-200 truncate">
                            After Modules: Practical Assessment in {selectedCourse.title} ({selectedCourse.code})
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Course-Specific STCW Practical Evaluation (Unlocks upon completing all modules)
                          </div>
                        </div>
                        <span className={`font-mono font-bold shrink-0 ${
                          selectedCourse.practicalCompetent
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-sky-600 dark:text-sky-400'
                        }`}>
                          {selectedCourse.practicalCompetent ? 'Competent ✓' : 'After Modules'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedCourse(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-[#CBD5E1] hover:bg-sky-500/10 text-xs font-semibold cursor-pointer text-center"
                >
                  Close
                </button>
                <Link
                  href={`/learning?courseId=${selectedCourse.id}`}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 text-center"
                >
                  Enter Course Workspace
                </Link>
              </div>
            </div>
        )}
      </ResponsiveModal>
    </div>
  );
}

