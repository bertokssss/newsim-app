'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Filter,
  Search,
  BookOpen,
  ShieldCheck,
  Building2,
  Info
} from 'lucide-react';
import { TablePageSkeleton } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface AttendanceRecord {
  id: string;
  date: string;
  sessionCode: string;
  courseId: string | null;
  courseCode: string;
  courseTitle: string;
  batchName: string;
  instructorName: string;
  room: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'NOT_MARKED';
  remarks: string;
}

interface AttendanceSummary {
  attendanceRate: string;
  attendanceRateNum: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  notMarkedCount: number;
  totalSessions: number;
  meetsCompliance: boolean;
}

export default function AttendanceClient() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/trainee/attendance')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setRecords(json.data.records || []);
          setSummary(json.data.summary || null);
        }
      })
      .catch((err) => console.error('Failed to load trainee attendance:', err))
      .finally(() => setLoading(false));
  }, []);

  const courses = Array.from(
    new Set(records.map((r) => r.courseTitle).filter(Boolean))
  );

  const filteredRecords = records.filter((r) => {
    const matchesStatus =
      statusFilter === 'ALL' || (r.status || '').toUpperCase() === statusFilter.toUpperCase();
    const matchesCourse =
      courseFilter === 'ALL' || r.courseTitle === courseFilter;
    const matchesSearch =
      search === '' ||
      (r.courseTitle || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.sessionCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.room || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.remarks && r.remarks.toLowerCase().includes(search.toLowerCase()));

    return matchesStatus && matchesCourse && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            PRESENT
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            LATE (75% Credit)
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            ABSENT
          </span>
        );
      case 'EXCUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
            <ShieldCheck className="w-3 h-3" />
            EXCUSED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <HelpCircle className="w-3 h-3" />
            PENDING ROLL-CALL
          </span>
        );
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
        <div className="relative z-10 space-y-2 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-slate-200/80 dark:border-slate-800">
              STCW Contact-Hour Audit
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Personal Record
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Official Attendance & Training History
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] font-sans leading-relaxed">
            Review verified roll-call records submitted by certified course instructors.
            STCW compliance mandates a minimum of 80% contact-hour attendance to sit for practical simulator assessments and receive course certification.
          </p>
        </div>
      </motion.div>

      {/* Telemetry Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Attendance Rate */}
        <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400">
              Attendance Rate
            </span>
            <CalendarCheck2 className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            {summary ? summary.attendanceRate : '--'}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono">
            {summary?.meetsCompliance ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> STCW Compliant (≥80%)
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Below Threshold (&lt;80%)
              </span>
            )}
          </div>
        </div>

        {/* Present Sessions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-emerald-200/70 dark:border-emerald-900/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              Present
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            {summary ? summary.presentCount : 0}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
            Full contact credit
          </div>
        </div>

        {/* Late Sessions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-amber-200/70 dark:border-amber-900/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300">
              Late
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            {summary ? summary.lateCount : 0}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
            75% contact credit
          </div>
        </div>

        {/* Excused Sessions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-blue-200/70 dark:border-blue-900/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-300">
              Excused
            </span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            {summary ? summary.excusedCount : 0}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
            Excluded from base
          </div>
        </div>

        {/* Absences */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-rose-200/70 dark:border-rose-900/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/10 text-rose-700 dark:text-rose-300">
              Absences
            </span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
            {summary ? summary.absentCount : 0}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
            0% contact credit
          </div>
        </div>
      </div>

      {/* Compliance Information Alert */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-[#CBD5E1] flex items-start gap-3">
        <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900 dark:text-[#F8FAFC]">
            Maritime Institutional Policy on Course Attendance & Contact Hours
          </p>
          <p className="text-[11px] leading-relaxed">
            Per approved NEWSIM Training Regulations, attendance is recorded per session by the assigned instructor.
            Unrecorded or pending roll-calls are displayed as &quot;Pending Roll-Call&quot; and are never treated as absences.
            In accordance with STCW Section A-I/12, trainees who accumulate unexcused absences resulting in less than 80% attendance cannot be issued valid training certificates.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {courses.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-mono font-bold uppercase text-slate-400">Course:</label>
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-[#F8FAFC] outline-none"
              >
                <option value="ALL">All Enrolled Courses</option>
                {courses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 overflow-x-auto">
            {['ALL', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search session code or remarks..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none"
          />
        </div>
      </div>

      {/* Attendance History Table */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: easeCurve }}
        className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-900/60 text-slate-500 dark:text-[#CBD5E1] font-mono text-[11px] uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4 pl-6">Training Date</th>
                <th className="py-3.5 px-4">Course Program & Batch</th>
                <th className="py-3.5 px-4">Session & Room</th>
                <th className="py-3.5 px-4">Attendance Status</th>
                <th className="py-3.5 px-4">Instructor Remarks</th>
                <th className="py-3.5 px-4 pr-6 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <TablePageSkeleton rows={5} columns={6} showHeader={false} />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No attendance records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4 pl-6 font-bold text-slate-900 dark:text-[#F8FAFC]">
                      {r.date || 'Scheduled'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-sans font-bold text-slate-900 dark:text-[#F8FAFC]">
                        {r.courseTitle}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {r.courseCode} {r.batchName ? `• ${r.batchName}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-sky-600 dark:text-sky-400">
                        {r.sessionCode}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {r.room}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(r.status)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-[#CBD5E1] font-sans text-xs max-w-xs">
                      {r.remarks || 'Standard roll-call record.'}
                    </td>
                    <td className="py-3.5 px-4 pr-6 text-right text-[10px] text-slate-400 font-sans">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Recorded
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
