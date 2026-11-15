'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  AlertTriangle,
  X,
  QrCode,
  Building2,
  ShieldCheck
} from 'lucide-react';
import { UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function PaymentsClient() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (methodFilter !== 'ALL') query.set('method', methodFilter);

      const res = await fetch(`/api/admin/payments?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setPayments(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [search, statusFilter, methodFilter]);

  const handleVerify = async (status: 'VERIFIED' | 'REJECTED') => {
    if (!selectedPayment) return;
    try {
      const res = await fetch(`/api/admin/payments/${selectedPayment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, remarks, action: status === 'VERIFIED' ? 'APPROVE' : 'REJECT' }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessBanner(
          status === 'VERIFIED'
            ? `Payment ${selectedPayment.paymentNo} approved successfully! Trainee has been marked as ENROLLED.`
            : `Payment ${selectedPayment.paymentNo} has been rejected and flagged as REFUNDABLE.`
        );
        setVerifyModalOpen(false);
        fetchPayments();
        setTimeout(() => setSuccessBanner(''), 6000);
      } else {
        setErrorBanner(json.error || 'Failed to update payment');
      }
    } catch (err: any) {
      console.error(err);
      setErrorBanner(err?.message || 'Network error while processing payment');
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
                Financial Operations
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Payment Processing & Verification
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl">
              Inspect QR Ph transaction references, reconcile digital wallet receipts, verify course tuition settlements, and activate trainee enrollment badges.
            </p>
          </div>

          <a
            href="/api/admin/reports?type=PAYMENTS&format=csv"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all active:scale-[0.98] shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Export Transactions CSV</span>
          </a>
        </div>
      </motion.div>

      {/* Banners */}
      {successBanner && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner('')} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-mono font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner('')} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payment number, reference, trainee..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'PENDING', 'VERIFIED', 'REJECTED'].map((st) => (
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

      {/* Payments Table */}
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
                <th className="py-3.5 px-4 font-bold">Payment No</th>
                <th className="py-3.5 px-4 font-bold">Seafarer Trainee</th>
                <th className="py-3.5 px-4 font-bold">Course Item</th>
                <th className="py-3.5 px-4 font-bold">Amount</th>
                <th className="py-3.5 px-4 font-bold">Method &amp; Ref</th>
                <th className="py-3.5 px-4 font-bold">Payment Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Approval &amp; Enrollment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded mb-1" /><div className="h-3 w-44 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-16 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {p.paymentNo}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={p.traineeAvatarUrl}
                          name={p.traineeName}
                          className="w-8 h-8 rounded-xl text-[11px]"
                          fallbackClassName="bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-mono font-bold"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate">{p.traineeName}</div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">{p.traineeEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {p.courseTitle}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                      ₱{p.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div className="font-bold text-teal-600 dark:text-teal-400">{p.method}</div>
                      <div className="text-slate-400">{p.referenceNumber}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        p.status === 'VERIFIED'
                          ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                          : p.status === 'PENDING'
                          ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {p.status === 'PENDING' ? (
                        <button
                          onClick={() => {
                            setSelectedPayment(p);
                            setRemarks('');
                            setVerifyModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-mono text-[11px] font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 ml-auto cursor-pointer transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve &amp; Enroll</span>
                        </button>
                      ) : p.status === 'VERIFIED' ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approved &amp; Enrolled
                          </span>
                          {p.verifiedBy && (
                            <span className="text-[10px] text-slate-400 font-mono">By Admin</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-rose-500 font-bold flex items-center gap-1 justify-end">
                          <XCircle className="w-3.5 h-3.5" /> Rejected (Refundable)
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Verify & Approve Modal */}
      <AnimatePresence>
        {verifyModalOpen && selectedPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setVerifyModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">Review Payment &amp; Approve Enrollment</h3>
                </div>
                <button onClick={() => setVerifyModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informational Callout */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-mono space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Automatic Enrollment Activation</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-700/90 dark:text-emerald-300/90">
                  Approving this payment verifies the tuition settlement and automatically marks the seafarer as <strong>ENROLLED</strong>, unlocking their training curriculum modules.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transaction No:</span>
                    <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{selectedPayment.paymentNo}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Trainee:</span>
                    <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-[#F8FAFC]">
                      <UserAvatar
                        src={selectedPayment.traineeAvatarUrl}
                        name={selectedPayment.traineeName}
                        className="w-6 h-6 rounded-lg text-[10px]"
                        fallbackClassName="bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono font-bold"
                      />
                      <span>{selectedPayment.traineeName}</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Course:</span>
                    <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{selectedPayment.courseTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount:</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">₱{selectedPayment.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Method:</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">{selectedPayment.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reference ID:</span>
                    <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{selectedPayment.referenceNumber}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Approval Remarks / Notes</label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Tuition settlement verified. Enrollment approved."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleVerify('REJECTED')}
                    className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20 cursor-pointer"
                  >
                    Reject Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerify('VERIFIED')}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    Approve Payment &amp; Enroll Trainee
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

