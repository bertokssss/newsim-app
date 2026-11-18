'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  FileText,
  CalendarCheck,
  ShieldCheck,
  Building2,
  Calendar
} from 'lucide-react';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

function getDefaultLeaveFormData() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  return {
    leaveType: 'VACATION',
    startDate: today,
    endDate: tomorrow,
    reason: '',
  };
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  admin_notes?: string;
  reviewerName?: string;
  reviewed_at?: string;
  created_at: string;
}

export default function LeaveClient() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState(getDefaultLeaveFormData);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/instructor/leaves');
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
  }, []);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e) || e < s) return 0;
    return Math.round((e - s) / (1000 * 3600 * 24)) + 1;
  };

  const handleFileLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (formData.endDate < formData.startDate) {
      setErrorMsg('End date must be on or after the start date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/instructor/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setFileModalOpen(false);
        setSuccessMsg('Leave request submitted successfully. Awaiting administration review.');
        setTimeout(() => setSuccessMsg(null), 5000);
        setFormData(getDefaultLeaveFormData());
        await fetchLeaves();
      } else {
        setErrorMsg(json.error || 'Failed to submit leave request');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred while submitting leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    if (!confirm('Are you sure you want to cancel this pending leave request?')) return;
    try {
      const res = await fetch(`/api/instructor/leaves/${leaveId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg('Leave request cancelled.');
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchLeaves();
      } else {
        alert(json.error || 'Failed to cancel leave request');
      }
    } catch (err) {
      console.error(err);
      alert('Error cancelling leave request');
    }
  };

  const totalApprovedDays = leaves
    .filter((l) => l.status === 'APPROVED')
    .reduce((acc, l) => acc + calculateDays(l.start_date, l.end_date), 0);
  const pendingRequestsCount = leaves.filter((l) => l.status === 'PENDING').length;

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
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                Instructor Availability & Leave
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Leave Requests & Absence Management
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl leading-relaxed font-sans">
              File official leave for sick leave, vacation, or emergency time off. Once approved, scheduling locks prevent booking during your leave dates and allow administrators to assign substitute instructors.
            </p>
          </div>

          <button
            onClick={() => {
              setErrorMsg(null);
              setFileModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-md shadow-sky-500/20 transition-all active:scale-[0.98] self-start md:self-center"
          >
            <Plus className="w-4 h-4" />
            <span>File Leave Request</span>
          </button>
        </div>
      </motion.div>

      {/* Success Notification Alert */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-mono flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 dark:text-emerald-300 hover:opacity-75 p-1">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Approved Leave Days</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">{totalApprovedDays} Days</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Pending Admin Review</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">{pendingRequestsCount} Request{pendingRequestsCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Scheduling Lock Status</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {totalApprovedDays > 0 ? 'Active on Approved Dates' : 'No Active Leave Locks'}
            </span>
          </div>
        </div>
      </div>

      {/* Leaves Roster Table */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: easeCurve }}
        className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
            My Filed Leave Requests ({leaves.length})
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Recorded in NEWSIM Leave Register
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-[#CBD5E1] font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-bold">Leave Type</th>
                <th className="py-3.5 px-4 font-bold">Duration Period</th>
                <th className="py-3.5 px-4 font-bold">Total Days</th>
                <th className="py-3.5 px-4 font-bold">Reason / Purpose</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Admin Review Notes</th>
                <th className="py-3.5 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono">
                    Loading your leave history...
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono">
                    You have not filed any leave requests yet.
                  </td>
                </tr>
              ) : (
                leaves.map((l) => {
                  const days = calculateDays(l.start_date, l.end_date);
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
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {l.leave_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {l.start_date} <span className="text-slate-400">to</span> {l.end_date}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-[#F8FAFC]">
                        {days} Day{days !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-[#CBD5E1] max-w-xs truncate">
                        {l.reason || 'No details specified'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeClass}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs">
                        {l.admin_notes || (l.reviewerName ? `Reviewed by ${l.reviewerName}` : '—')}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {l.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancelLeave(l.id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-500/20 transition-all"
                          >
                            Cancel
                          </button>
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

      {/* File Leave Request Modal */}
      <AnimatePresence>
        {fileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setFileModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              <div className="h-1.5 bg-sky-500 w-full shrink-0" />

              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    File Leave Request
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Submit dates for administrative review and schedule blocking.
                  </p>
                </div>
                <button
                  onClick={() => setFileModalOpen(false)}
                  disabled={submitting}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleFileLeave} className="p-5 sm:p-6 space-y-4 text-xs font-mono overflow-y-auto overscroll-contain flex-1 min-h-0">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 uppercase text-[10px] mb-1 font-bold">Leave Type</label>
                  <select
                    value={formData.leaveType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, leaveType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-bold"
                  >
                    <option value="VACATION">Vacation / Annual Leave</option>
                    <option value="SICK">Sick / Medical Leave</option>
                    <option value="EMERGENCY">Emergency Leave</option>
                    <option value="OFFICIAL_BUSINESS">Official Business / Maritime Seminar</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 uppercase text-[10px] mb-1 font-bold">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase text-[10px] mb-1 font-bold">End Date</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      min={formData.startDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Total Duration:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {calculateDays(formData.startDate, formData.endDate)} Day(s)
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase text-[10px] mb-1 font-bold">Reason / Explanation</label>
                  <textarea
                    rows={3}
                    value={formData.reason}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="Provide details for administration review..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-sans"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setFileModalOpen(false)}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md shadow-sky-500/20"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
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
