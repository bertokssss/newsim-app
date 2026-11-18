'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Layers,
  Users,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Edit2,
  Trash2,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

interface BatchItem {
  id: string;
  batchCode: string;
  queueOrder?: number;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  coursePrice: number;
  packageId?: string | null;
  packageName?: string | null;
  centerId: string;
  centerName: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  instructorId?: string;
  capacity: number;
  enrolledCount: number;
  remainingSlots: number;
  status: 'OPEN' | 'QUEUED' | 'IN_PROGRESS' | 'FULL' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

export default function BatchesClient() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeBatch, setActiveBatch] = useState<BatchItem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form Fields
  const [formCourseId, setFormCourseId] = useState('');
  const [formBatchCode, setFormBatchCode] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formInstructorId, setFormInstructorId] = useState('');
  const [formCapacity, setFormCapacity] = useState('24');
  const [formStatus, setFormStatus] = useState<'OPEN' | 'QUEUED' | 'IN_PROGRESS' | 'FULL' | 'CLOSED' | 'COMPLETED' | 'CANCELLED'>('OPEN');

  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (courseFilter !== 'ALL') params.set('courseId', courseFilter);

      const res = await fetch(`/api/admin/batches?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setBatches(json.data || []);
        setStats(json.stats || null);
      }
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, courseFilter]);

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/admin/courses');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCourses(json.data);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const fetchInstructors = async () => {
    try {
      const res = await fetch('/api/admin/instructors');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setInstructors(json.data);
      }
    } catch (err) {
      console.error('Failed to load instructors:', err);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchCourses();
    fetchInstructors();
  }, [fetchBatches]);

  const handleOpenCreate = () => {
    setFormCourseId(courses[0]?.id || '');
    setFormBatchCode('');
    // Default start date = 2 weeks from today
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setFormStartDate(d.toISOString().split('T')[0]);
    const dEnd = new Date(d);
    dEnd.setDate(dEnd.getDate() + 5);
    setFormEndDate(dEnd.toISOString().split('T')[0]);
    setFormStartTime('08:00');
    setFormEndTime('17:00');
    setFormInstructorId('');
    setFormCapacity('24');
    setFormStatus('OPEN');
    setFormError('');
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (batch: BatchItem) => {
    setActiveBatch(batch);
    setFormBatchCode(batch.batchCode);
    setFormStartDate(batch.startDate);
    setFormEndDate(batch.endDate || '');
    setFormStartTime(batch.startTime || '');
    setFormEndTime(batch.endTime || '');
    setFormInstructorId(batch.instructorId || '');
    setFormCapacity(String(Math.min(batch.capacity || 24, 24)));
    setFormStatus(batch.status);
    setFormError('');
    setEditModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourseId || !formStartDate) {
      setFormError('Please select a course and start date');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError('');
      const res = await fetch('/api/admin/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: formCourseId,
          batchCode: formBatchCode || undefined,
          startDate: formStartDate,
          endDate: formEndDate || undefined,
          startTime: formStartTime || undefined,
          endTime: formEndTime || undefined,
          instructorId: formInstructorId || undefined,
          capacity: Math.min(24, Math.max(1, parseInt(formCapacity, 10) || 24)),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setCreateModalOpen(false);
        setSuccessMessage(`Batch ${json.data?.batchCode} created successfully!`);
        fetchBatches();
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setFormError(json.error || 'Failed to create batch');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Network error while creating batch');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch) return;

    try {
      setFormSubmitting(true);
      setFormError('');
      const res = await fetch(`/api/admin/batches/${activeBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchCode: formBatchCode,
          startDate: formStartDate,
          endDate: formEndDate || null,
          startTime: formStartTime || null,
          endTime: formEndTime || null,
          instructorId: formInstructorId || null,
          capacity: Math.min(24, Math.max(1, parseInt(formCapacity, 10) || 24)),
          status: formStatus,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEditModalOpen(false);
        setSuccessMessage(`Batch ${json.data?.batchCode} updated successfully!`);
        fetchBatches();
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setFormError(json.error || 'Failed to update batch');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Network error while updating batch');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              Capacity &amp; Scheduling
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Anti-Overbooking Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Batch Scheduling &amp; Capacity Control
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure STCW course cohorts, define seat capacities, and monitor real-time trainee admissions.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Batch</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-[11px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>Total Batches</span>
            <Layers className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
            {stats?.total ?? batches.length}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Active cohorts in catalog</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-[11px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>Open for Enrollment</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {stats?.open ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Accepting applications</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-[11px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>Enrolled Trainees</span>
            <Users className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 font-mono">
            {stats?.totalEnrolled ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Across {stats?.totalCapacity ?? 0} total seats
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-[11px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>Capacity Utilization</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {stats?.totalCapacity && stats.totalCapacity > 0
              ? `${Math.round((stats.totalEnrolled / stats.totalCapacity) * 100)}%`
              : '0%'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Anti-race lock enabled</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'OPEN', 'QUEUED', 'IN_PROGRESS', 'FULL', 'CLOSED', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search & Course Dropdown */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search batch code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">All Programs</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Batches Table */}
      <div className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-4 pl-6">Batch Code</th>
                <th className="p-4">STCW Course Program</th>
                <th className="p-4">Start / End Dates</th>
                <th className="p-4">Capacity Utilization</th>
                <th className="p-4">Remaining</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4 pl-6"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-4"><div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-4"><div className="h-4 w-32 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="p-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-4"><div className="h-4 w-16 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="p-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="p-4 pr-6 text-right"><div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs font-mono text-slate-400">
                    No batches found matching filter criteria.
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const percent = Math.min(100, Math.round((b.enrolledCount / b.capacity) * 100));

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 pl-6 font-mono font-bold text-teal-600 dark:text-teal-400">
                        <div className="flex items-center gap-2">
                          <span>{b.batchCode}</span>
                          {b.queueOrder !== undefined && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                b.status === 'OPEN'
                                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : b.status === 'QUEUED'
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  : b.status === 'IN_PROGRESS'
                                  ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                                  : 'bg-slate-500/20 text-slate-500 border border-slate-500/30'
                              }`}
                            >
                              Queue #{b.queueOrder}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white">{b.courseTitle}</div>
                        <div className="text-[10px] font-mono text-slate-400">Code: {b.courseCode}</div>
                        {b.instructorId && (
                          <div className="text-[10px] font-mono text-teal-600 dark:text-teal-400 mt-0.5">
                            Instructor: {instructors.find((i) => (i.instructorId || i.id) === b.instructorId)?.firstName ? `${instructors.find((i) => (i.instructorId || i.id) === b.instructorId)?.firstName} ${instructors.find((i) => (i.instructorId || i.id) === b.instructorId)?.lastName}` : 'Assigned'}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-mono text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1 font-bold">
                          <Calendar className="w-3 h-3 text-teal-500" />
                          <span>{b.startDate}</span>
                        </div>
                        {b.endDate && <div className="text-[10px] text-slate-400">End: {b.endDate}</div>}
                        {b.startTime && b.endTime && (
                          <div className="text-[10px] text-teal-600 dark:text-teal-400 mt-0.5">
                            {b.startTime} - {b.endTime}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-mono">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {b.enrolledCount} / {b.capacity}
                          </span>
                          <span className="text-slate-400">{percent}%</span>
                        </div>
                        <div className="w-28 h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percent >= 100
                                ? 'bg-rose-500'
                                : percent >= 75
                                ? 'bg-amber-500'
                                : 'bg-teal-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold">
                        <span className={b.remainingSlots > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                          {b.remainingSlots} seats
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                            b.status === 'OPEN'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : b.status === 'QUEUED'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : b.status === 'IN_PROGRESS'
                              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                              : b.status === 'FULL'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : b.status === 'CLOSED'
                              ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                              : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => handleOpenEdit(b)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-mono text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Configure</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE BATCH MODAL */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreateModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10"
            >
              <div className="h-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 w-full shrink-0" />

              <form onSubmit={handleCreateSubmit} className="overflow-y-auto overscroll-contain flex-1 min-h-0">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                    Create New Course Cohort Batch
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-mono">
                      {formError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                      STCW Course Program *
                    </label>
                    <select
                      value={formCourseId}
                      onChange={(e) => setFormCourseId(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}: {c.name || c.title} (₱{Number(c.fee || c.price || 0).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                      Batch Identifier Code (Optional — Auto-generated if blank)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BT-B20261115"
                      value={formBatchCode}
                      onChange={(e) => setFormBatchCode(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                        Daily Start Time
                      </label>
                      <input
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                        Daily End Time
                      </label>
                      <input
                        type="time"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                      Assigned STCW Instructor (Optional)
                    </label>
                    <select
                      value={formInstructorId}
                      onChange={(e) => setFormInstructorId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="">-- No Instructor Assigned --</option>
                      {instructors.map((ins) => (
                        <option key={ins.instructorId || ins.id} value={ins.instructorId || ins.id}>
                          {ins.firstName} {ins.lastName} {ins.specialization ? `(${ins.specialization})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                      Maximum Trainee Capacity (1 to 24, default 24)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      required
                      value={formCapacity}
                      onChange={(e) => setFormCapacity(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-teal-600/20 disabled:opacity-40 cursor-pointer"
                  >
                    {formSubmitting ? 'Creating...' : 'Create Batch'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT BATCH MODAL */}
      <AnimatePresence>
        {editModalOpen && activeBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10"
            >
              <div className="h-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 w-full shrink-0" />

              <form onSubmit={handleEditSubmit} className="overflow-y-auto overscroll-contain flex-1 min-h-0">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                      Configure Batch: {activeBatch.batchCode}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {activeBatch.courseCode}: {activeBatch.courseTitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-mono">
                      {formError}
                    </div>
                  )}

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 font-mono flex justify-between">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase">Enrolled Trainees</span>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white">
                        {activeBatch.enrolledCount} / {activeBatch.capacity}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-[10px] uppercase">Remaining Seats</span>
                      <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                        {activeBatch.remainingSlots}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                      Batch Code
                    </label>
                    <input
                      type="text"
                      required
                      value={formBatchCode}
                      onChange={(e) => setFormBatchCode(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                        Start Date
                      </label>
                      <input
                        type="date"
                        required
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                        Daily Start Time
                      </label>
                      <input
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                        Daily End Time
                      </label>
                      <input
                        type="time"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                      Assigned STCW Instructor
                    </label>
                    <select
                      value={formInstructorId}
                      onChange={(e) => setFormInstructorId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="">-- No Instructor Assigned --</option>
                      {instructors.map((ins) => (
                        <option key={ins.instructorId || ins.id} value={ins.instructorId || ins.id}>
                          {ins.firstName} {ins.lastName} {ins.specialization ? `(${ins.specialization})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                        Capacity (Max 24)
                      </label>
                      <input
                        type="number"
                        min={activeBatch.enrolledCount}
                        max="24"
                        required
                        value={formCapacity}
                        onChange={(e) => setFormCapacity(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">
                        Cohort Status
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      >
                        <option value="OPEN">OPEN (Accepting)</option>
                        <option value="QUEUED">QUEUED (In Queue)</option>
                        <option value="IN_PROGRESS">IN_PROGRESS (Training Ongoing)</option>
                        <option value="FULL">FULL (Locked)</option>
                        <option value="CLOSED">CLOSED (Stopped)</option>
                        <option value="COMPLETED">COMPLETED (Finished)</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-teal-600/20 disabled:opacity-40 cursor-pointer"
                  >
                    {formSubmitting ? 'Saving...' : 'Save Configuration'}
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
