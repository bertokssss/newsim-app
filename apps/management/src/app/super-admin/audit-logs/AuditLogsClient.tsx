'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScrollText,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Globe,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import { Button, UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function AuditLogsClient() {
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Inspector Drawer
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/super-admin/audit-logs?search=${encodeURIComponent(search)}&role=${roleFilter}&action=${actionFilter}&severity=${severityFilter}&status=${statusFilter}&page=${pagination.page}&limit=${pagination.limit}`
      );
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [search, roleFilter, actionFilter, severityFilter, statusFilter, pagination.page]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/super-admin/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'CSV' }),
      });
      const json = await res.json();
      if (json.success) {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);

        const records = json.data || [];
        const headers = ['id', 'timestamp', 'actorEmail', 'actorRole', 'action', 'targetType', 'targetId', 'status', 'severity', 'ipAddress'].join(',');
        const rows = records.map((r: any) =>
          [r.id, r.timestamp, r.actorEmail, r.actorRole, r.action, r.targetType || '', r.targetId || '', r.status, r.severity, r.ipAddress]
            .map((v) => `"${v}"`)
            .join(',')
        );
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `audit_logs_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

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
            <span>Master Audit Ledger</span>
            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/80">
              IMMUTABLE
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Cryptographically sealed immutable ledger recording all privileged security operations and administrative actions.
          </p>
        </div>

        <div className="relative z-10">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Audit Log'}</span>
          </button>
        </div>
      </motion.div>

      {exportSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 text-xs flex items-center gap-2 font-medium"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Audit log exported to CSV. Event &apos;SUPER_ADMIN_EXPORTED_REPORT&apos; recorded in ledger.</span>
        </motion.div>
      )}

      {/* Multi-Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.45, ease: easeCurve }}
        className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between shadow-xs"
      >
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search actor, action, target, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Actions</option>
            <option value="LOGIN_">Logins</option>
            <option value="ADMIN_">Admin Events</option>
            <option value="INSTRUCTOR_">Instructor Events</option>
            <option value="MFA_">MFA Events</option>
            <option value="PERMISSION_">Permissions</option>
            <option value="SETTING">Settings</option>
            <option value="SESSION">Sessions</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
          </select>

          <Button variant="secondary" size="sm" onClick={fetchAuditLogs} disabled={isLoading} className="cursor-pointer border-slate-200 dark:border-slate-800">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* Audit Logs Table */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.5, ease: easeCurve }}
        className="rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs transition-colors duration-200"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target / Entity</th>
                <th className="py-3.5 px-4">Result</th>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 w-8 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No audit records match the current filter parameters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>

                    <td className="py-3 px-4 text-slate-900 dark:text-white font-medium max-w-[220px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          src={log.actorAvatarUrl}
                          name={log.actorName || log.actorEmail}
                          alt={log.actorName || log.actorEmail || 'Actor'}
                          className="w-7 h-7 rounded-lg"
                          fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                        />
                        <div className="min-w-0">
                          {log.actorName && (
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{log.actorName}</div>
                          )}
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{log.actorEmail}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-bold">
                      {log.actorRole}
                    </td>

                    <td className="py-3 px-4 text-sky-600 dark:text-sky-400 font-semibold">
                      {log.action}
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 truncate max-w-[160px]">
                      {log.targetId || log.targetType || 'N/A'}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80' : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/80'
                      }`}>
                        {log.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        log.severity === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/80'
                          : log.severity === 'WARNING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/80'
                          : 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/80'
                      }`}>
                        {log.severity}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="h-7 text-xs text-sky-600 dark:text-sky-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} audit events
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="h-7 text-xs px-2 cursor-pointer border-slate-200 dark:border-slate-800"
            >
              Previous
            </Button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="h-7 text-xs px-2 cursor-pointer border-slate-200 dark:border-slate-800"
            >
              Next
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Drawer: Detailed Audit Log Inspector */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedLog(null)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }} className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border-l border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-10 text-slate-900 dark:text-white overflow-y-auto flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Terminal className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">{selectedLog.action}</h3>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">ID: {selectedLog.id}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white" aria-label="Close inspector">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase">Actor</span>
                    <div className="flex items-center gap-2.5 mt-1 min-w-0">
                      <UserAvatar
                        src={selectedLog.actorAvatarUrl}
                        name={selectedLog.actorName || selectedLog.actorEmail}
                        alt={selectedLog.actorName || selectedLog.actorEmail || 'Actor'}
                        className="w-8 h-8 rounded-lg"
                        fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                      />
                      <div className="min-w-0">
                        {selectedLog.actorName && (
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{selectedLog.actorName}</div>
                        )}
                        <div className="font-mono text-slate-600 dark:text-slate-300 truncate">{selectedLog.actorEmail}</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase">Actor Role</span>
                    <div className="font-mono text-slate-900 dark:text-white mt-0.5">{selectedLog.actorRole}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase">Target Entity</span>
                    <div className="font-mono text-slate-900 dark:text-white mt-0.5">{selectedLog.targetType || 'N/A'} : {selectedLog.targetId || 'N/A'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase">Status & Severity</span>
                    <div className="font-mono text-slate-900 dark:text-white mt-0.5">{selectedLog.status} • {selectedLog.severity}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1 text-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase">Source Telemetry</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300">IP: {selectedLog.ipAddress}</div>
                  <div className="font-mono text-slate-500 dark:text-slate-400 text-[11px] truncate">Agent: {selectedLog.userAgent}</div>
                  <div className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">Time: {new Date(selectedLog.timestamp).toISOString()}</div>
                </div>

                {/* Sanitized JSON Payload */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono">Sanitized Event Metadata</span>
                  <pre className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 font-mono text-xs text-sky-600 dark:text-sky-300 overflow-x-auto">
                    {JSON.stringify(selectedLog.details || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="pt-6">
                <Button variant="ghost" onClick={() => setSelectedLog(null)} className="w-full">
                  Close Inspector
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

