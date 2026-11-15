'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ScrollText, CheckCircle2 } from 'lucide-react';

export interface TermsOnboardingModalProps {
  isOpen: boolean;
  termsVersion: string;
  onAccepted: () => void;
}

export function TermsOnboardingModal({
  isOpen,
  termsVersion,
  onAccepted,
}: TermsOnboardingModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!checked || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/terms-acceptance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreedToTerms: true, acceptanceContext: 'OAUTH_ONBOARDING' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not record acceptance. Please try again.');
        setSubmitting(false);
        return;
      }
      onAccepted();
    } catch {
      setError('Network error while saving your agreement. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-onboarding-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#040B14]/85 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#D8C4A5]/30 bg-[#0D1A2B] p-6 sm:p-7 text-slate-100 shadow-2xl space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D8C4A5]/15 border border-[#D8C4A5]/30 flex items-center justify-center shrink-0">
            <ScrollText className="w-5 h-5 text-[#D8C4A5]" />
          </div>
          <div>
            <h2 id="terms-onboarding-title" className="text-lg font-bold text-white">
              Review &amp; Accept NEWSIM Terms
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Policy Version {termsVersion} &bull; Required before continuing
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          To complete onboarding and maintain compliance with NEWSIM training policies and the Philippine Data Privacy Act (RA 10173), please review and acknowledge our Terms and Conditions and Privacy Policy.
        </p>

        <div className="flex flex-wrap gap-3 text-xs">
          <Link
            href="/terms"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-semibold text-sky-400 hover:bg-white/10 transition-colors"
          >
            Read Terms and Conditions
          </Link>
          <Link
            href="/privacy"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-semibold text-sky-400 hover:bg-white/10 transition-colors"
          >
            Read Privacy Policy
          </Link>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#D8C4A5] rounded shrink-0 cursor-pointer"
          />
          <span className="text-xs text-slate-200 leading-relaxed">
            I have read and agree to the{' '}
            <strong className="text-white">NEWSIM Terms and Conditions</strong> and acknowledge the{' '}
            <strong className="text-white">Privacy Policy</strong>.
          </span>
        </label>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Timestamped securely
          </span>
          <button
            type="button"
            disabled={!checked || submitting}
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-[#D8C4A5] px-5 py-2.5 text-xs font-bold text-[#07111C] hover:bg-[#e5d5bc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting ? 'Saving Agreement...' : 'Accept & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
