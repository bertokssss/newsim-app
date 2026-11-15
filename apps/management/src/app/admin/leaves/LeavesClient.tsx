'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  X,
  UserCheck,
  Building2,
  CalendarCheck,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface LeaveRecord {
  id: string;
  instructorId: string;
  instructorName: string;
  instructorEmail: string;
  instructorPhone: string;
  instructorAvatarUrl?: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  adminNotes: string;
  reviewedBy?: string;
  reviewerName?: string;
  reviewedAt?: string;
  createdAt: string;
}

export default function LeavesClient() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [affectedSchedulesAlert, setAffectedSchedulesAlert] = useState<any[] | null>(null);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (search) query.set('search', search);

      const res = await fetch(`/api/admin/leaves?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLeaves(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [statusFilter]);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e) || e < s) return 0;
    return Math.round((e - s) / (1000 * 3600 * 24)) + 1;
  };

  const handleOpenReview = (leave: LeaveRecord, action: 'APPROVE' | 'REJECT') => {
    setSelectedLeave(leave);
    setReviewAction(action);
    setAdminNotes('');
    setReviewModalOpen(true);
  };

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/leaves/${selectedLeave.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewAction,
          adminNotes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setReviewModalOpen(false);
        setSuccessNotification(
          reviewAction === 'APPROVE'
            ? `Leave request for ${selectedLeave.instructorName} approved. Schedule lock applied for ${selectedLeave.startDate} to ${selectedLeave.endDate}.`
            : `Leave request for ${selectedLeave.instructorName} was rejected.`
        );
        setTimeout(() => setSuccessNotification(null), 6000);

        if (json.overlappingSchedules && json.overlappingSchedules.length > 0) {
          setAffectedSchedulesAlert(json.overlappingSchedules);
        } else {
          setAffectedSchedulesAlert(null);
        }

        await fetchLeaves();
      } else {
        alert(json.error || 'Failed to review leave request');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLeaves = leaves.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.instructorName.toLowerCase().includes(s) ||
      l.instructorEmail.toLowerCase().includes(s) ||
      l.leaveType.toLowerCase().includes(s) ||
      l.reason.toLowerCase().includes(s)
    );
  });

  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length;
  const approvedCount = leaves.filter((l) => l.status === 'APPROVED').length;

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
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Staff Availability Control
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Instructor Leave Requests &amp; Schedule Locks
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl leading-relaxed font-sans">
              Review and approve instructor time-off. Approved leaves automatically lock new course scheduling for the period and highlight assigned sessions requiring substitute instructors.
            </p>
          </div>

          <Link
            href="/admin/schedules"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/25 transition-all self-start md:self-center"
          >
            <CalendarDays className="w-4 h-4" />
            <span>Go to Schedules &amp; Substitutes</span>
          </Link>
        </div>
      </motion.div>

      {/* Affected Schedules Alert */}
      <AnimatePresence>
        {affectedSchedulesAlert && affectedSchedulesAlert.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm font-heading font-extrabold text-amber-900 dark:text-amber-100">
                  Substitute Instructor Required for {affectedSchedulesAlert.length} Session(s)
                </strong>
                <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                  This instructor is currently scheduled during their approved leave dates. Please assign substitute instructors on the Schedules page to ensure training sessions proceed smoothly.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/admin/schedules"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-500 transition-all shadow-sm"
              >
                <span>Assign Substitutes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setAffectedSchedulesAlert(null)}
                className="p-1.5 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Notification Alert */}
      <AnimatePresence>
        {successNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-mono flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold">{successNotification}</span>
            </div>
            <button
              onClick={() => setSuccessNotification(null)}
              className="text-emerald-700 dark:text-emerald-300 hover:opacity-75 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Counter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Pending Admin Review</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
              {pendingCount} Request{pendingCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Approved Leaves</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
              {approvedCount} Approved
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Registered Leaves</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
              {leaves.length} Total
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
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

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instructor or reason..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] outline-none"
          />
        </div>
      </div>

      {/* Leave Requests Table */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: easeCurve }}
        className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
            Instructor Leave Requests Roster ({filteredLeaves.length})
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Schedule Locks Active on Approved Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-[#CBD5E1] font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-bold">Instructor</th>
                <th className="py-3.5 px-4 font-bold">Leave Type</th>
                <th className="py-3.5 px-4 font-bold">Leave Period</th>
                <th className="py-3.5 px-4 font-bold">Total Days</th>
                <th className="py-3.5 px-4 font-bold">Reason</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Reviewer / Notes</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-sans">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-36 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-12 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-40 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    No leave requests found for this filter.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((l) => {
                  const days = calculateDays(l.startDate, l.endDate);
                  let badgeClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
                  if (l.status === 'APPROVED') {
                    badgeClass = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
                  } else if (l.status === 'REJECTED') {
                    badgeClass = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
                  } else if (l.status === 'CANCELLED') {
                    badgeClass = 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border-slate-500/30';
                  }

                  return (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-[#F8FAFC]">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={l.instructorAvatarUrl}
                            name={l.instructorName.replace(/^Capt\.\s*/i, '')}
                            className="w-8 h-8 rounded-xl text-[11px]"
                            fallbackClassName="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono font-bold"
                          />
                          <div className="min-w-0">
                            <div className="truncate">{l.instructorName}</div>
                            <div className="text-[10px] font-mono text-slate-400 font-normal truncate">{l.instructorEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {l.leaveType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {l.startDate} <span className="text-slate-400">to</span> {l.endDate}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-[#F8FAFC]">
                        {days} Day{days !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-[#CBD5E1] max-w-xs truncate">
                        {l.reason || 'No explanation provided'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeClass}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs">
                        {l.adminNotes || (l.reviewerName ? `By ${l.reviewerName}` : '—')}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {l.status === 'PENDING' ? (
                          <div className="inline-flex items-center gap-1.5 font-mono">
                            <button
                              onClick={() => handleOpenReview(l, 'APPROVE')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow-sm transition-all"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleOpenReview(l, 'REJECT')}
                              className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-500/20 font-bold text-[10px] transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Review Modal */}
      <AnimatePresence>
        {reviewModalOpen && selectedLeave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setReviewModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    src={selectedLeave.instructorAvatarUrl}
                    name={selectedLeave.instructorName.replace(/^Capt\.\s*/i, '')}
                    className="w-10 h-10 rounded-xl text-xs"
                    fallbackClassName="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono font-bold"
                  />
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading truncate">
                      {reviewAction === 'APPROVE' ? 'Approve Leave Request' : 'Reject Leave Request'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {selectedLeave.instructorName} • {calculateDays(selectedLeave.startDate, selectedLeave.endDate)} Day(s)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReviewModalOpen(false)}
                  disabled={submitting}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmReview} className="p-6 space-y-4 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Leave Period:</span>
                    <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                      {selectedLeave.startDate} to {selectedLeave.endDate}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reason:</span>
                    <span className="text-slate-700 dark:text-slate-300">{selectedLeave.reason || 'None specified'}</span>
                  </div>
                </div>

                {reviewAction === 'APPROVE' && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Approving will block assigning new schedules to this instructor for these dates. Any currently assigned sessions will be flagged for substitute instructor assignment.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 uppercase text-[10px] mb-1 font-bold">
                    Admin Notes / Remarks (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder={reviewAction === 'APPROVE' ? 'e.g., Approved by Maritime Dean' : 'e.g., Insufficient notice period'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-sans"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-5 py-2 rounded-xl font-bold text-white shadow-md transition-all ${
                      reviewAction === 'APPROVE'
                        ? 'bg-sky-600 hover:bg-sky-700 shadow-emerald-500/25'
                        : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/25'
                    }`}
                  >
                    {submitting ? 'Processing...' : reviewAction === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
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
