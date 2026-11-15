'use client';

import React, { useEffect, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

const OfficialReceiptModal = dynamic(() => import('@/components/OfficialReceiptModal'), { ssr: false });
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Receipt,
  FileSpreadsheet,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Printer,
  User,
} from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || searchParams.get('sessionId') || '';
  const enrollmentId = searchParams.get('enrollment_id') || searchParams.get('enrollmentId') || '';

  const [verifying, setVerifying] = useState(true);
  const [verifiedData, setVerifiedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  useEffect(() => {
    async function verify() {
      try {
        setVerifying(true);
        const query = new URLSearchParams();
        if (sessionId) query.set('sessionId', sessionId);
        if (enrollmentId) query.set('enrollmentId', enrollmentId);

        const res = await fetch(`/api/trainee/payments/verify?${query.toString()}`);
        const json = await res.json();

        if (json.success) {
          setVerifiedData(json);
        } else {
          setError(json.error || 'Could not verify payment');
        }
      } catch (err: any) {
        console.error('Payment verification failed:', err);
        setError('Network error while verifying payment status');
      } finally {
        setVerifying(false);
      }
    }

    verify();
  }, [sessionId, enrollmentId]);

  const receipt = verifiedData?.receipt;
  const trainee = receipt?.trainee;
  const course = receipt?.course;

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center space-y-6"
      >
        {verifying ? (
          <div className="py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-sky-500 animate-spin mx-auto" />
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
              Verifying PayMongo Settlement...
            </h2>
            <p className="text-xs font-mono text-slate-400 max-w-xs mx-auto">
              Confirming transaction with PayMongo gateway in TEST mode.
            </p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
              Verification Notice
            </h2>
            <p className="text-xs text-slate-500 font-mono">{error}</p>
            <div className="pt-4">
              <Link
                href="/enrollment"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md"
              >
                <span>Return to Enrollments</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Success Icon */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            {/* Badge & Title */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>PAYMONGO TEST MODE — SETTLED</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
                Payment Received!
              </h1>
            </div>

            {/* MANDATORY PROMINENT ONGOING PAYMENT & ADMIN VERIFICATION NOTICE */}
            <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border-2 border-amber-500/40 text-left space-y-1">
              <div className="flex items-center gap-2 font-heading font-extrabold text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Your payment is on-going. Please wait for admin verification to proceed.</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-200/90 leading-relaxed font-sans pl-6">
                Your tuition transaction was completed. Per MARINA regulations, the training center administrator must review and verify your application. Once approved (status: <strong>ENROLLED</strong>), your learning modules and simulator timetable will unlock automatically.
              </p>
            </div>

            {/* Trainee Details & SRN Card */}
            {trainee && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-left text-xs font-mono space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400">Trainee Name:</span>
                  <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                    {trainee.fullName}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 font-bold text-sky-600 dark:text-sky-400">
                    SRN (Seafarer Reg. No.):
                  </span>
                  <span className="font-extrabold text-emerald-600 dark:text-sky-400">
                    {trainee.srn}
                  </span>
                </div>
                {course && (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-400">Course:</span>
                      <span className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate max-w-[240px]">
                        {course.code} - {course.title}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-400">Assigned Batch:</span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {course.batchCode}
                      </span>
                    </div>
                  </>
                )}
                {receipt && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Official Receipt:</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">
                      {receipt.receiptNo}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
              {receipt && (
                <button
                  onClick={() => setReceiptModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>View &amp; Print Official Receipt</span>
                </button>
              )}
              <Link
                href="/enrollment"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>My Enrollments</span>
              </Link>
              <Link
                href="/payments"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 font-semibold text-xs transition-colors"
              >
                <Receipt className="w-4 h-4 text-sky-500" />
                <span>Payment History</span>
              </Link>
            </div>
          </>
        )}
      </motion.div>

      {/* Official Receipt Modal */}
      {receipt && (
        <OfficialReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          receipt={receipt}
        />
      )}
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="py-24 text-center text-xs font-mono text-slate-400">
        Loading payment verification...
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
