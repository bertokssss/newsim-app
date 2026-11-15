'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  Calendar,
  RefreshCw,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Layers,
  GraduationCap,
  Users,
  UserCheck,
  CreditCard,
  Building2,
  ArrowRight
} from 'lucide-react';
import { Button } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

const REPORT_TYPES = [
  { id: 'USER_REPORT', label: 'User Directory & Account Audit', icon: Users, desc: 'All registered trainees, instructors, and administrators', topBar: 'from-sky-500 to-sky-600' },
  { id: 'TRAINING_REPORT', label: 'Maritime Training Performance', icon: GraduationCap, desc: 'Course completions, pass rates, and session throughput', topBar: 'from-teal-500 to-emerald-500' },
  { id: 'ENROLLMENT_REPORT', label: 'Global Enrollment Pipeline', icon: Layers, desc: 'Applications, approved admissions, and campus cohorts', topBar: 'from-indigo-500 to-sky-500' },
  { id: 'ACCOUNT_LIFECYCLE', label: 'Account Governance & Lifecycle', icon: UserCheck, desc: 'Account origins, MFA adoption, and security audit records', topBar: 'from-purple-500 to-indigo-500' },
  { id: 'SECURITY_REPORT', label: 'Security Events & Threat Ledger', icon: ShieldCheck, desc: 'Lockouts, failed attempts, and MFA compliance', topBar: 'from-rose-500 to-amber-500' },
  { id: 'SYSTEM_REPORT', label: 'Infrastructure & Activity Logs', icon: FileText, desc: 'System governance events and configuration changes', topBar: 'from-amber-500 to-orange-500' },
];

export default function ReportsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') || searchParams.get('tab');

  const [selectedType, setSelectedType] = useState(() => {
    if (typeParam) {
      const match = REPORT_TYPES.find(
        (r) => r.id.toLowerCase() === typeParam.toLowerCase()
      );
      if (match) return match.id;
    }
    return 'USER_REPORT';
  });

  useEffect(() => {
    if (typeParam) {
      const match = REPORT_TYPES.find(
        (r) => r.id.toLowerCase() === typeParam.toLowerCase()
      );
      if (match && match.id !== selectedType) {
        setSelectedType(match.id);
      }
    }
  }, [typeParam]);

  const handleSelectType = (typeId: string) => {
    setSelectedType(typeId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', typeId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };
  const [timeRange, setTimeRange] = useState('30d');
  const [reportData, setReportData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/reports?type=${selectedType}&timeRange=${timeRange}`);
      const json = await res.json();
      if (json.success && json.data) {
        setReportData(json.data);
      }
    } catch (err) {
      console.error('Failed to load report', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedType, timeRange]);

  const handleExport = async (format = 'CSV') => {
    setIsExporting(true);
    setExportNotice(null);

    try {
      const res = await fetch('/api/super-admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: selectedType, format }),
      });
      const data = await res.json();
      if (data.success) {
        setExportNotice(`Export dispatched successfully. Audit log 'SUPER_ADMIN_EXPORTED_REPORT' recorded.`);
        
        if (reportData && reportData.records) {
          const records = reportData.records;
          const headers = Object.keys(records[0] || {}).join(',');
          const rows = records.map((r: any) => Object.values(r).map((v) => `"${v}"`).join(','));
          const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', `${selectedType.toLowerCase()}_${Date.now()}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const records = (reportData?.records || []).filter((r: any) => {
    if (!search) return true;
    return JSON.stringify(r).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.5, ease: easeCurve }}
        className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200"
      >
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-heading flex items-center gap-2">
            <span>System-Wide Reports & Exports</span>
            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/80">
              LEDGER
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Generate and export verified executive reports. All data exports are permanently logged to the security audit trail.
          </p>
        </div>

        <div className="relative z-10">
          <button
            onClick={() => handleExport('CSV')}
            disabled={isExporting}
            className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export as CSV'}</span>
          </button>
        </div>
      </motion.div>

      {exportNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 text-xs flex items-center justify-between font-medium"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            {exportNotice}
          </span>
          <button onClick={() => setExportNotice(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">✕</button>
        </motion.div>
      )}

      {/* Report Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORT_TYPES.map((rep, idx) => {
          const Icon = rep.icon;
          const isSelected = selectedType === rep.id;
          return (
            <motion.button
              key={rep.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: idx * 0.05, ease: easeCurve }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              onClick={() => handleSelectType(rep.id)}
              className={`relative p-4 rounded-2xl text-left border transition-all flex items-start gap-3.5 overflow-hidden cursor-pointer ${
                isSelected
                  ? 'bg-sky-50/60 dark:bg-sky-950/30 border-sky-500 shadow-xs ring-1 ring-sky-500/30'
                  : 'bg-white dark:bg-[#0c1a2c] border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold font-heading truncate ${isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-slate-900 dark:text-white'}`}>
                  {rep.label}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{rep.desc}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Report Parameters & Preview Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.45, ease: easeCurve }}
        className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs"
      >
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search report dataset..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-sky-500" /> Range:
          </span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500 font-mono cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 3 Months</option>
            <option value="1y">Full Year (2026)</option>
          </select>

          <Button variant="secondary" size="sm" onClick={fetchReport} disabled={isLoading} className="cursor-pointer border-slate-200 dark:border-slate-800">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* Dynamic Report Summary KPI Cards */}
      {reportData?.summary && Object.keys(reportData.summary).length > 0 && (() => {
        const summaryEntries = Object.entries(reportData.summary);
        const count = summaryEntries.length;
        const gridClass =
          count === 6 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' :
          count === 5 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' :
          count === 4 ? 'grid-cols-2 sm:grid-cols-4' :
          count === 3 ? 'grid-cols-1 sm:grid-cols-3' :
          count === 2 ? 'grid-cols-1 sm:grid-cols-2' :
          'grid-cols-2 sm:grid-cols-4';

        return (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeCurve }}
            className={`grid ${gridClass} gap-3`}
          >
            {summaryEntries.map(([key, val]: [string, any], idx: number) => {
              const spanClass = count === 5 && idx === 4 ? 'col-span-2 sm:col-span-1 lg:col-span-1' : '';
              const formattedLabel = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/24h/i, ' (24h)')
                .trim();

              return (
                <motion.div
                  key={key}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className={`p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs text-center ${spanClass}`}
                >
                  <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider block truncate">
                    {formattedLabel}
                  </span>
                  <div className="text-base sm:text-xl font-bold text-sky-600 dark:text-sky-400 mt-1 font-heading truncate">
                    {String(val)}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        );
      })()}

      {/* Live Report Dataset Table */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.5, ease: easeCurve }}
        className="rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs transition-colors duration-200"
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">{reportData?.title || 'Report View'}</h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Generated: {reportData?.generatedAt ? new Date(reportData.generatedAt).toLocaleString() : 'Loading...'}
            </span>
          </div>
          <div className="text-xs font-mono text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800/80 font-semibold">
            {records.length} records available
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-mono">
              No records match the current filter criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  {Object.keys(records[0] || {}).map((header) => (
                    <th key={header} className="py-3 px-4 capitalize">
                      {header.replace(/([A-Z])/g, ' $1')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {records.slice(0, 20).map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    {Object.values(row).map((val: any, valIdx: number) => (
                      <td key={valIdx} className="py-3 px-4 text-slate-800 dark:text-slate-200">
                        {String(val)}
                      </td>
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

