'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarCheck2,
  Search,
  Calendar,
  Clock,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  X,
  FileCheck,
  Eye,
  BookOpen,
  Users,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function AttendanceClient() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [sessionFilter, setSessionFilter] = useState('ALL');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Lookups
  const [schedules, setSchedules] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Session Inspector Modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedSessionCourseId, setSelectedSessionCourseId] = useState<string>('ALL');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessionRosterSearch, setSessionRosterSearch] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('ALL');

  // Audit / Modify Modal
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('PRESENT');
  const [reason, setReason] = useState('');
  const [submittingAudit, setSubmittingAudit] = useState(false);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (debouncedSearch) query.set('search', debouncedSearch);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (courseFilter !== 'ALL') query.set('courseId', courseFilter);
      if (sessionFilter !== 'ALL') query.set('scheduleId', sessionFilter);

      const res = await fetch(`/api/admin/attendance?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setRecords(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [debouncedSearch, statusFilter, courseFilter, sessionFilter]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [schedRes, coursesRes] = await Promise.all([
          fetch('/api/admin/schedules'),
          fetch('/api/admin/courses?limit=200'),
        ]);
        const [schedJson, coursesJson] = await Promise.all([schedRes.json(), coursesRes.json()]);
        if (schedJson.success) setSchedules(schedJson.data || []);
        if (coursesJson.success) setCourses(coursesJson.data || []);
      } catch (err) {
        console.error('Failed to load lookups:', err);
      }
    };
    loadLookups();
  }, []);

  // Filtered schedules for session dropdowns based on course
  const availableSchedulesForFilter = useMemo(() => {
    if (courseFilter === 'ALL') return schedules;
    return schedules.filter(
      (s) => s.courseId === courseFilter || s.courseCode?.toLowerCase() === courseFilter.toLowerCase()
    );
  }, [schedules, courseFilter]);

  const availableSchedulesForModal = useMemo(() => {
    if (selectedSessionCourseId === 'ALL') return schedules;
    return schedules.filter(
      (s) =>
        s.courseId === selectedSessionCourseId ||
        s.courseCode?.toLowerCase() === selectedSessionCourseId.toLowerCase()
    );
  }, [schedules, selectedSessionCourseId]);

  // When opening session modal or changing course in modal, ensure a valid session is selected
  const handleOpenSessionModal = (courseId?: string, scheduleId?: string) => {
    const targetCourse = courseId || courseFilter || 'ALL';
    setSelectedSessionCourseId(targetCourse);

    let targetSession = scheduleId || '';
    if (!targetSession) {
      const matching =
        targetCourse === 'ALL'
          ? schedules
          : schedules.filter(
              (s) =>
                s.courseId === targetCourse ||
                s.courseCode?.toLowerCase() === targetCourse.toLowerCase()
            );
      if (matching.length > 0) {
        targetSession = matching[0].id;
      }
    }
    setSelectedSessionId(targetSession);
    setSessionRosterSearch('');
    setSessionStatusFilter('ALL');
    setSessionModalOpen(true);
  };

  // Active session object in modal
  const activeModalSession = useMemo(() => {
    return schedules.find((s) => s.id === selectedSessionId) || null;
  }, [schedules, selectedSessionId]);

  // Trainees roster in the selected session
  const sessionTraineeRoster = useMemo(() => {
    if (!selectedSessionId && selectedSessionCourseId === 'ALL') return records;
    return records.filter((r) => {
      const matchSession = selectedSessionId ? r.scheduleId === selectedSessionId || r.sessionCode === activeModalSession?.sessionCode : true;
      const matchCourse =
        selectedSessionCourseId !== 'ALL'
          ? r.courseId === selectedSessionCourseId ||
            r.courseCode?.toLowerCase() === selectedSessionCourseId.toLowerCase()
          : true;
      return matchSession && matchCourse;
    });
  }, [records, selectedSessionId, selectedSessionCourseId, activeModalSession]);

  // Filtered session roster by search and status
  const filteredSessionRoster = useMemo(() => {
    return sessionTraineeRoster.filter((r) => {
      if (sessionStatusFilter !== 'ALL' && r.status !== sessionStatusFilter) return false;
      if (sessionRosterSearch) {
        const q = sessionRosterSearch.toLowerCase();
        const traineeName = (r.traineeName || '').toLowerCase();
        const traineeSrn = (r.traineeSrn || '').toLowerCase();
        const remarks = (r.remarks || '').toLowerCase();
        return traineeName.includes(q) || traineeSrn.includes(q) || remarks.includes(q);
      }
      return true;
    });
  }, [sessionTraineeRoster, sessionStatusFilter, sessionRosterSearch]);

  // Session roster stats
  const sessionStats = useMemo(() => {
    const total = sessionTraineeRoster.length;
    const present = sessionTraineeRoster.filter((r) => r.status === 'PRESENT').length;
    const late = sessionTraineeRoster.filter((r) => r.status === 'LATE').length;
    const absent = sessionTraineeRoster.filter((r) => r.status === 'ABSENT').length;
    const excused = sessionTraineeRoster.filter((r) => r.status === 'EXCUSED').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, late, absent, excused, rate };
  }, [sessionTraineeRoster]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmittingAudit(true);
    try {
      const res = await fetch(`/api/admin/attendance/${selectedRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, remarks: reason }),
      });
      if (res.ok) {
        setEditModalOpen(false);
        fetchAttendance();
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'Failed to update attendance status');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating attendance status');
    } finally {
      setSubmittingAudit(false);
    }
  };

  const exportSessionCsv = () => {
    if (!sessionTraineeRoster || sessionTraineeRoster.length === 0) {
      alert('No attendance records found for this session to export.');
      return;
    }
    const headers = [
      'Trainee Name',
      'SRN / Number',
      'Course Code',
      'Course Title',
      'Session Code',
      'Date',
      'Time',
      'Room',
      'Assigned Instructor',
      'Attendance Status',
      'Instructor Remarks / Notes',
    ];

    const rows = sessionTraineeRoster.map((t) => [
      `"${t.traineeName || ''}"`,
      `"${t.traineeSrn || ''}"`,
      `"${t.courseCode || ''}"`,
      `"${t.courseTitle || ''}"`,
      `"${t.sessionCode || ''}"`,
      `"${t.date || ''}"`,
      `"${t.startTime || ''} - ${t.endTime || ''}"`,
      `"${t.room || ''}"`,
      `"${t.instructorName || ''}"`,
      `"${t.status || ''}"`,
      `"${(t.remarks || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    const sessionLabel = activeModalSession?.sessionCode || selectedSessionCourseId || 'Session';
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Roster_${sessionLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                Classroom & Simulator Quorum
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-slate-800">
                Instructor-Logged Roll Call
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Training Attendance Operations
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl">
              Inspect session-by-session roll call rosters recorded by instructors (e.g., MARPOL, Bridge Simulator, Safety courses), monitor quorum compliance, and log audited status modifications.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/api/admin/reports?type=ATTENDANCE&format=csv"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/25 transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>
      </motion.div>

      {/* Filter and Search Bar with Course & Session Selectors */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trainee name, SRN, course title, code, session ID, room..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {/* Course Selector Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <select
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value);
                  setSessionFilter('ALL');
                }}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none max-w-[200px] truncate"
              >
                <option value="ALL">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `[${c.code}] ` : ''}{c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Session Selector Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none max-w-[220px] truncate"
              >
                <option value="ALL">All Sessions</option>
                {availableSchedulesForFilter.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sessionCode} • {s.date} ({s.room || 'Room'})
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {(courseFilter !== 'ALL' || sessionFilter !== 'ALL' || search || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setCourseFilter('ALL');
                  setSessionFilter('ALL');
                  setSearch('');
                  setStatusFilter('ALL');
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-mono text-slate-400 uppercase mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Status:
            </span>
            {['ALL', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-semibold uppercase whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Attendance Table */}
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
                <th className="py-3.5 px-4 font-bold">Date & Session</th>
                <th className="py-3.5 px-4 font-bold">Trainee</th>
                <th className="py-3.5 px-4 font-bold">Course Title</th>
                <th className="py-3.5 px-4 font-bold">Room & Instructor</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Remarks / Reason</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-1" /><div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono">
                    No attendance records found matching filters.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{r.date}</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{r.sessionCode}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          src={r.traineeAvatarUrl}
                          name={r.traineeName}
                          alt={r.traineeName || 'Trainee'}
                          className="w-8 h-8 rounded-xl"
                          fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-bold"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                            {r.traineeName}
                          </div>
                          {r.traineeSrn && (
                            <div className="text-[10px] text-slate-400 font-mono">SRN: {r.traineeSrn}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-1.5">
                        {r.courseCode && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                            {r.courseCode}
                          </span>
                        )}
                        <span className="truncate max-w-[220px]">{r.courseTitle}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-[#CBD5E1]">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{r.room || 'Training Hall'}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <UserAvatar
                          src={r.instructorAvatarUrl}
                          name={r.instructorName || 'Assigned Instructor'}
                          alt={r.instructorName || 'Assigned Instructor'}
                          className="w-4 h-4 rounded-md"
                          fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold"
                        />
                        <span>{r.instructorName || 'Assigned Instructor'}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-white/5 text-slate-400 font-sans">
                          Instructor Log
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                          r.status === 'PRESENT'
                            ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                            : r.status === 'LATE'
                            ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                            : r.status === 'EXCUSED'
                            ? 'bg-sky-500/15 text-sky-600 border border-sky-500/30'
                            : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 italic max-w-xs truncate">
                      {r.remarks || 'None'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Session Roster for this Course & Session */}
                        <button
                          onClick={() => handleOpenSessionModal(r.courseId, r.scheduleId)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                          title="View all trainees in this session"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Session</span>
                        </button>
                        {/* Modify / Audit Status Button */}
                        <button
                          onClick={() => {
                            setSelectedRecord(r);
                            setNewStatus(r.status);
                            setReason(r.remarks || '');
                            setEditModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-[#CBD5E1] font-mono text-[10px] font-bold transition-colors"
                          title="Audit / modify attendance status"
                        >
                          Audit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Modal 1: View Session Trainee Attendance Roster (Inspector) */}
      <AnimatePresence>
        {sessionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSessionModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              className="relative w-full max-w-4xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-5 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                      Session Trainee Attendance Roster
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Live attendance records logged by the assigned instructor.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSessionModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Course & Session Choosers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shrink-0">
                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1 font-bold">
                    Select Course
                  </label>
                  <select
                    value={selectedSessionCourseId}
                    onChange={(e) => {
                      const newCid = e.target.value;
                      setSelectedSessionCourseId(newCid);
                      const matching =
                        newCid === 'ALL'
                          ? schedules
                          : schedules.filter(
                              (s) =>
                                s.courseId === newCid ||
                                s.courseCode?.toLowerCase() === newCid.toLowerCase()
                            );
                      setSelectedSessionId(matching.length > 0 ? matching[0].id : '');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none text-xs font-semibold"
                  >
                    <option value="ALL">All Courses</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `[${c.code}] ` : ''}{c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1 font-bold">
                    Select Training Session
                  </label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none text-xs font-semibold"
                  >
                    {availableSchedulesForModal.length === 0 ? (
                      <option value="">No sessions scheduled</option>
                    ) : (
                      availableSchedulesForModal.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.sessionCode} • {s.date} ({s.courseCode || 'Course'} • {s.room || 'Room'})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Active Session Overview Card */}
              {activeModalSession ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          {activeModalSession.sessionCode}
                        </span>
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {activeModalSession.courseTitle || 'Training Course Session'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {activeModalSession.date}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {activeModalSession.startTime} - {activeModalSession.endTime}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {activeModalSession.room || 'Training Hall'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs flex items-center gap-2">
                        <UserAvatar
                          src={activeModalSession.instructorAvatarUrl}
                          name={activeModalSession.instructorName || 'Assigned Instructor'}
                          alt={activeModalSession.instructorName || 'Assigned Instructor'}
                          className="w-6 h-6 rounded-lg"
                          fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold"
                        />
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-mono block">Instructor</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {activeModalSession.instructorName || 'Assigned Instructor'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quorum & Attendance Breakdown Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-3 pt-3 border-t border-emerald-500/10 text-center">
                    <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">Total Trainees</div>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                        {sessionStats.total}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10">
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono uppercase">Present</div>
                      <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                        {sessionStats.present}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-500/10">
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono uppercase">Late</div>
                      <div className="text-base font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                        {sessionStats.late}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-500/10">
                      <div className="text-[10px] text-rose-600 dark:text-rose-400 font-mono uppercase">Absent</div>
                      <div className="text-base font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                        {sessionStats.absent}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-sky-500/10">
                      <div className="text-[10px] text-sky-600 dark:text-sky-400 font-mono uppercase">Excused</div>
                      <div className="text-base font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                        {sessionStats.excused}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-teal-500/10">
                      <div className="text-[10px] text-teal-600 dark:text-teal-400 font-mono uppercase">Compliance</div>
                      <div className="text-base font-extrabold text-teal-600 dark:text-teal-400 font-mono">
                        {sessionStats.rate}%
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Trainee Roster Search & Status Filter */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={sessionRosterSearch}
                    onChange={(e) => setSessionRosterSearch(e.target.value)}
                    placeholder="Filter trainee name or SRN in this session..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs outline-none"
                  />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {['ALL', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setSessionStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all ${
                        sessionStatusFilter === st
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trainee Roster Table (Scrollable) */}
              <div className="flex-1 overflow-y-auto min-h-[220px] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-mono uppercase text-[10px] tracking-wider z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Trainee Name</th>
                      <th className="py-2.5 px-3 font-bold">SRN / ID</th>
                      <th className="py-2.5 px-3 font-bold">Attendance Status</th>
                      <th className="py-2.5 px-3 font-bold">Instructor Remarks</th>
                      <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredSessionRoster.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 font-mono text-xs">
                          {selectedSessionId
                            ? 'No trainee attendance records logged for this session yet.'
                            : 'Please select a session from above to inspect the trainee attendance roster.'}
                        </td>
                      </tr>
                    ) : (
                      filteredSessionRoster.map((trainee) => (
                        <tr key={trainee.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-[#F8FAFC]">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                src={trainee.traineeAvatarUrl}
                                name={trainee.traineeName}
                                alt={trainee.traineeName || 'Trainee'}
                                className="w-6 h-6 rounded-lg"
                                fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[9px] font-bold"
                              />
                              <span>{trainee.traineeName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                            {trainee.traineeSrn || 'N/A'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                trainee.status === 'PRESENT'
                                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                  : trainee.status === 'LATE'
                                  ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                                  : trainee.status === 'EXCUSED'
                                  ? 'bg-sky-500/15 text-sky-600 border border-sky-500/30'
                                  : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                              }`}
                            >
                              {trainee.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 italic max-w-xs truncate">
                            {trainee.remarks || 'Recorded in roll call'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedRecord(trainee);
                                setNewStatus(trainee.status);
                                setReason(trainee.remarks || '');
                                setEditModalOpen(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-[10px] font-bold transition-colors"
                            >
                              Audit / Modify
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <span className="text-[11px] text-slate-400 font-mono">
                  Showing {filteredSessionRoster.length} of {sessionTraineeRoster.length} trainees
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportSessionCsv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/25 transition-all active:scale-[0.98]"
                  >
                    <Download className="w-3.5 h-3.5 text-white" />
                    <span>Export Session CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold text-xs hover:opacity-90 transition-opacity"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: Modify Attendance Record with Audit Justification */}
      <AnimatePresence>
        {editModalOpen && selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    Administrative Attendance Audit
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Audit log required for regulatory STCW compliance
                  </p>
                </div>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      src={selectedRecord.traineeAvatarUrl}
                      name={selectedRecord.traineeName}
                      alt={selectedRecord.traineeName || 'Trainee'}
                      className="w-8 h-8 rounded-xl"
                      fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-bold"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                        {selectedRecord.traineeName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {selectedRecord.courseTitle} ({selectedRecord.sessionCode})
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <UserAvatar
                      src={selectedRecord.instructorAvatarUrl}
                      name={selectedRecord.instructorName || 'Instructor'}
                      alt={selectedRecord.instructorName || 'Instructor'}
                      className="w-4 h-4 rounded-md"
                      fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold"
                    />
                    <span>Logged by Instructor: {selectedRecord.instructorName || 'Instructor'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1 font-bold">
                    Adjusted Attendance Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono font-bold"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="LATE">LATE</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="EXCUSED">EXCUSED (Medical / Authorized Leave)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1 font-bold">
                    Audit Justification / Authorized Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="State reason for administrative status adjustment (e.g. Authorized medical leave certificate submitted, simulator makeup session)..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[#CBD5E1] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAudit}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-md disabled:opacity-50"
                  >
                    {submittingAudit ? 'Logging...' : 'Confirm & Log Audit'}
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
