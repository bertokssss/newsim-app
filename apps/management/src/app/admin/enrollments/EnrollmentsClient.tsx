'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  X,
  CreditCard,
  Building2,
  Filter,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  RotateCcw,
  Check,
  Calendar,
  Layers,
  FileText,
  Send,
} from 'lucide-react';
import { UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface PipelineFilter {
  key: string;
  label: string;
  purpose: string;
}

const PIPELINE_FILTERS: PipelineFilter[] = [
  { key: 'ALL', label: 'ALL', purpose: 'All enrollment applications' },
  { key: 'PENDING_REVIEW', label: 'PENDING REVIEW', purpose: 'Tuition paid — awaiting approval in Payments' },
  { key: 'PAYMENT_PENDING', label: 'PAYMENT PENDING', purpose: 'Awaiting PayMongo GCash/Maya settlement' },
  { key: 'ENROLLED', label: 'ENROLLED', purpose: 'Approved & active — course modules unlocked' },
  { key: 'REJECTED', label: 'REJECTED', purpose: 'Applications not approved' },
  { key: 'COMPLETED', label: 'COMPLETED', purpose: 'Completed training courses' },
];

const getStatusBadge = (status: string) => {
  const norm = (status || '').toUpperCase().trim().replace(/\s+/g, '_');
  switch (norm) {
    case 'PENDING_REVIEW':
    case 'UNDER_REVIEW':
      return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30';
    case 'PAYMENT_PENDING':
    case 'NEW':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
    case 'QUALIFICATION_CHECK':
      return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30';
    case 'APPROVED':
    case 'ENROLLED':
    case 'ACTIVE':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
    case 'COMPLETED':
      return 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-600/30';
    case 'REJECTED':
    case 'CANCELLED':
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
    default:
      return 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-500/30';
  }
};

const getStatusLabel = (status: string) => {
  const norm = (status || '').toUpperCase().trim().replace(/\s+/g, '_');
  switch (norm) {
    case 'PENDING_REVIEW':
      return 'PENDING REVIEW';
    case 'PAYMENT_PENDING':
      return 'PAYMENT PENDING';
    case 'UNDER_REVIEW':
      return 'UNDER REVIEW';
    case 'QUALIFICATION_CHECK':
      return 'QUALIFICATION CHECK';
    case 'ENROLLED':
      return 'ENROLLED';
    default:
      return status?.replace(/_/g, ' ') || 'UNKNOWN';
  }
};

export default function EnrollmentsClient() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedEnrollment, setSelectedEnrollment] = useState<any | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchEnrollments = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (debouncedSearch) query.set('search', debouncedSearch);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);

      const res = await fetch(`/api/admin/enrollments?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEnrollments(json.data || []);
        if (json.counts) {
          setCounts(json.counts);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const activeFilter = useMemo(() => {
    return (
      PIPELINE_FILTERS.find((f) => f.key === statusFilter) || {
        key: statusFilter,
        label: statusFilter.replace(/_/g, ' '),
        purpose: 'Filtered enrollment records',
      }
    );
  }, [statusFilter]);

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
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
              Registrar &amp; Admissions Review
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
              PayMongo Verification Sync
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Enrollment Applications &amp; Review
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed font-sans">
            Review seafarer training applications, batch allocations, and payment verification records. Approvals are processed in the Payments module upon tuition settlement.
          </p>
        </div>
      </motion.div>



      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search enrollment, trainee, batch, course..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {/* Pipeline Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 hide-scrollbar">
            {PIPELINE_FILTERS.map((f) => {
              const count = counts[f.key];
              const isActive = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  title={f.purpose}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold uppercase whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{f.label}</span>
                  {count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Pipeline Stage Info Banner */}
        <div className="px-4 py-2.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/70 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-mono text-slate-400 uppercase text-[10px] font-semibold">Active Filter:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-[#F8FAFC]">
              {activeFilter.label}
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-600">—</span>
            <span className="text-slate-600 dark:text-[#CBD5E1] font-sans">
              {activeFilter.purpose}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 shrink-0">
            {enrollments.length} {enrollments.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>
      </div>

      {/* Enrollments Table */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: easeCurve }}
        className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-[#CBD5E1] font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-bold">Enrollment No</th>
                <th className="py-3.5 px-4 font-bold">Seafarer Trainee</th>
                <th className="py-3.5 px-4 font-bold">Course / Batch</th>
                <th className="py-3.5 px-4 font-bold">Payment Status</th>
                <th className="py-3.5 px-4 font-bold">Enrollment Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Review &amp; Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                [1, 2, 3, 4, 5].map((r) => (
                  <tr key={r} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded mb-1" /><div className="h-3 w-48 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded mb-1" /><div className="h-3 w-28 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : enrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-mono">
                    No matching enrollments found for pipeline filter: &quot;{activeFilter.label}&quot;.
                  </td>
                </tr>
              ) : (
                enrollments.map((enr) => {
                  const rawStatus = (enr.rawStatus || enr.status || '').toUpperCase();
                  const isAwaitingReview = rawStatus === 'PENDING_REVIEW' || rawStatus === 'UNDER_REVIEW';
                  const isPaymentPending = rawStatus === 'PAYMENT_PENDING' || rawStatus === 'NEW';
                  const isEnrolled = rawStatus === 'ENROLLED' || rawStatus === 'APPROVED' || rawStatus === 'ACTIVE';
                  const isRejected = rawStatus === 'REJECTED';

                  return (
                    <tr
                      key={enr.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setSelectedEnrollment(enr)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {enr.enrollmentNo}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={enr.traineeAvatarUrl}
                            name={enr.traineeName}
                            className="w-9 h-9 rounded-xl text-xs"
                            fallbackClassName="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono font-bold"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
                              {enr.traineeName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 truncate">
                              {enr.traineeSrn && <span>SRN: {enr.traineeSrn} •</span>}
                              <span className="truncate">{enr.traineeEmail}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {enr.courseTitle}
                        </div>
                        <div className="text-[11px] font-mono text-teal-600 dark:text-teal-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>Batch: {enr.batchCode || enr.batch || 'Cohort'}</span>
                          {enr.batchStartDate && <span>({enr.batchStartDate})</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              enr.rawPaymentStatus === 'PAID' || enr.paymentStatus === 'VERIFIED'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {enr.rawPaymentStatus === 'PAID' ? 'PAID (PayMongo TEST)' : enr.paymentStatus}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            ₱{Number(enr.paymentAmount || 0).toLocaleString()} via {enr.paymentMethod || 'GCASH'}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${getStatusBadge(
                            rawStatus
                          )}`}
                        >
                          {getStatusLabel(rawStatus)}
                        </span>
                      </td>
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEnrollment(enr);
                        }}
                      >
                        <div className="inline-flex items-center gap-2 justify-end">
                          {isEnrolled && (
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled &amp; Active
                            </span>
                          )}

                          {isAwaitingReview && (
                            <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Awaiting Payment Approval
                            </span>
                          )}

                          {isPaymentPending && (
                            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Awaiting Payment
                            </span>
                          )}

                          {isRejected && (
                            <span className="text-[10px] font-mono text-rose-500 font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Rejected (Refundable)
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedEnrollment(enr)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-[#163854] text-slate-700 dark:text-slate-200 font-mono text-[10px] font-semibold border border-slate-200/60 dark:border-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Review</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ENROLLMENT REVIEW DETAIL MODAL (REVIEW ONLY - NO APPROVAL ACTION) */}
      <AnimatePresence>
        {selectedEnrollment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl bg-white dark:bg-[#0c1a2c] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                    {selectedEnrollment.enrollmentNo}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-[#F8FAFC] mt-0.5">
                    Seafarer Enrollment Application Review
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedEnrollment(null)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
                {/* Trainee & Course Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Seafarer Trainee</span>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        src={selectedEnrollment.traineeAvatarUrl}
                        name={selectedEnrollment.traineeName}
                        className="w-10 h-10 rounded-xl text-xs"
                        fallbackClassName="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono font-bold"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
                          {selectedEnrollment.traineeName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                          {selectedEnrollment.traineeSrn ? `SRN: ${selectedEnrollment.traineeSrn} • ` : ''}
                          {selectedEnrollment.traineeEmail}
                        </div>
                        {selectedEnrollment.traineePhone && (
                          <div className="text-[10px] font-mono text-slate-400">
                            Phone: {selectedEnrollment.traineePhone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Enrolled STCW Course</span>
                    <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                      {selectedEnrollment.courseTitle}
                    </div>
                    <div className="text-[11px] font-mono text-teal-600 dark:text-teal-400">
                      {selectedEnrollment.courseCode}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Assigned Batch Schedule</span>
                    <div className="font-bold text-teal-600 dark:text-teal-400 font-mono flex items-center gap-1.5">
                      <span>{selectedEnrollment.batchCode || selectedEnrollment.batch || 'Cohort'}</span>
                      {selectedEnrollment.batchQueueOrder && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                          Queue #{selectedEnrollment.batchQueueOrder}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {selectedEnrollment.batchStartDate ? `Starts: ${selectedEnrollment.batchStartDate}` : 'Provisional Schedule'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Tuition Settlement</span>
                    <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                      ₱{Number(selectedEnrollment.paymentAmount || 0).toLocaleString()} ({selectedEnrollment.paymentMethod || 'GCASH'})
                    </div>
                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {selectedEnrollment.rawPaymentStatus === 'PAID' ? 'PAID & SETTLED (TEST MODE)' : selectedEnrollment.paymentStatus}
                    </div>
                  </div>
                </div>

                {/* Review Notes if any */}
                {selectedEnrollment.reviewNotes && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <div className="font-bold uppercase text-[10px] font-mono mb-1 text-slate-400">Registrar Review Remarks:</div>
                    <p className="text-xs">{selectedEnrollment.reviewNotes}</p>
                  </div>
                )}

                {/* Status Guidance Notice Banner */}
                {((selectedEnrollment.rawStatus || selectedEnrollment.status || '').toUpperCase() === 'ENROLLED' ||
                  (selectedEnrollment.rawStatus || selectedEnrollment.status || '').toUpperCase() === 'ACTIVE') ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Enrollment is Verified &amp; Active. Course modules and simulator training access are fully unlocked for this trainee.</span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-800 dark:text-sky-300 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-sky-500 shrink-0" />
                      <span>Tuition verification and official admission approvals are processed in the <strong>Payments</strong> module.</span>
                    </div>
                    <Link
                      href="/admin/payments"
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-mono font-bold text-[10px] shrink-0 inline-flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <span>Go to Payments</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* Footer Action Bar in Review Modal - Review Only */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="text-xs font-mono text-slate-400">
                    Status: <strong className="text-slate-900 dark:text-white uppercase">{selectedEnrollment.rawStatus || selectedEnrollment.status}</strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedEnrollment(null)}
                    className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close Review
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
