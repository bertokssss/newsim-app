'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Download,
  Users,
  FileSpreadsheet,
  CreditCard,
  CalendarCheck2,
  ShieldCheck,
  CalendarDays,
  FileText,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { hasModulePermission } from '@newsim/utils';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

const reportCategories = [
  { id: 'TRAINEES', requiredPermission: 'ENROLLMENT_VIEW', title: 'Trainees Roster', description: 'Seafarer directory, rank, vessel type, campus, and attendance ratings.', icon: Users, gradient: 'from-emerald-500 to-teal-500' },
  { id: 'ENROLLMENTS', requiredPermission: 'ENROLLMENT_VIEW', title: 'Enrollment Pipeline', description: 'Active cohort applications, approved admissions, and payment state.', icon: FileSpreadsheet, gradient: 'from-teal-500 to-cyan-500' },
  { id: 'PAYMENTS', requiredPermission: 'PAYMENT_VIEW', title: 'Payment Ledger', description: 'Settled transactions, QR Ph reference codes, and tuition totals.', icon: CreditCard, gradient: 'from-emerald-500 to-amber-500' },
  { id: 'ATTENDANCE', requiredPermission: 'ATTENDANCE_VIEW', title: 'Attendance Logs', description: 'Daily session roll calls, punctuality, and audited status modifications.', icon: CalendarCheck2, gradient: 'from-sky-500 to-indigo-500' },
  { id: 'CERTIFICATES', requiredPermission: 'CERTIFICATE_VIEW', title: 'Certificates Ledger', description: 'Issued credentials, expiration dates, and QR verification codes.', icon: ShieldCheck, gradient: 'from-teal-500 to-emerald-500' },
  { id: 'SCHEDULES', requiredPermission: 'SCHEDULE_VIEW', title: 'Training Schedules', description: 'Classroom and simulator timetable sessions and instructor assignments.', icon: CalendarDays, gradient: 'from-indigo-500 to-purple-500' },
];

export default function ReportsClient() {
  const [selectedReport, setSelectedReport] = useState('TRAINEES');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [userRole, setUserRole] = useState<string>('ADMIN');

  useEffect(() => {
    let active = true;
    const loadPermissions = async () => {
      try {
        const res = await fetch('/api/auth/me?portal=admin', { cache: 'no-store' });
        const json = await res.json();
        if (!active) return;
        if (res.ok && json.success && json.user) {
          setPermissions(Array.isArray(json.user.permissions) ? json.user.permissions : []);
          setUserRole(json.user.role || 'ADMIN');
        }
      } catch {
        // Keep defaults on transient error
      }
    };
    loadPermissions();
    window.addEventListener('newsim:permissions-updated', loadPermissions);
    return () => {
      active = false;
      window.removeEventListener('newsim:permissions-updated', loadPermissions);
    };
  }, []);

  const visibleCategories = reportCategories.filter((cat) =>
    permissions === null
      ? cat.id !== 'PAYMENTS'
      : hasModulePermission(permissions, cat.requiredPermission, userRole)
  );
  const canViewPayments = visibleCategories.some((cat) => cat.id === 'PAYMENTS');
  const isSelectedVisible = visibleCategories.some((cat) => cat.id === selectedReport);

  useEffect(() => {
    if (permissions !== null && visibleCategories.length > 0 && !isSelectedVisible) {
      setSelectedReport(visibleCategories[0].id);
    }
  }, [permissions, visibleCategories, isSelectedVisible]);

  const fetchReport = async (type: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/reports?type=${type}`);
      const json = await res.json();
      if (json.success) {
        setReportData(json);
      } else {
        setReportData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSelectedVisible) return;
    fetchReport(selectedReport);
  }, [selectedReport, isSelectedVisible]);

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
                Operational Reports
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Training Operations Reporting & CSV Exporters
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl">
              {canViewPayments
                ? 'Extract detailed operational datasets for maritime audits, compliance verification, financial reconciliation, and cohort graduation tracking.'
                : 'Extract permitted operational datasets for maritime audits, compliance verification, and cohort graduation tracking.'}
            </p>
          </div>

          {isSelectedVisible && (
            <a
              href={`/api/admin/reports?type=${selectedReport}&format=csv`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>Download Selected CSV</span>
            </a>
          )}
        </div>
      </motion.div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleCategories.map((cat, idx) => {
          const Icon = cat.icon;
          const isSelected = selectedReport === cat.id;

          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, ease: easeCurve, delay: idx * 0.04 }}
              whileHover={{ y: -2 }}
              onClick={() => setSelectedReport(cat.id)}
              className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-white dark:bg-[#0c1a2c] border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-white/60 dark:bg-[#0c1a2c] border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 hover:bg-white dark:hover:bg-[#09090c]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${cat.gradient} text-white flex items-center justify-center shadow-md`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                      ACTIVE PREVIEW
                    </span>
                  )}
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-3">
                  {cat.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#CBD5E1] mt-1">
                  {cat.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">CSV / JSON Format</span>
                <span className="text-slate-400">Instant Export →</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Live Data Preview Table */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: easeCurve }}
        className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
              {reportData?.reportTitle || 'Report Preview'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#CBD5E1] font-mono">
              Generated: {reportData?.generatedAt ? new Date(reportData.generatedAt).toLocaleString() : 'Live'} • {reportData?.rowCount || 0} Records
            </p>
          </div>

          <a
            href={`/api/admin/reports?type=${selectedReport}&format=csv`}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-xs font-mono font-bold transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
              ))}
            </div>
          ) : !reportData?.data || reportData.data.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-mono text-xs">
              No records available for this report type.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-[#CBD5E1] font-mono uppercase text-[10px]">
                <tr>
                  {Object.keys(reportData.data[0]).map((key) => (
                    <th key={key} className="py-2.5 px-3 font-bold">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {reportData.data.slice(0, 10).map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    {Object.values(row).map((val: any, vIdx: number) => (
                      <td key={vIdx} className="py-2.5 px-3 truncate max-w-xs">{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
}

