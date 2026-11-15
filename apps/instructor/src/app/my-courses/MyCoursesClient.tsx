'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Search,
  Clock,
  Users,
  Building2,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Award,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { CardGridSkeleton } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function MyCoursesClient() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [courseDetails, setCourseDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);

      const res = await fetch(`/api/instructor/my-courses?${query.toString()}`);
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

  const handleOpenDetails = async (course: any) => {
    setSelectedCourse(course);
    setDetailModalOpen(true);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/instructor/my-courses/${course.id}`);
      const json = await res.json();
      if (json.success) {
        setCourseDetails(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
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
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              Curriculum & Roster
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            My Assigned Teaching Courses
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed font-sans">
            Review course syllabi, prerequisites, enrolled seafarers, classroom materials, and assessment structures assigned to your instructor profile.
          </p>
        </div>
      </motion.div>

      {/* Search & Status Filters */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by course code, title, category..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['ALL', 'PUBLISHED', 'ONGOING', 'COMPLETED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold uppercase whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st}
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

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3">
            <CardGridSkeleton numCards={6} showHeader={false} />
          </div>
        ) : courses.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-slate-400 font-mono text-xs">
            No assigned courses found.
          </div>
        ) : (
          courses
            .filter((c) => {
              if (categoryFilter === 'ALL') return true;
              const isInHouse = String(c.category || '').toLowerCase().includes('in-house');
              return categoryFilter === 'In-House Courses' ? isInHouse : !isInHouse;
            })
            .map((c, idx) => (
            <motion.div
              key={c.id}
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
                    {c.code}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {c.status}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-3">
                  {c.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#CBD5E1] mt-1 line-clamp-2">
                  {c.description}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Training Hours</span>
                    <div className="font-semibold text-slate-900 dark:text-[#F8FAFC] mt-0.5">{c.durationHours} hrs ({c.trainingDays}d)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Slot Capacity</span>
                    <div className="font-semibold text-slate-900 dark:text-[#F8FAFC] mt-0.5">{c.capacity} Trainees</div>
                  </div>
                </div>

                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-xs font-mono">
                  <span className="text-[10px] text-slate-400 uppercase block">Training Campus</span>
                  <span className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate block">{c.centerName}</span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-mono text-slate-500">
                    {c.category}
                  </span>
                  <span className={`inline-block w-fit px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                    String(c.category || '').toLowerCase().includes('in-house')
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}>
                    {String(c.category || '').toLowerCase().includes('in-house')
                      ? 'Full Modular-Based'
                      : 'Modular + Practical'}
                  </span>
                </div>
                <button
                  onClick={() => handleOpenDetails(c)}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-mono text-[11px] font-bold shadow-md shadow-sky-500/20 transition-all"
                >
                  Inspect Syllabus →
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Course Details Modal */}
      <AnimatePresence>
        {detailModalOpen && selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      {selectedCourse.code}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                      {selectedCourse.title}
                    </h3>
                  </div>
                </div>
                <button onClick={() => setDetailModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Course Overview</span>
                  <p className="text-slate-700 dark:text-[#CBD5E1] leading-relaxed font-sans">
                    {selectedCourse.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Duration</span>
                    <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{selectedCourse.durationHours}h ({selectedCourse.trainingDays}d)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Capacity</span>
                    <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{selectedCourse.capacity} Pax</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Status</span>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">{selectedCourse.status}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Center</span>
                    <div className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate">{selectedCourse.centerName}</div>
                  </div>
                </div>

                {/* Prerequisites */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Prerequisites / Entry Criteria</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedCourse.prerequisites && selectedCourse.prerequisites.length > 0 ? (
                      selectedCourse.prerequisites.map((p: string, pIdx: number) => (
                        <span key={pIdx} className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[#CBD5E1] font-mono text-[11px]">
                          ✓ {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 font-mono">Open enrollment without special prerequisites.</span>
                    )}
                  </div>
                </div>

                {/* Syllabus Modules */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Course Syllabus & Curriculum Modules</span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">{(courseDetails?.modules || []).length} Modules</span>
                  </div>
                  <div className="space-y-2">
                    {(courseDetails?.modules || []).length === 0 ? (
                      <p className="text-slate-400 font-mono text-xs">Curriculum structure is aligned with STCW standards.</p>
                    ) : (
                      (courseDetails?.modules || []).map((mod: any, mIdx: number) => (
                        <div key={mod.id || mIdx} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                                Module {mod.sort_order || mIdx + 1}
                              </span>
                              <h4 className="font-bold text-xs text-slate-900 dark:text-[#F8FAFC]">{mod.title}</h4>
                            </div>
                            {mod.description && (
                              <p className="text-[11px] text-slate-500 dark:text-[#CBD5E1] mt-1 font-sans">{mod.description}</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Associated Training Materials (if any) */}
                {(courseDetails?.materials || []).length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Course Resources & Documents</span>
                      <span className="text-[10px] font-mono text-slate-400">{(courseDetails?.materials || []).length} Files</span>
                    </div>
                    <div className="space-y-2">
                      {(courseDetails?.materials || []).map((m: any) => (
                        <div key={m.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{m.title}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{m.moduleName} • {m.fileSize}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                            {m.fileType}
                          </span>
                        </div>
                      ))}
                    </div>
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

