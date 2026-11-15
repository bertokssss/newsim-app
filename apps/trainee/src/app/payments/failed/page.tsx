'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, FileSpreadsheet, CreditCard } from 'lucide-react';

function FailedContent() {
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get('enrollment_id') || searchParams.get('enrollmentId') || '';

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center space-y-6"
      >
        <div className="w-20 h-20 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Payment Cancelled or Incomplete
          </h1>
          <p className="text-xs text-slate-600 dark:text-[#CBD5E1] font-sans max-w-sm mx-auto">
            The PayMongo transaction was cancelled or could not be finalized. Your seat reservation is still preserved in your enrollment application.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/payments"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all"
          >
            <CreditCard className="w-4 h-4" />
            <span>Retry Payment</span>
          </Link>
          <Link
            href="/enrollment"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-500" />
            <span>My Enrollments</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-xs font-mono text-slate-400">Loading...</div>}>
      <FailedContent />
    </Suspense>
  );
}
