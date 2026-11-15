'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarCheck2,
  Search,
  CheckCircle2,
  Clock,
  Save,
  Check,
  AlertTriangle,
  Building2,
  Users,
  History,
  CheckCheck,
  XCircle,
  FileText,
  Lock,
  Unlock,
  AlertCircle,
  HelpCircle,
  RotateCcw
} from 'lucide-react';
import { TablePageSkeleton, ImmersiveChartFrame, UserAvatar } from '@newsim/ui';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];
const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

type AttendanceStatus = 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT' | null;

interface TraineeRosterItem {
  trainee_id: string;
  trainee_number?: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  rank?: string;
  status: AttendanceStatus;
  remarks: string;
  is_marked: boolean;
}

export default function AttendanceClient() {
  const [activeTab, setActiveTab] = useState<'ROLL_CALL' | 'HISTORY'>('ROLL_CALL');
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  
  // Options
  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  // Selection
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);

  // Session State
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [roster, setRoster] = useState<TraineeRosterItem[]>([]);
  const [stats, setStats] = useState<any>({
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    notMarked: 0,
    recordingCompletionRate: 0,
  });

  // Roll-call state: trainee_id -> { status: AttendanceStatus, remarks: string }
  const [rollCall, setRollCall] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Finalize confirmation modal
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // History Tab
  const [history, setHistory] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [chartInView, setChartInView] = useState(false);
  const [showChart, setShowChart] = useState(true);

  // 1. Fetch instructor options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        setOptionsLoading(true);
        const res = await fetch('/api/instructor/attendance/options');
        const json = await res.json();
        if (json.success && json.data) {
          const fetchedCourses = json.data.courses || [];
          const fetchedBatches = json.data.batches || [];
          const fetchedSchedules = json.data.schedules || [];

          setCourses(fetchedCourses);
          setBatches(fetchedBatches);
          setSchedules(fetchedSchedules);

          if (fetchedCourses.length > 0) {
            const firstCourseId = fetchedCourses[0].id;
            setSelectedCourseId(firstCourseId);

            // Filter batches for first course
            const courseBatches = fetchedBatches.filter((b: any) => b.course_id === firstCourseId);
            if (courseBatches.length > 0) {
              setSelectedBatchId(courseBatches[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load attendance options', err);
      } finally {
        setOptionsLoading(false);
      }
    }
    loadOptions();
  }, []);

  // Filter batches based on selected course
  const availableBatches = useMemo(() => {
    if (!selectedCourseId) return batches;
    return batches.filter((b: any) => b.course_id === selectedCourseId);
  }, [batches, selectedCourseId]);

  // When course changes, adjust batch selection if necessary
  const handleCourseChange = (newCourseId: string) => {
    setSelectedCourseId(newCourseId);
    const matchingBatches = batches.filter((b: any) => b.course_id === newCourseId);
    if (matchingBatches.length > 0) {
      setSelectedBatchId(matchingBatches[0].id);
    } else {
      setSelectedBatchId('');
    }
  };

  // Practical session dates strictly based on the assigned course's practical_days
  // Attendance roll-call applies strictly to practical sessions per course / package policy
  const practicalSessionDates = useMemo(() => {
    const currentCourse = courses.find((c: any) => c.id === selectedCourseId);
    if (!currentCourse) return [];

    const durationHours = Number(currentCourse.duration_hours || 40);
    const durationDays = Math.max(1, Math.ceil(durationHours / 8));
    const theoryDays = Number(currentCourse.theory_days ?? (durationDays === 1 ? 1 : Math.max(1, Math.round(durationDays * 0.4))));
    const practicalDaysCount = Math.max(0, Number(currentCourse.practical_days ?? Math.max(0, durationDays - theoryDays)));

    if (practicalDaysCount === 0) {
      return [];
    }

    // 1. Check if there are schedules with specific dates for this course
    const courseScheds = schedules.filter((s: any) => s.course_id === selectedCourseId && s.start_at);
    const schedDateSet = new Set<string>();
    courseScheds.forEach((s: any) => {
      const dt = s.start_at.split('T')[0];
      if (dt) schedDateSet.add(dt);
    });

    // 2. Check selected batch or available batch start_date
    const currentBatch = availableBatches.find((b: any) => b.id === selectedBatchId) || availableBatches[0];
    if (currentBatch?.start_date) {
      const bStart = new Date(currentBatch.start_date);
      const cur = new Date(bStart);
      // Advance past theoryDays (excluding Sundays) so practical sessions begin on the practical training dates
      let theoryCount = 0;
      while (theoryCount < theoryDays) {
        if (cur.getDay() !== 0) {
          theoryCount++;
        }
        cur.setDate(cur.getDate() + 1);
      }
      while (cur.getDay() === 0) {
        cur.setDate(cur.getDate() + 1);
      }

      // Record exact practicalDaysCount session dates
      let pracCount = 0;
      while (pracCount < practicalDaysCount) {
        if (cur.getDay() !== 0) {
          schedDateSet.add(cur.toISOString().split('T')[0]);
          pracCount++;
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    const sorted = Array.from(schedDateSet).sort();
    if (sorted.length >= practicalDaysCount) {
      // Pick the first practicalDaysCount dates
      return sorted.slice(0, practicalDaysCount).map((dStr, idx) => ({
        date: dStr,
        label: `Practical Day ${idx + 1} of ${practicalDaysCount} (${dStr})`,
        dayNumber: idx + 1,
        totalDays: practicalDaysCount,
      }));
    }

    // If scheduled dates are fewer than required practical days, generate the exact practicalDaysCount sequence starting from batch date or today
    const baseDate = currentBatch?.start_date ? new Date(currentBatch.start_date) : new Date();
    let cur = new Date(baseDate);
    let tCount = 0;
    while (tCount < theoryDays) {
      if (cur.getDay() !== 0) tCount++;
      cur.setDate(cur.getDate() + 1);
    }
    while (cur.getDay() === 0) cur.setDate(cur.getDate() + 1);

    const generated: Array<{ date: string; label: string; dayNumber: number; totalDays: number }> = [];
    while (generated.length < practicalDaysCount) {
      if (cur.getDay() !== 0) {
        const iso = cur.toISOString().split('T')[0];
        generated.push({
          date: iso,
          label: `Practical Day ${generated.length + 1} of ${practicalDaysCount} (${iso})`,
          dayNumber: generated.length + 1,
          totalDays: practicalDaysCount,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    return generated;
  }, [selectedCourseId, selectedBatchId, schedules, availableBatches, courses]);

  // Current date formatted in Manila timezone for lock enforcement
  const todayDateStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  }, []);

  // Synchronize sessionDate when practicalSessionDates changes
  useEffect(() => {
    if (practicalSessionDates.length > 0) {
      const exists = practicalSessionDates.some((p) => p.date === sessionDate);
      if (!exists) {
        // Prioritize today if matching a practical date, or latest elapsed date <= today, or first practical date
        const matchToday = practicalSessionDates.find((p) => p.date === todayDateStr);
        if (matchToday) {
          setSessionDate(matchToday.date);
        } else {
          const pastDates = practicalSessionDates.filter((p) => p.date <= todayDateStr);
          if (pastDates.length > 0) {
            setSessionDate(pastDates[pastDates.length - 1].date);
          } else {
            setSessionDate(practicalSessionDates[0].date);
          }
        }
      }
    }
  }, [practicalSessionDates, sessionDate, todayDateStr]);

  // 2. Fetch roster when course, batch, or sessionDate changes
  useEffect(() => {
    if (!selectedCourseId) return;

    async function loadSessionRoster() {
      try {
        setSessionLoading(true);
        setErrorMessage(null);
        setSaveSuccessMessage(null);

        const params = new URLSearchParams({
          courseId: selectedCourseId,
          sessionDate: sessionDate,
        });
        if (selectedBatchId) {
          params.append('batchId', selectedBatchId);
        }

        const res = await fetch(`/api/instructor/attendance/session?${params.toString()}`);
        const json = await res.json();

        if (json.success && json.data) {
          setSessionInfo(json.data.session);
          const rosterData: TraineeRosterItem[] = json.data.roster || [];
          setRoster(rosterData);

          // Build rollCall map from fetched roster - BLANK BY DEFAULT (status can be null!)
          const newRoll: Record<string, { status: AttendanceStatus; remarks: string }> = {};
          rosterData.forEach((item) => {
            newRoll[item.trainee_id] = {
              status: item.status, // null if unrecorded!
              remarks: item.remarks || '',
            };
          });
          setRollCall(newRoll);

          if (json.data.stats) {
            setStats(json.data.stats);
          }
        } else {
          setErrorMessage(json.error || 'Failed to load session roster.');
          setRoster([]);
        }
      } catch (err) {
        console.error('Error fetching roster', err);
        setErrorMessage('Failed to connect to attendance service.');
      } finally {
        setSessionLoading(false);
      }
    }

    loadSessionRoster();
  }, [selectedCourseId, selectedBatchId, sessionDate]);

  // 3. Load attendance history when history tab is activated
  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetch('/api/instructor/attendance')
        .then((r) => r.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setHistory(json.data);
          }
        })
        .catch((err) => console.error('Failed to load history', err));
    }
  }, [activeTab]);

  // State flags for session locking and date restrictions
  const isFinalized = sessionInfo?.status === 'FINALIZED';
  const isFutureDate = Boolean(sessionDate && sessionDate > todayDateStr);
  const isReadOnly = isFinalized || isFutureDate;

  // Status marking handler
  const handleStatusChange = (traineeId: string, status: AttendanceStatus) => {
    if (isReadOnly) return; // Read-only if finalized or future training date
    setRollCall((prev) => ({
      ...prev,
      [traineeId]: {
        ...prev[traineeId],
        status,
      },
    }));
  };

  // Remark change handler
  const handleRemarksChange = (traineeId: string, remarks: string) => {
    if (isReadOnly) return;
    setRollCall((prev) => ({
      ...prev,
      [traineeId]: {
        ...prev[traineeId],
        remarks,
      },
    }));
  };

  // Bulk action: Mark All Present
  const handleMarkAllPresent = () => {
    if (isReadOnly) return;
    setRollCall((prev) => {
      const updated = { ...prev };
      roster.forEach((t) => {
        updated[t.trainee_id] = {
          ...updated[t.trainee_id],
          status: 'PRESENT',
        };
      });
      return updated;
    });
  };

  // Bulk action: Reset all to blank (unmarked)
  const handleResetToBlank = () => {
    if (isReadOnly) return;
    setRollCall((prev) => {
      const updated = { ...prev };
      roster.forEach((t) => {
        updated[t.trainee_id] = {
          ...updated[t.trainee_id],
          status: null,
        };
      });
      return updated;
    });
  };

  // Compute live stats from rollCall
  const computedStats = useMemo(() => {
    const total = roster.length;
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;
    let notMarked = 0;

    roster.forEach((t) => {
      const st = rollCall[t.trainee_id]?.status;
      if (st === 'PRESENT') present++;
      else if (st === 'LATE') late++;
      else if (st === 'ABSENT') absent++;
      else if (st === 'EXCUSED') excused++;
      else notMarked++;
    });

    const marked = total - notMarked;
    const recordingCompletionRate = total > 0 ? Math.round((marked / total) * 100) : 100;
    const quorumRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return {
      total,
      present,
      late,
      absent,
      excused,
      notMarked,
      marked,
      recordingCompletionRate,
      quorumRate,
    };
  }, [roster, rollCall]);

  const attendanceChartData = useMemo(() => [
    { name: 'Present', count: computedStats.present, color: '#10b981' },
    { name: 'Late', count: computedStats.late, color: '#f59e0b' },
    { name: 'Excused', count: computedStats.excused, color: '#0ea5e9' },
    { name: 'Absent', count: computedStats.absent, color: '#f43f5e' },
    { name: 'Unmarked', count: computedStats.notMarked, color: '#a855f7' },
  ], [computedStats]);

  // 4. Save Draft Attendance
  const handleSaveDraft = async () => {
    if (isFutureDate) {
      setErrorMessage('Cannot record attendance in advance for future training dates.');
      return;
    }
    try {
      setSavingAttendance(true);
      setErrorMessage(null);
      setSaveSuccessMessage(null);

      const records = Object.entries(rollCall).map(([traineeId, val]) => ({
        traineeId,
        status: val.status,
        remarks: val.remarks,
      }));

      const res = await fetch('/api/instructor/attendance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          batchId: selectedBatchId || null,
          sessionDate: sessionDate,
          attendanceRecords: records,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSaveSuccessMessage('Attendance roster saved successfully as draft.');
        if (json.data?.session) {
          setSessionInfo(json.data.session);
        }
        setTimeout(() => setSaveSuccessMessage(null), 4000);
      } else {
        setErrorMessage(json.error || 'Failed to save attendance roster.');
      }
    } catch (err: any) {
      setErrorMessage('Network error while saving attendance.');
    } finally {
      setSavingAttendance(false);
    }
  };

  // 5. Finalize Attendance Session
  const handleFinalizeSession = async (acknowledgeUnmarked = false) => {
    if (isFutureDate) {
      setErrorMessage('Cannot finalize attendance in advance for future training dates.');
      return;
    }
    try {
      setFinalizing(true);
      setErrorMessage(null);

      // Save records first
      const records = Object.entries(rollCall).map(([traineeId, val]) => ({
        traineeId,
        status: val.status,
        remarks: val.remarks,
      }));

      const saveRes = await fetch('/api/instructor/attendance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          batchId: selectedBatchId || null,
          sessionDate: sessionDate,
          attendanceRecords: records,
        }),
      });

      const saveJson = await saveRes.json();
      if (!saveJson.success) {
        setErrorMessage(saveJson.error || 'Failed to save session before finalizing.');
        setFinalizing(false);
        return;
      }

      const sessionId = saveJson.data?.session?.id || sessionInfo?.id;

      // Call finalize endpoint
      const finalizeRes = await fetch('/api/instructor/attendance/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          courseId: selectedCourseId,
          batchId: selectedBatchId || saveJson.data?.batchId || null,
          sessionDate,
          acknowledgeUnmarked,
        }),
      });

      const finalizeJson = await finalizeRes.json();

      if (finalizeJson.requiresAcknowledgment && !acknowledgeUnmarked) {
        // Open confirmation modal
        setShowFinalizeModal(true);
      } else if (finalizeJson.success) {
        setSessionInfo(finalizeJson.data?.session || { ...sessionInfo, status: 'FINALIZED' });
        setShowFinalizeModal(false);
        setSaveSuccessMessage('Attendance session has been officially finalized and locked.');
        setTimeout(() => setSaveSuccessMessage(null), 5000);
      } else {
        setErrorMessage(finalizeJson.error || 'Failed to finalize attendance session.');
      }
    } catch (err) {
      setErrorMessage('Network error while finalizing session.');
    } finally {
      setFinalizing(false);
    }
  };

  const filteredHistory = history.filter((h) => {
    const matchesSearch =
      (h.traineeName || '').toLowerCase().includes(search.toLowerCase()) ||
      (h.sessionCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (h.courseTitle || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = historyStatusFilter === 'ALL' || h.status === historyStatusFilter;
    return matchesSearch && matchesStatus;
  });

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
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                Course-Specific Quorum & Attendance
              </span>
              {isFinalized ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Finalized Session
                </span>
              ) : isFutureDate ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Upcoming Date (Locked)
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Training Session Attendance Roll-Call
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-2xl leading-relaxed font-sans">
              Conduct verified session roll-calls for maritime simulators and classroom lectures. Trainees start as unrecorded (blank). Mark explicitly as Present, Late, Excused, or Absent to record STCW training compliance.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center">
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 font-mono text-xs">
              <button
                onClick={() => setActiveTab('ROLL_CALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'ROLL_CALL'
                    ? 'bg-white dark:bg-slate-900/60 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Live Roll-Call
              </button>
              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'HISTORY'
                    ? 'bg-white dark:bg-slate-900/60 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Attendance Logs ({history.length})
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Alert Notices */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isFutureDate && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-mono flex items-start gap-2.5 animate-in fade-in">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold flex items-center gap-1.5">
              <span>Advance Attendance Marking Not Allowed</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/60 text-[10px]">LOCKED</span>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Training date ({sessionDate}) has not occurred yet. Per maritime LMS integrity policies, future attendance cannot be marked in advance. Recording unlocks on the scheduled practical training day.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'ROLL_CALL' ? (
        <>
          {/* Course, Batch, and Date Selectors */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {/* Course Selector */}
            <div>
              <label className="block text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1 font-bold">
                1. Select Course *
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => handleCourseChange(e.target.value)}
                disabled={optionsLoading}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono font-bold cursor-pointer"
              >
                {courses.length === 0 ? (
                  <option value="">No assigned courses</option>
                ) : (
                  courses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.code ? `[${c.code}] ` : ''}{c.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Batch Selector */}
            <div>
              <label className="block text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1 font-bold">
                2. Training Batch / Cohort
              </label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                disabled={optionsLoading || availableBatches.length === 0}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono font-bold cursor-pointer"
              >
                {availableBatches.length === 0 ? (
                  <option value="">All Cohorts for Course</option>
                ) : (
                  <>
                    <option value="">-- All Active Batches --</option>
                    {availableBatches.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_code || b.batch_number} {b.training_centers?.name ? `(${b.training_centers.name})` : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Session Date: Exact Scheduled Practical Dates */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold">
                  3. Practical Training Date *
                </label>
                <span className="text-[9px] font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                  {practicalSessionDates.length > 0 ? `${practicalSessionDates[0].totalDays} Practical Days` : 'Theory Only'}
                </span>
              </div>
              {practicalSessionDates.length > 0 ? (
                <select
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono font-bold cursor-pointer focus:border-sky-500"
                >
                  {practicalSessionDates.map((p) => (
                    <option key={p.date} value={p.date}>
                      {p.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-[11px] font-mono">
                  No Practical Days (Theory Course)
                </div>
              )}
            </div>

            {/* Actions: Save Draft or Finalize */}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingAttendance || sessionLoading || isReadOnly || roster.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-sky-600" />
                <span>{savingAttendance ? 'Saving...' : 'Save Draft'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleFinalizeSession(false)}
                disabled={finalizing || sessionLoading || isReadOnly || roster.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isFinalized ? 'Finalized' : isFutureDate ? 'Future Date' : 'Finalize'}</span>
              </button>
            </div>
          </div>

          {/* Practical Sessions Day Navigator */}
          {practicalSessionDates.length > 0 ? (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Scheduled Practical Sessions ({practicalSessionDates[0].totalDays} Days):
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {practicalSessionDates.map((item) => {
                    const isSelected = item.date === sessionDate;
                    const itemIsFuture = item.date > todayDateStr;
                    const itemIsToday = item.date === todayDateStr;
                    return (
                      <button
                        key={item.date}
                        type="button"
                        onClick={() => setSessionDate(item.date)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-sky-600 text-white shadow-xs'
                            : itemIsFuture
                            ? 'bg-slate-50/70 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900'
                        }`}
                      >
                        {itemIsFuture && <Lock className="w-3 h-3 text-amber-500/80" />}
                        <span>Day {item.dayNumber} ({item.date})</span>
                        {itemIsToday && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                            Today
                          </span>
                        )}
                        {itemIsFuture && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-normal">
                            Upcoming
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <span className="text-[10px] text-slate-500 max-w-md">
                Attendance is recorded strictly on the {practicalSessionDates[0].totalDays} scheduled practical training days. Absence (-15 pts) and late (-5 pts) penalties apply toward the 60% practical competency requirement.
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-2 text-xs font-mono text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>This assigned course consists of theoretical/classroom lecture only (0 practical days). Attendance roll-call applies to practical simulator and drill sessions.</span>
            </div>
          )}

          {/* Completion Progress & Quorum Summary Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">Recording Completion Rate:</span>
                <span className="text-sky-600 dark:text-sky-400 font-extrabold text-sm">
                  {computedStats.recordingCompletionRate}%
                </span>
                <span className="text-slate-400 text-[11px]">
                  ({computedStats.marked} of {computedStats.total} marked)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Quorum Rate:</span>
                <span className={`font-bold text-xs ${computedStats.quorumRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {computedStats.quorumRate}% (STCW Minimum: 80%)
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  computedStats.recordingCompletionRate === 100
                    ? 'bg-emerald-500'
                    : computedStats.recordingCompletionRate > 50
                    ? 'bg-sky-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${computedStats.recordingCompletionRate}%` }}
              />
            </div>

            {/* Counter badges */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Total Trainees</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{computedStats.total}</span>
              </div>

              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase block font-semibold">Present</span>
                <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">{computedStats.present}</span>
              </div>

              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-center">
                <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase block font-semibold">Late</span>
                <span className="text-base font-extrabold text-amber-700 dark:text-amber-300">{computedStats.late}</span>
              </div>

              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-center">
                <span className="text-[10px] text-rose-600 dark:text-rose-400 uppercase block font-semibold">Absent</span>
                <span className="text-base font-extrabold text-rose-700 dark:text-rose-300">{computedStats.absent}</span>
              </div>

              <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 text-center">
                <span className="text-[10px] text-sky-600 dark:text-sky-400 uppercase block font-semibold">Excused</span>
                <span className="text-base font-extrabold text-sky-700 dark:text-sky-300">{computedStats.excused}</span>
              </div>

              <div className={`p-2 rounded-xl border text-center ${
                computedStats.notMarked > 0
                  ? 'bg-purple-50 dark:bg-sky-500/15 border-purple-200 dark:border-purple-800/60'
                  : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
              }`}>
                <span className={`text-[10px] uppercase block font-semibold ${computedStats.notMarked > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
                  Not Marked
                </span>
                <span className={`text-base font-extrabold ${computedStats.notMarked > 0 ? 'text-purple-700 dark:text-purple-300' : 'text-slate-400'}`}>
                  {computedStats.notMarked}
                </span>
              </div>
            </div>

            {/* Interactive Session Quorum Telemetry Visualizer */}
            {computedStats.total > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                onViewportEnter={() => setChartInView(true)}
                className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Live Session Roll-Call Distribution
                  </span>
                  <span className="text-slate-400">
                    {computedStats.quorumRate}% Current Quorum
                  </span>
                </div>
                <div className="h-32 w-full">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${selectedCourseId}-${selectedBatchId}-${sessionDate}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.35, ease: easeOutCurve }}
                      className="w-full h-full"
                    >
                      <ImmersiveChartFrame
                        ready={!optionsLoading && !sessionLoading}
                        triggerKey={`att-${selectedCourseId}-${selectedBatchId}-${sessionDate}`}
                        duration={1.8}
                        className="w-full h-full"
                      >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attendanceChartData} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const item = payload[0].payload;
                                return (
                                  <div className="p-2 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-xl text-xs space-y-0.5 font-mono">
                                    <div className="font-bold text-sky-400">{item.name}</div>
                                    <div className="text-slate-300 font-bold">{item.count} Trainees</div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1750} animationEasing="ease-out">
                            {attendanceChartData.map((entry, index) => (
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
            )}
          </div>

          {/* Quick Bulk Actions */}
          {!isReadOnly && roster.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs font-mono">
              <span className="text-slate-500 dark:text-slate-400">
                Quick Mark Actions:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 font-bold hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={handleResetToBlank}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Blank</span>
                </button>
              </div>
            </div>
          )}

          {/* Roster Table */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, ease: easeCurve }}
            className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                  Enrolled Course Trainees ({roster.length})
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80 font-semibold">
                  Course Filter Applied
                </span>
              </div>

              {isFinalized ? (
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  Session Locked (Finalized)
                </span>
              ) : isFutureDate ? (
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  Session Locked (Future Date)
                </span>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-[#CBD5E1] font-mono uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Trainee Seafarer</th>
                    <th className="py-3.5 px-4 font-bold">Trainee #</th>
                    <th className="py-3.5 px-4 font-bold text-center">Status (Blank by Default)</th>
                    <th className="py-3.5 px-4 font-bold">Session Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {sessionLoading || optionsLoading ? (
                    <tr>
                      <td colSpan={4} className="p-4">
                        <TablePageSkeleton rows={5} columns={4} showHeader={false} />
                      </td>
                    </tr>
                  ) : roster.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400 font-mono">
                        No trainees currently enrolled in this course and batch.
                      </td>
                    </tr>
                  ) : (
                    roster.map((t) => {
                      const currentStatus = rollCall[t.trainee_id]?.status ?? null;
                      const isMarked = currentStatus !== null;

                      return (
                        <tr key={t.trainee_id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-[#F8FAFC]">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar
                                src={t.avatarUrl}
                                name={t.name}
                                alt={t.name || 'Trainee'}
                                className="w-8 h-8 rounded-xl"
                                fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-bold"
                              />
                              <div className="min-w-0">
                                <div>{t.name}</div>
                                <div className="text-[10px] font-mono text-slate-400 font-normal">{t.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-sky-600 dark:text-sky-400 font-bold">
                            {t.trainee_number || 'TRN-' + t.trainee_id.slice(0, 6).toUpperCase()}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 font-mono">
                              {/* Option 1: Unmarked pill */}
                              <button
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => handleStatusChange(t.trainee_id, null)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                                  !isMarked
                                    ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-500'
                                    : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                                }`}
                                title="Leave as Unmarked / Blank"
                              >
                                {!isMarked ? 'Not Marked' : '—'}
                              </button>

                              {/* Standard Statuses */}
                              {(['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'] as const).map((st) => {
                                const isSelected = currentStatus === st;
                                let activeClass = '';
                                if (isSelected) {
                                  if (st === 'PRESENT') activeClass = 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500';
                                  else if (st === 'LATE') activeClass = 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-500';
                                  else if (st === 'EXCUSED') activeClass = 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-500';
                                  else if (st === 'ABSENT') activeClass = 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-500';
                                } else {
                                  activeClass = 'text-slate-400 hover:text-slate-800 dark:hover:text-white';
                                }

                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => handleStatusChange(t.trainee_id, st)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer disabled:cursor-not-allowed ${activeClass}`}
                                  >
                                    {st}
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <input
                              type="text"
                              disabled={isReadOnly}
                              value={rollCall[t.trainee_id]?.remarks || ''}
                              onChange={(e) => handleRemarksChange(t.trainee_id, e.target.value)}
                              placeholder="Session remarks..."
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] outline-none disabled:opacity-60"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      ) : (
        /* History Tab */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: easeCurve }}
          className="space-y-4"
        >
          {/* History Filters */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {['ALL', 'PRESENT', 'LATE', 'EXCUSED', 'ABSENT'].map((st) => (
                <button
                  key={st}
                  onClick={() => setHistoryStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all cursor-pointer ${
                    historyStatusFilter === st
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trainee name or session..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] outline-none"
              />
            </div>
          </div>

          {/* History Records Table */}
          <div className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                Historical Attendance Logs ({filteredHistory.length})
              </h3>
              <span className="text-xs font-mono text-slate-400">
                Audited STCW Training Logs
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-[#CBD5E1] font-mono uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Date</th>
                    <th className="py-3.5 px-4 font-bold">Course / Session</th>
                    <th className="py-3.5 px-4 font-bold">Trainee Seafarer</th>
                    <th className="py-3.5 px-4 font-bold">Marked Status</th>
                    <th className="py-3.5 px-4 font-bold">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-mono">
                        No recorded attendance history matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((h) => {
                      let badgeClass = '';
                      if (h.status === 'PRESENT') badgeClass = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
                      else if (h.status === 'LATE') badgeClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
                      else if (h.status === 'EXCUSED') badgeClass = 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30';
                      else if (h.status === 'ABSENT') badgeClass = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';

                      return (
                        <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {h.date}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-[#F8FAFC]">
                            {h.courseTitle || h.sessionCode}
                          </td>
                          <td className="py-3.5 px-4 text-slate-900 dark:text-white font-semibold">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                src={h.traineeAvatarUrl}
                                name={h.traineeName}
                                alt={h.traineeName || 'Trainee'}
                                className="w-7 h-7 rounded-lg"
                                fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                              />
                              <span>{h.traineeName}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeClass}`}>
                              {h.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs">
                            {h.remarks || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Confirmation Modal when finalizing with unmarked trainees */}
      <AnimatePresence>
        {showFinalizeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 font-sans"
            >
              <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold font-heading">
                  Unmarked Trainees Detected
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                There are <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">{computedStats.notMarked} trainee(s)</strong> who have not yet been marked in this session.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
                Finalizing will lock this session. Unrecorded trainees will remain unmarked (they will NOT be marked as absent unless explicitly chosen).
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowFinalizeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Return to Marking
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalizeSession(true)}
                  disabled={finalizing}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {finalizing ? 'Finalizing...' : 'Acknowledge & Finalize'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
