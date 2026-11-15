'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Search,
  Award,
  CheckCircle2,
  Clock,
  Download,
  QrCode,
  Building2,
  X,
  FileCheck,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Plus,
  Ban,
  ExternalLink,
  ShieldAlert,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import { useTheme, ImmersiveChartFrame, UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];
const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

const cascadeItem = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: easeOutCurve,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: {
      duration: 0.2,
      ease: easeOutCurve,
    },
  },
};

export default function CertificatesClient() {
  const { resolvedTheme } = useTheme();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [chartInView, setChartInView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Lookups
  const [trainees, setTrainees] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Modals
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<any | null>(null);

  // Form states
  const [issueForm, setIssueForm] = useState({ traineeId: '', courseId: '' });
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<any | null>(null);
  const [revokeReason, setRevokeReason] = useState('Administrative compliance revocation');
  const [submitting, setSubmitting] = useState(false);

  const certTelemetry = React.useMemo(() => {
    let claimed = 0;
    let issued = 0;
    let revoked = 0;
    certificates.forEach((c) => {
      const st = (c.status || '').toUpperCase();
      if (st === 'CLAIMED') claimed++;
      else if (st === 'REVOKED') revoked++;
      else issued++;
    });
    return [
      { name: 'Issued & Active', count: issued, color: '#10b981' },
      { name: 'Claimed by Trainee', count: claimed, color: '#0ea5e9' },
      { name: 'Revoked', count: revoked, color: '#f43f5e' },
    ];
  }, [certificates]);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (debouncedSearch) query.set('search', debouncedSearch);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);

      const res = await fetch(`/api/admin/certificates?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setCertificates(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [traineesRes, coursesRes] = await Promise.all([
          fetch('/api/admin/trainees?limit=100'),
          fetch('/api/admin/courses'),
        ]);
        const [traineesJson, coursesJson] = await Promise.all([
          traineesRes.ok ? traineesRes.json().catch(() => ({})) : Promise.resolve({}),
          coursesRes.ok ? coursesRes.json().catch(() => ({})) : Promise.resolve({}),
        ]);
        if (traineesJson?.success) setTrainees(traineesJson.data || []);
        if (coursesJson?.success) setCourses(coursesJson.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadLookups();
  }, []);

  const handleCheckEligibility = async (traineeId: string, courseId: string) => {
    if (!traineeId || !courseId) {
      setEligibilityResult(null);
      return;
    }
    try {
      setEligibilityLoading(true);
      const res = await fetch(
        `/api/admin/certificates/eligibility?traineeId=${traineeId}&courseId=${courseId}`
      );
      const json = await res.json();
      if (json.success) {
        setEligibilityResult(json);
      } else {
        setEligibilityResult(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEligibilityLoading(false);
    }
  };

  const handleIssueNewCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueForm.traineeId || !issueForm.courseId) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueForm),
      });
      const json = await res.json();
      if (json.success) {
        setIssueModalOpen(false);
        setIssueForm({ traineeId: '', courseId: '' });
        setEligibilityResult(null);
        fetchCertificates();
      } else {
        alert(json.error || 'Failed to issue certificate');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReissueCertificate = async (id: string) => {
    if (!confirm('Reissue certificate with new timestamp and version bump?')) return;
    try {
      await fetch(`/api/admin/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REISSUE' }),
      });
      fetchCertificates();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkClaimed = async (id: string) => {
    if (!confirm('Mark this certificate as claimed and physically released to trainee?')) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/admin/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLAIM' }),
      });
      const json = await res.json();
      if (json.success) {
        fetchCertificates();
      } else {
        alert(json.error || 'Failed to mark certificate as claimed');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCert) return;
    try {
      setSubmitting(true);
      await fetch(`/api/admin/certificates/${selectedCert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE', reason: revokeReason }),
      });
      setRevokeModalOpen(false);
      setSelectedCert(null);
      fetchCertificates();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
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
                Maritime Credentials
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              STCW Certificate Issuance & Verification
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl">
              Validate 6-step graduation criteria (training completion, practical exam, post-test, minimum attendance, payment settlement) and issue verifiable QR-encoded STCW certificates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setIssueForm({ traineeId: '', courseId: '' });
                setEligibilityResult(null);
                setIssueModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Issue Certificate</span>
            </button>
            <a
              href="/api/admin/reports?type=CERTIFICATES&format=csv"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all active:scale-[0.98] shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Download className="w-4 h-4 text-emerald-500" />
              <span>Export Ledger</span>
            </a>
          </div>
        </div>
      </motion.div>

      {/* Credential Lifecycle Telemetry Visualizer */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        onViewportEnter={() => setChartInView(true)}
        transition={{ duration: 0.45, ease: easeOutCurve }}
        className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                STCW Credential Lifecycle & Claim Distribution
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                Real-time ledger tracking active issuances, physically claimed certificates, and regulatory compliance revocations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Issued: {certTelemetry[0]?.count || 0}
            </span>
            <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" />
              Claimed: {certTelemetry[1]?.count || 0}
            </span>
            {certTelemetry[2]?.count > 0 && (
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#f43f5e]" />
                Revoked: {certTelemetry[2]?.count}
              </span>
            )}
          </div>
        </div>

        <div className="h-32 w-full pt-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={statusFilter}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: easeOutCurve }}
              className="w-full h-full"
            >
              <ImmersiveChartFrame
                ready={!loading}
                triggerKey={`certs-${statusFilter}-${chartInView ? 'in' : 'wait'}`}
                duration={1.8}
                className="w-full h-full"
              >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={certTelemetry} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={resolvedTheme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} fontFamily="monospace" tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} fontFamily="monospace" tickLine={false} width={130} />
                  <Tooltip
                    cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(16,185,129,0.06)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0]?.payload || {};
                      return (
                        <div className="rounded-xl bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-2.5 shadow-xl text-xs font-mono space-y-1">
                          <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                          <div className="font-bold" style={{ color: item.color }}>{item.count} Credential{item.count !== 1 ? 's' : ''}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Certificates"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={22}
                    isAnimationActive={true}
                    animationDuration={1750}
                    animationEasing="ease-out"
                  >
                    {certTelemetry.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </ImmersiveChartFrame>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search certificate number, trainee, verification code..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'ISSUED', 'ACTIVE', 'CLAIMED', 'REVOKED'].map((st) => (
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

      {/* Certificates Table */}
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
                <th className="py-3.5 px-4 font-bold">Certificate Number</th>
                <th className="py-3.5 px-4 font-bold">Seafarer Trainee</th>
                <th className="py-3.5 px-4 font-bold">STCW Program</th>
                <th className="py-3.5 px-4 font-bold">QR Verification Code</th>
                <th className="py-3.5 px-4 font-bold">Validity</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded mb-1" /><div className="h-3 w-44 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-6 w-28 bg-slate-100 dark:bg-slate-800/70 rounded-lg" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : certificates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono">
                    No certificates found.
                  </td>
                </tr>
              ) : (
                certificates.map((c) => (
                  <motion.tr
                    key={c.id}
                    variants={cascadeItem}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {c.certificateNo}
                      {c.reissuedCount > 0 && (
                        <span className="ml-1 text-[9px] px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1]">
                          v{c.reissuedCount + 1}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={c.traineeAvatarUrl}
                          name={c.traineeName}
                          className="w-8 h-8 rounded-xl text-[11px]"
                          fallbackClassName="bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-mono font-bold"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] truncate">{c.traineeName}</div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">{c.traineeEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {c.courseTitle}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <button
                        onClick={() => {
                          setSelectedCert(c);
                          setQrModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-bold transition-colors"
                        title="Click to verify credential"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{c.qrVerificationCode}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      <div>Issued: {c.issueDate}</div>
                      <div className="text-slate-400">Expires: {c.expiryDate}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                          c.status === 'CLAIMED'
                            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                            : c.status === 'ISSUED' || c.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                            : c.status === 'REVOKED'
                            ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                        }`}
                      >
                        {c.status === 'CLAIMED' && <CheckCircle2 className="w-3 h-3 text-sky-500" />}
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {c.status !== 'REVOKED' && (
                          <>
                            {c.status !== 'CLAIMED' && (
                              <button
                                onClick={() => handleMarkClaimed(c.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white font-mono text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                                title="Mark certificate as claimed"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Mark Claimed
                              </button>
                            )}
                            <button
                              onClick={() => handleReissueCertificate(c.id)}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-teal-500 hover:text-white font-mono text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                              title="Reissue certificate"
                            >
                              <RotateCcw className="w-3 h-3" /> Reissue
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCert(c);
                                setRevokeModalOpen(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-500/30 hover:bg-rose-600 hover:text-white font-mono text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                              title="Revoke certificate"
                            >
                              <Ban className="w-3 h-3" /> Revoke
                            </button>
                          </>
                        )}
                        {c.status === 'REVOKED' && (
                          <span className="text-[10px] font-mono text-rose-500 font-bold">
                            Revoked
                          </span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Modal 1: Issue New Certificate with Live Eligibility Checking */}
      <AnimatePresence>
        {issueModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIssueModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    Issue STCW Certificate
                  </h3>
                  <p className="text-xs text-slate-500">
                    Performs rigorous 6-step compliance verification prior to issuance.
                  </p>
                </div>
                <button
                  onClick={() => setIssueModalOpen(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleIssueNewCertificate} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                    Select Seafarer Trainee
                  </label>
                  <select
                    required
                    value={issueForm.traineeId}
                    onChange={(e) => {
                      const newTraineeId = e.target.value;
                      setIssueForm((prev) => ({ ...prev, traineeId: newTraineeId }));
                      handleCheckEligibility(newTraineeId, issueForm.courseId);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                  >
                    <option value="">-- Choose Trainee --</option>
                    {trainees.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} ({t.srn || t.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                    Select STCW Course
                  </label>
                  <select
                    required
                    value={issueForm.courseId}
                    onChange={(e) => {
                      const newCourseId = e.target.value;
                      setIssueForm((prev) => ({ ...prev, courseId: newCourseId }));
                      handleCheckEligibility(issueForm.traineeId, newCourseId);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                  >
                    <option value="">-- Choose Course --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `${c.code}: ` : ''}{c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Eligibility Checklist */}
                {eligibilityLoading && (
                  <div className="p-4 text-center font-mono text-slate-400 text-xs">
                    Evaluating STCW graduation criteria...
                  </div>
                )}

                {eligibilityResult && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                        Compliance Checklist
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          eligibilityResult.isEligible
                            ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                        }`}
                      >
                        {eligibilityResult.isEligible ? 'Eligible For Issuance' : 'Prerequisites Missing'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {eligibilityResult.checks?.map((chk: any) => (
                        <div
                          key={chk.id}
                          className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                            chk.passed
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-500/30 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {chk.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <div className="font-bold">{chk.name}</div>
                            <div className="text-[10px] opacity-80">{chk.message}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIssueModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[#CBD5E1] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (eligibilityResult && !eligibilityResult.isEligible)}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold shadow-md transition-all"
                  >
                    {submitting ? 'Issuing...' : 'Verify & Issue Certificate'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: QR Code Verification View */}
      <AnimatePresence>
        {qrModalOpen && selectedCert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setQrModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase tracking-wider">
                  Official Credential Verification
                </span>
                <button
                  onClick={() => setQrModalOpen(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Verified Certificate Card Representation */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-teal-500/30 space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs font-mono">
                    <ShieldCheck className="w-4 h-4" />
                    <span>AUTHENTIC STCW CREDENTIAL</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      selectedCert.status === 'ISSUED' || selectedCert.status === 'ACTIVE'
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'bg-rose-500/15 text-rose-600'
                    }`}
                  >
                    {selectedCert.status}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400">Certificate No</span>
                    <div className="font-mono font-bold text-slate-900 dark:text-[#F8FAFC] text-sm">
                      {selectedCert.certificateNo}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      src={selectedCert.traineeAvatarUrl}
                      name={selectedCert.traineeName}
                      className="w-9 h-9 rounded-xl text-xs"
                      fallbackClassName="bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-mono font-bold"
                    />
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400">Seafarer Trainee</span>
                      <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                        {selectedCert.traineeName}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400">STCW Certified Program</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                      {selectedCert.courseTitle}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400">Issued On:</span>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">{selectedCert.issueDate}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Valid Until:</span>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">{selectedCert.expiryDate}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between font-mono text-[10px] text-slate-400">
                  <span>Registry: NEWSIM Talisay Training Center</span>
                  <span className="text-teal-600 font-bold">{selectedCert.qrVerificationCode}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <a
                  href={`/api/admin/certificates/verify?code=${encodeURIComponent(selectedCert.certificateNo)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Inspect JSON Verification Payload</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: Revoke Certificate */}
      <AnimatePresence>
        {revokeModalOpen && selectedCert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setRevokeModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0c1a2c] border border-rose-500/30 rounded-3xl p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
                <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5" />
                  <span>Revoke STCW Credential</span>
                </div>
                <button
                  onClick={() => setRevokeModalOpen(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Revoking this certificate permanently invalidates its verification status in maritime authority records.
              </p>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs font-mono">
                <div className="font-bold text-slate-900 dark:text-white">{selectedCert.certificateNo}</div>
                <div className="text-slate-400">{selectedCert.traineeName} — {selectedCert.courseTitle}</div>
              </div>

              <form onSubmit={handleRevokeCertificate} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                    Revocation Justification / Reason
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    placeholder="Provide reason for STCW certificate revocation..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRevokeModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[#CBD5E1] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md transition-all"
                  >
                    {submitting ? 'Revoking...' : 'Confirm Revocation'}
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
