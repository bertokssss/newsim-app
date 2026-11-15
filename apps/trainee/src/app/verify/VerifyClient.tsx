'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Calendar,
  User,
  Building2,
  Search,
  ExternalLink,
  Anchor,
  FileCheck2,
} from 'lucide-react';
import { UserAvatar } from '@newsim/ui';

export function VerifyClient() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || searchParams.get('id') || searchParams.get('cert') || '';

  const [inputCode, setInputCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const performVerification = async (codeToVerify: string) => {
    const trimmed = codeToVerify.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/trainee/certificates/verify?code=${encodeURIComponent(trimmed)}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to query verification database.');
      } else {
        setResult(json.data);
      }
    } catch (err: any) {
      setError(err.message || 'Network connection failed during verification check.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      performVerification(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(inputCode);
  };

  const cert = result?.certificate;
  const isValid = Boolean(result?.isValid);
  const isRevoked = result?.status === 'REVOKED' || cert?.status === 'REVOKED';
  const isExpired = result?.status === 'EXPIRED' || (cert?.expiryDate && new Date(cert.expiryDate) < new Date());

  return (
    <div className="min-h-screen bg-[#070E1A] text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      {/* Top Navigation / Branding */}
      <header className="border-b border-slate-800/80 bg-[#0A1628]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-600/20 border border-sky-400/30">
              <Anchor className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-heading font-extrabold text-white text-base tracking-wide flex items-center gap-2">
                NEWSIM
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  Registry
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                MARINA STCW Certificate Public Verification
              </div>
            </div>
          </div>

          <a
            href="/login"
            className="text-xs font-mono text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <span>Portal Login</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col gap-6">
        {/* Verification Search Box */}
        <div className="rounded-3xl border border-slate-800 bg-[#0D1B2E] p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-2.5 mb-2">
            <ShieldCheck className="h-5 w-5 text-sky-400" />
            <h1 className="text-lg font-bold font-heading text-white">
              Official Credential Verification
            </h1>
          </div>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            Enter the Certificate Serial Number or scanned QR Code identifier to verify authentic maritime training and STCW compliance records directly from the NEWSIM institutional registry.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="e.g. NEWSIM-CERT-2026-123456"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inputCode.trim()}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition-all shadow-md shadow-sky-600/30 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="h-4 w-4" />
                  <span>Verify Record</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-200">
              <div className="font-bold mb-0.5">Verification Query Notice</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {/* Verification Result Card */}
        {result && (
          <div className="rounded-3xl border border-slate-800 bg-[#0D1B2E] p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6 animate-fadeIn">
            {/* Status Header Banner */}
            <div className={`rounded-2xl p-4 flex items-center gap-3.5 border ${
              isValid
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : isRevoked
                ? 'bg-red-950/40 border-red-500/40 text-red-300'
                : isExpired
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}>
              {isValid ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-400 shrink-0" />
              ) : isRevoked ? (
                <XCircle className="h-7 w-7 text-red-400 shrink-0" />
              ) : isExpired ? (
                <AlertTriangle className="h-7 w-7 text-amber-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-7 w-7 text-slate-400 shrink-0" />
              )}
              <div>
                <div className="text-sm font-bold font-heading tracking-wide">
                  {isValid
                    ? 'OFFICIALLY VERIFIED & AUTHENTIC STCW CREDENTIAL'
                    : isRevoked
                    ? 'CREDENTIAL REVOKED — INVALID'
                    : isExpired
                    ? 'CREDENTIAL EXPIRED — RENEWAL REQUIRED'
                    : 'RECORD NOT FOUND OR UNVERIFIED'}
                </div>
                <div className="text-xs opacity-90 mt-0.5 font-mono">
                  {result.message}
                </div>
              </div>
            </div>

            {/* Certificate Details Grid */}
            {cert && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1.5">
                    <User className="h-3.5 w-3.5 text-sky-400" />
                    <span>TRAINEE CREDENTIAL HOLDER</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      src={cert.traineeAvatarUrl}
                      name={cert.traineeName}
                      alt={cert.traineeName || 'Trainee'}
                      className="w-8 h-8 rounded-xl border border-slate-700"
                      fallbackClassName="bg-sky-500/20 text-sky-300 text-xs font-bold"
                    />
                    <div className="text-sm font-bold text-white font-heading">
                      {cert.traineeName}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    MARINA SRN: <span className="text-sky-300 font-bold">{cert.srn || 'N/A'}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1.5">
                    <Award className="h-3.5 w-3.5 text-sky-400" />
                    <span>MARITIME COURSE / PROGRAM</span>
                  </div>
                  <div className="text-sm font-bold text-white font-heading">
                    {cert.courseTitle}
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    STCW Code: <span className="text-sky-300 font-bold">{cert.courseCode || 'STCW'}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1.5">
                    <Calendar className="h-3.5 w-3.5 text-sky-400" />
                    <span>VALIDITY PERIOD & CLAIMS</span>
                  </div>
                  <div className="text-xs font-mono space-y-1">
                    <div>Issued: <span className="text-white font-bold">{cert.issueDate || 'N/A'}</span></div>
                    <div>Expires: <span className="text-white font-bold">{cert.expiryDate || 'N/A'}</span></div>
                    {cert.scheduledClaimDate && (
                      <div>Claim Date: <span className="text-sky-300">{cert.scheduledClaimDate}</span></div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1.5">
                    <Building2 className="h-3.5 w-3.5 text-sky-400" />
                    <span>SECURITY & ISSUING AUTHORITY</span>
                  </div>
                  <div className="text-xs font-bold text-white mb-1">
                    {cert.centerName || 'NEWSIM Maritime Training Center'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    Hash: <span className="text-emerald-400">{cert.verificationHash || 'SHA-256-AUTHENTIC'}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Serial: <span className="text-white font-bold">{cert.certificateNo}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Legal / Verification Scope Disclaimer */}
            <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-3.5 text-[11px] text-slate-400 font-sans leading-relaxed">
              <span className="font-semibold text-slate-300">Official Notice:</span> This verification system confirms the authenticity and current accreditation status of the STCW certificate record registered with NEWSIM Maritime Training Institute. It confirms the validity of the certificate in the registry and does not verify the physical identity of the bearer presenting this document.
            </div>

            {/* Official Compliance Footer Notice */}
            <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-500 gap-2">
              <div>Compliant with MARINA STCW 1978 as amended regulations</div>
              <div className="text-slate-400">NEWSIM Institutional Registry Database</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
