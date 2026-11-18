'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { OfficialReceiptData } from '@/components/OfficialReceiptModal';

const OfficialReceiptModal = dynamic(() => import('@/components/OfficialReceiptModal'), { ssr: false });
import {
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  X,
  ShieldCheck,
  Building2,
  Receipt,
  AlertCircle,
  ExternalLink,
  Loader2,
  Smartphone,
  Wallet,
  Printer,
  User,
} from 'lucide-react';
import { TablePageSkeleton, ResponsiveModal } from '@newsim/ui';

function PaymentsContent() {
  const searchParams = useSearchParams();
  const preselectedEnrId = searchParams.get('enrollmentId') || '';

  const [payments, setPayments] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<OfficialReceiptData | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'gcash' | 'paymaya'>('gcash');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleViewReceipt = (p: any) => {
    const isApproved = Boolean(
      p.isApproved ||
      p.verifiedAt ||
      p.verified_at ||
      (p.status || '').toUpperCase() === 'VERIFIED' ||
      ['ENROLLED', 'APPROVED', 'ACTIVE', 'COMPLETED'].includes((p.enrollmentStatus || '').toUpperCase())
    );

    const trainee = p.trainee || {
      fullName: 'Maritime Trainee',
      srn: 'SRN-PENDING',
      email: '',
      phone: '',
    };

    const receiptData: OfficialReceiptData = {
      receiptNo: p.receiptNo || `REC-${p.id.slice(0, 8).toUpperCase()}`,
      referenceNumber: p.referenceNumber || p.paymentNo,
      paymongoCheckoutId: p.paymongoCheckoutId,
      paymongoPaymentId: p.paymongoPaymentId,
      amount: Number(p.amount) || 0,
      paymentMethod: p.method || 'GCASH',
      environment: p.environment || 'TEST',
      status: isApproved ? 'VERIFIED' : p.status,
      isApproved,
      verifiedAt: p.verifiedAt || p.verified_at,
      paidAt: p.paidAt || p.createdAt,
      trainee: {
        fullName: trainee.fullName || 'Maritime Trainee',
        srn: trainee.srn || 'SRN-PENDING',
        traineeNumber: trainee.traineeNumber,
        email: trainee.email,
        phone: trainee.phone,
        address: trainee.address,
        nationality: trainee.nationality,
      },
      course: {
        title: p.courseTitle || 'Maritime Training Course',
        code: p.courseCode || 'STCW',
        batchCode: p.batchCode || 'Cohort',
        startDate: p.batchStartDate,
        endDate: p.batchEndDate,
        centerName: p.centerName || 'NEWSIM Maritime Training Center',
      },
      notice: isApproved
        ? 'Payment verified and approved by training center administrator.'
        : 'Your payment is on-going. Please wait for admin verification to proceed.',
    };

    setActiveReceipt(receiptData);
    setReceiptModalOpen(true);
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const [payRes, enrRes] = await Promise.all([
        fetch('/api/trainee/payments'),
        fetch('/api/trainee/enrollment'),
      ]);

      const payJson = await payRes.json();
      if (payJson.success && Array.isArray(payJson.data)) {
        setPayments(payJson.data);
      }

      const enrJson = await enrRes.json();
      if (enrJson.success && Array.isArray(enrJson.data?.enrollments)) {
        const enrList = enrJson.data.enrollments;
        setEnrollments(enrList);
        if (preselectedEnrId && enrList.some((e: any) => e.id === preselectedEnrId)) {
          setSelectedEnrollmentId(preselectedEnrId);
          setCheckoutModalOpen(true);
        } else if (enrList.length > 0 && !selectedEnrollmentId) {
          setSelectedEnrollmentId(enrList[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();

    // Auto-refresh on window focus to immediately capture Admin verification
    const handleFocus = () => {
      fetchPayments();
    };
    window.addEventListener('focus', handleFocus);

    // Auto-poll every 4 seconds when any payment is pending admin approval
    const interval = setInterval(() => {
      fetchPayments();
    }, 4000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [preselectedEnrId]);

  const selectedEnrollment = enrollments.find((e) => e.id === selectedEnrollmentId) || enrollments[0];
  const payableAmount = selectedEnrollment?.fee || 7500;

  const handlePayMongoCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollment?.id) return;

    try {
      setSubmitting(true);
      setErrorMessage('');

      const res = await fetch('/api/trainee/payments/paymongo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: selectedEnrollment.id,
          method: selectedMethod,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.checkoutUrl) {
        // Direct browser redirect to PayMongo hosted checkout session
        window.location.href = json.data.checkoutUrl;
      } else {
        setErrorMessage(json.error || 'Failed to initialize PayMongo checkout');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Network error connecting to payment gateway');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-slate-200/80 dark:border-slate-800">
              Financial Billing &amp; Receipts
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              PayMongo TEST MODE Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Payments &amp; Tuition Gateway
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] font-sans mt-0.5">
            Settle tuition fees securely via GCash and Maya powered by PayMongo.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage('');
            setCheckoutModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <CreditCard className="w-4 h-4" />
          <span>Pay Tuition via PayMongo</span>
        </button>
      </div>

      {/* PayMongo Test Mode Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-bold text-slate-900 dark:text-amber-300 font-mono">
            TEST MODE GATEWAY NOTICE
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
            All GCash and Maya transactions are processed through the PayMongo Developer Sandbox. No real monetary charges will occur. You can test payment success and cancel flows using PayMongo&apos;s interactive test buttons.
          </p>
        </div>
      </div>

      {/* Dynamic Verification Banners */}
      {(() => {
        const hasPendingApproval = payments.some((p: any) => {
          const isApproved = Boolean(
            p.isApproved ||
            p.verifiedAt ||
            p.verified_at ||
            (p.status || '').toUpperCase() === 'VERIFIED' ||
            ['ENROLLED', 'APPROVED', 'ACTIVE', 'COMPLETED'].includes((p.enrollmentStatus || '').toUpperCase())
          );
          const statusUpper = (p.status || '').toUpperCase();
          const enrStatusUpper = (p.enrollmentStatus || '').toUpperCase();
          return !isApproved && (statusUpper === 'PAID' || enrStatusUpper === 'PENDING_REVIEW' || statusUpper === 'PROCESSING');
        });

        const hasApprovedPayments = payments.some((p: any) => {
          return Boolean(
            p.isApproved ||
            p.verifiedAt ||
            p.verified_at ||
            (p.status || '').toUpperCase() === 'VERIFIED' ||
            ['ENROLLED', 'APPROVED', 'ACTIVE', 'COMPLETED'].includes((p.enrollmentStatus || '').toUpperCase())
          );
        });

        if (hasPendingApproval) {
          return (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border-2 border-amber-500/40 flex items-start gap-3.5">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-heading font-extrabold text-sm text-amber-800 dark:text-amber-300">
                  Your payment is on-going. Please wait for admin verification to proceed.
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-200/90 leading-relaxed font-sans">
                  Your tuition payment has been settled. In accordance with maritime training regulations, the training center administrator is verifying your application and batch schedule. You can view and print your Official Receipt with your Seafarer Registration Number (SRN) below.
                </p>
              </div>
            </div>
          );
        }

        if (hasApprovedPayments) {
          return (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border-2 border-emerald-500/40 flex items-start gap-3.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-heading font-extrabold text-sm text-emerald-800 dark:text-emerald-300">
                  Payment Verified &amp; Enrollment Confirmed
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-200/90 leading-relaxed font-sans">
                  Your tuition payment has been officially verified and approved by the training center administrator. Your course modules, batch schedule, and training portal access are fully active. You can view or print your Official Receipt below.
                </p>
              </div>
            </div>
          );
        }

        return null;
      })()}

      {/* Payment History Table */}
      <div className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden relative">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-sky-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
              Transaction History &amp; Official Receipts
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {payments.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-4 pl-6">Reference No</th>
                <th className="p-4">Program / Description</th>
                <th className="p-4">Batch</th>
                <th className="p-4">Channel</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Official Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4">
                    <TablePageSkeleton rows={4} columns={6} showHeader={false} />
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs font-mono text-slate-400">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p: any) => {
                  const statusUpper = (p.status || '').toUpperCase();
                  const enrStatusUpper = (p.enrollmentStatus || '').toUpperCase();
                  const isApproved = Boolean(
                    p.isApproved ||
                    p.verifiedAt ||
                    p.verified_at ||
                    statusUpper === 'VERIFIED' ||
                    ['ENROLLED', 'APPROVED', 'ACTIVE', 'COMPLETED'].includes(enrStatusUpper)
                  );
                  const isPaidPending = !isApproved && (statusUpper === 'PAID' || statusUpper === 'PROCESSING' || enrStatusUpper === 'PENDING_REVIEW');
                  const isPendingPayment = statusUpper === 'PENDING' && !isApproved && !isPaidPending;
                  const isCanViewReceipt = isApproved || isPaidPending || statusUpper === 'PAID';

                  return (
                    <tr key={p.id} className="hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 pl-6 font-mono font-bold text-sky-600 dark:text-sky-400">
                        {p.paymentNo || p.referenceNumber}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{p.courseTitle}</div>
                        <div className="text-[10px] font-mono text-slate-400">SRN: {p.trainee?.srn || 'SRN-PENDING'}</div>
                      </td>
                      <td className="p-4 font-mono font-bold text-xs text-sky-600 dark:text-sky-400">
                        <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-slate-200/80 dark:border-slate-800">
                          {p.batchCode || 'Cohort'}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          p.method === 'GCASH'
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {p.method}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                        ₱{Number(p.amount).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase inline-flex items-center gap-1.5 ${
                            isApproved
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : isPaidPending
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : isPendingPayment
                              ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isApproved ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>APPROVED &amp; VERIFIED</span>
                            </>
                          ) : isPaidPending ? (
                            <>
                              <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                              <span>PENDING APPROVAL</span>
                            </>
                          ) : isPendingPayment ? (
                            <>
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>PENDING PAYMENT</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-rose-500" />
                              <span>{p.status}</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        {isCanViewReceipt ? (
                          <button
                            onClick={() => handleViewReceipt(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-95 text-white font-mono text-[11px] font-bold shadow-xs transition-opacity cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>View Receipt</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '--'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PayMongo Checkout Modal */}
      <ResponsiveModal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        disableClose={submitting}
        maxWidthClassName="max-w-md"
        topAccentClassName="h-1.5 bg-sky-500"
      >
        <div className="p-4 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.2 rounded">
                PayMongo Gateway
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
              Tuition Settlement
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutModalOpen(false)}
            disabled={submitting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer shrink-0 disabled:opacity-40"
            aria-label="Close tuition settlement"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 text-xs overflow-y-auto overscroll-contain flex-1 min-h-0">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {enrollments.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="text-xs text-slate-500">You do not have any active course enrollments yet.</p>
              <Link
                href="/enrollment"
                onClick={() => setCheckoutModalOpen(false)}
                className="inline-block px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm"
              >
                Apply for Course First →
              </Link>
            </div>
          ) : (
            <form onSubmit={handlePayMongoCheckout} className="space-y-4">
              {/* Course / Enrollment Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-900 dark:text-[#F8FAFC] font-heading uppercase text-[10px] block">
                  Select Course Application
                </label>
                <select
                  value={selectedEnrollmentId}
                  onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:border-slate-200/80 dark:border-slate-800"
                >
                  {enrollments.map((enr) => (
                    <option key={enr.id} value={enr.id}>
                      {enr.enrollmentNo}: {enr.courseTitle} — ₱{(enr.fee || 7500).toLocaleString()} ({enr.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount & Batch Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 font-mono space-y-1.5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="text-slate-400">Assigned Batch:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">
                    {selectedEnrollment?.batchCode || 'Cohort'}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="text-slate-400">Tuition Total:</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    ₱{payableAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* E-Wallet Channel Selector (GCash or Maya) */}
              <div className="space-y-2">
                <label className="font-bold text-slate-900 dark:text-[#F8FAFC] font-heading uppercase text-[10px] block">
                  Choose PayMongo E-Wallet Channel
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* GCash Option */}
                  <div
                    onClick={() => setSelectedMethod('gcash')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      selectedMethod === 'gcash'
                        ? 'bg-blue-500/10 border-blue-500 shadow-xs'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-blue-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-extrabold text-xs text-blue-600 dark:text-blue-400">
                        GCash
                      </span>
                      <Smartphone className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Instant e-wallet checkout
                    </span>
                  </div>

                  {/* Maya Option */}
                  <div
                    onClick={() => setSelectedMethod('paymaya')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      selectedMethod === 'paymaya'
                        ? 'bg-emerald-500/10 border-emerald-500 shadow-xs'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                        Maya
                      </span>
                      <Wallet className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Pay via Maya App / QR
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed font-sans">
                Clicking proceed will redirect you to PayMongo&apos;s secure test checkout page. Complete the payment using test credentials, and your application will automatically transition to <strong>PENDING REVIEW</strong>.
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-sky-500/20 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to PayMongo...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to PayMongo Checkout (₱{payableAmount.toLocaleString()})</span>
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </ResponsiveModal>

      {/* Official Receipt Modal */}
      <OfficialReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receipt={activeReceipt}
      />
    </div>
  );
}

export default function PaymentsClient() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-xs font-mono text-slate-400">Loading payments...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}
