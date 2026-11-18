'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  BarChart3,
  X,
  ChevronRight
} from 'lucide-react';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function AssessmentsClient() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; code: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    courseId: '',
    type: 'WRITTEN',
    totalPoints: '100',
    passingScore: '75',
    durationMinutes: '60',
  });

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (typeFilter !== 'ALL') query.set('type', typeFilter);

      const res = await fetch(`/api/admin/assessments?${query.toString()}`);
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/courses?limit=200');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCourses(json.data);
          setFormData((prev) =>
            prev.courseId ? prev : { ...prev, courseId: json.data[0]?.id || '' }
          );
        }
      } catch (err) {
        console.error('Failed to load courses for assessments:', err);
      }
    })();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.courseId) return;
    try {
      const res = await fetch('/api/admin/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setCreateModalOpen(false);
        setFormData({
          title: '',
          courseId: courses[0]?.id || '',
          type: 'WRITTEN',
          totalPoints: '100',
          passingScore: '75',
          durationMinutes: '60',
        });
        fetchAssessments();
      }
    } catch (err) {
      console.error(err);
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
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
                Evaluation & Testing
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Assessment Management
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl">
              Track practical simulator evaluations, written STCW exam score sheets, passing thresholds, and retake authorizations.
            </p>
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Assessment</span>
          </button>
        </div>
      </motion.div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assessments by code, title, course..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'FINAL', 'PRACTICAL', 'WRITTEN', 'QUIZ'].map((type) => (
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
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>
              <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3.5 w-1/2 bg-slate-100 dark:bg-slate-800/60 rounded" />
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
              </div>
            </div>
          ))
        ) : assessments.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-slate-400 font-mono text-xs">
            No assessments found.
          </div>
        ) : (
          assessments.map((a, idx) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, ease: easeCurve, delay: idx * 0.04 }}
              whileHover={{ y: -2 }}
              className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {a.code}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/15 text-teal-600 border border-teal-500/30">
                    {a.type}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-3">
                  {a.title}
                </h3>
                <div className="text-xs text-slate-500 dark:text-[#CBD5E1] mt-1 font-mono">
                  Course: {a.courseTitle}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Passing Benchmark</span>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{a.passingScore}% ({a.totalPoints} pts)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Time Limit</span>
                    <div className="font-semibold text-slate-900 dark:text-[#F8FAFC] mt-0.5">{a.durationMinutes} mins</div>
                  </div>
                </div>

                <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-xs font-mono">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Pass Rate:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {a.submissionsCount > 0 ? `${Math.round((a.passedCount / a.submissionsCount) * 100)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Tested:</span>
                    <span className="font-semibold text-slate-900 dark:text-[#F8FAFC]">{a.submissionsCount} submissions</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Questions: {a.questionsCount ?? 0}</span>
                {a.courseId ? (
                  <Link
                    href={`/admin/courses/${a.courseId}`}
                    className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                  >
                    <span>Manage Questions</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Standard STCW Format</span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Assessment Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCreateModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">Add Operational Assessment</h3>
                <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Course</label>
                  <select
                    required
                    value={formData.courseId}
                    onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
                  >
                    <option value="">Select a course...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Assessment Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Simulator Blackout Maneuvering Evaluation"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Evaluation Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                    >
                      <option>PRACTICAL</option>
                      <option>FINAL</option>
                      <option>WRITTEN</option>
                      <option>QUIZ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Duration (Mins)</label>
                    <input
                      type="number"
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Total Points</label>
                    <input
                      type="number"
                      value={formData.totalPoints}
                      onChange={(e) => setFormData({ ...formData, totalPoints: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Passing Score Threshold</label>
                    <input
                      type="number"
                      value={formData.passingScore}
                      onChange={(e) => setFormData({ ...formData, passingScore: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[#CBD5E1] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-md"
                  >
                    Save Assessment
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

