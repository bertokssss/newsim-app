'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Search,
  Plus,
  Clock,
  Building2,
  Users,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  Sparkles,
  BarChart3,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { useTheme, ImmersiveChartFrame, UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];
const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
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
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: easeOutCurve,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.98,
    transition: {
      duration: 0.22,
      ease: easeOutCurve,
    },
  },
};

function computeEndDate(startDateStr: string, totalDays: number): string {
  if (!startDateStr) return '';
  const parts = startDateStr.split('-');
  if (parts.length !== 3) return startDateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return startDateStr;
  const dateObj = new Date(Date.UTC(y, m, d));
  const daysToAdd = Math.max(0, (totalDays || 1) - 1);
  dateObj.setUTCDate(dateObj.getUTCDate() + daysToAdd);
  const ey = dateObj.getUTCFullYear();
  const em = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const ed = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${ey}-${em}-${ed}`;
}

export default function SchedulesClient() {
  const { resolvedTheme } = useTheme();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [filterMode, setFilterMode] = useState<'UPCOMING' | 'ALL'>('UPCOMING');
  const [roomChartInView, setRoomChartInView] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    courseId: '',
    instructorId: '',
    room: 'Bridge Simulator Alpha',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00 AM',
    endTime: '12:00 PM',
    capacity: '24',
  });

  const [approvedLeaves, setApprovedLeaves] = useState<any[]>([]);
  const [substituteModalOpen, setSubstituteModalOpen] = useState(false);
  const [targetScheduleForSubstitute, setTargetScheduleForSubstitute] = useState<any | null>(null);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState('');
  const [submittingSubstitute, setSubmittingSubstitute] = useState(false);
  const [substituteError, setSubstituteError] = useState<string | null>(null);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (statusFilter !== 'ALL') query.set('status', statusFilter);

      const res = await fetch(`/api/admin/schedules?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSchedules(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [statusFilter]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [coursesRes, instructorsRes, leavesRes] = await Promise.all([
          fetch('/api/admin/courses'),
          fetch('/api/admin/instructors'),
          fetch('/api/admin/leaves?status=APPROVED').catch(() => ({ json: () => ({ success: false, data: [] }) })),
        ]);
        const [coursesJson, instructorsJson, leavesJson] = await Promise.all([
          coursesRes.json(),
          instructorsRes.json(),
          leavesRes.json(),
        ]);
        if (coursesJson.success) {
          setCourses(coursesJson.data || []);
          if (!formData.courseId && coursesJson.data?.[0]?.id) {
            setFormData((prev) => ({ ...prev, courseId: coursesJson.data[0].id }));
          }
        }
        if (instructorsJson.success) {
          setInstructors(instructorsJson.data || []);
          if (!formData.instructorId && instructorsJson.data?.[0]?.id) {
            setFormData((prev) => ({ ...prev, instructorId: instructorsJson.data[0].id }));
          }
        }
        if (leavesJson.success) {
          setApprovedLeaves(leavesJson.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadLookups();
  }, []);

  const [submitting, setSubmitting] = useState(false);

  const handleOpenSubstituteModal = (sched: any) => {
    setTargetScheduleForSubstitute(sched);
    setSelectedSubstituteId(sched.substituteInstructorId || '');
    setSubstituteError(null);
    setSubstituteModalOpen(true);
  };

  const handleSaveSubstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetScheduleForSubstitute) return;
    if (!selectedSubstituteId) {
      setSubstituteError('Please select a substitute instructor.');
      return;
    }
    setSubmittingSubstitute(true);
    setSubstituteError(null);
    try {
      const res = await fetch(`/api/admin/schedules/${targetScheduleForSubstitute.id}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ substituteInstructorId: selectedSubstituteId }),
      });
      const json = await res.json();
      if (json.success) {
        setSubstituteModalOpen(false);
        setSuccessNotification(json.message || 'Substitute instructor assigned successfully.');
        setTimeout(() => setSuccessNotification(null), 5000);
        await fetchSchedules();
      } else {
        setSubstituteError(json.error || 'Failed to assign substitute instructor');
        // Refresh in case the change was persisted before a network error occurred
        fetchSchedules().catch(() => {});
      }
    } catch (err) {
      console.error(err);
      setSubstituteError('Error assigning substitute instructor');
    } finally {
      setSubmittingSubstitute(false);
    }
  };

  const handleRemoveSubstitute = async () => {
    if (!targetScheduleForSubstitute) return;
    setSubmittingSubstitute(true);
    setSubstituteError(null);
    try {
      const res = await fetch(`/api/admin/schedules/${targetScheduleForSubstitute.id}/substitute`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setSubstituteModalOpen(false);
        setSuccessNotification('Substitute instructor assignment removed.');
        setTimeout(() => setSuccessNotification(null), 5000);
        await fetchSchedules();
      } else {
        setSubstituteError(json.error || 'Failed to remove substitute instructor');
      }
    } catch (err) {
      console.error(err);
      setSubstituteError('Error removing substitute instructor');
    } finally {
      setSubmittingSubstitute(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    if (!formData.instructorId) {
      setConflictError('Please select an instructor to assign to this course.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setCreateModalOpen(false);
        const count = json.activatedTraineesCount;
        setSuccessNotification(
          count && count > 0
            ? `Course assigned successfully! Initiated active course progress for ${count} enrolled trainee${count > 1 ? 's' : ''}.`
            : 'Course successfully assigned to instructor and schedule registered.'
        );
        setTimeout(() => setSuccessNotification(null), 6000);
        setFormData((prev) => ({
          ...prev,
          room: 'Bridge Simulator Alpha',
          date: new Date().toISOString().split('T')[0],
          startTime: '08:00 AM',
          endTime: '12:00 PM',
          capacity: '24',
        }));
        await fetchSchedules();
      } else {
        setConflictError(json.error || 'Conflict detected');
      }
    } catch (err) {
      console.error(err);
      setConflictError('Failed to assign course. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this training schedule?')) return;
    try {
      const res = await fetch(`/api/admin/schedules/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchSchedules();
      } else {
        alert(json.error || 'Failed to cancel schedule');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this assigned course schedule?')) return;
    try {
      const res = await fetch(`/api/admin/schedules/${id}?permanent=true`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchSchedules();
      } else {
        alert(json.error || 'Failed to delete schedule');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessNotification(`Schedule session marked as ${newStatus}.`);
        setTimeout(() => setSuccessNotification(null), 4000);
        await fetchSchedules();
      } else {
        alert(json.error || 'Failed to update schedule status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isSessionCompletedOrPast = (s: any) => {
    const statusUpper = (s.status || '').toUpperCase();
    if (statusUpper === 'COMPLETED' || statusUpper === 'CANCELLED') return true;
    if (s.isCompleted === true) return true;
    if (s.endAt && new Date(s.endAt) < new Date()) return true;
    const targetDate = s.endDate || s.date;
    if (targetDate) {
      const sessionDate = new Date(targetDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (sessionDate < today) {
        return true;
      }
    }
    return false;
  };

  const displayedSchedules = React.useMemo(() => {
    if (filterMode === 'UPCOMING') {
      return schedules.filter((s) => !isSessionCompletedOrPast(s));
    }
    return schedules;
  }, [schedules, filterMode]);

  // Compute room suite telemetry
  const roomTelemetry = React.useMemo(() => {
    const counts: Record<string, number> = {};
    displayedSchedules.forEach((s) => {
      const r = s.room || 'General Classroom';
      counts[r] = (counts[r] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name: name.replace('Simulator', 'Sim.').replace('Bridge', 'Brdg.'),
      fullName: name,
      count,
    }));
  }, [displayedSchedules]);

  const ongoingCourseIds = new Set(
    schedules
      .filter((s) => s.status === 'ONGOING')
      .map((s) => s.courseId)
  );
  const isSelectedCourseOngoing = Boolean(formData.courseId && ongoingCourseIds.has(formData.courseId));

  const selectedCourse = courses.find((c) => c.id === formData.courseId);
  const selectedCourseCat = String(selectedCourse?.category || '').toLowerCase();
  const isSelectedCourseFullModular = Boolean(
    selectedCourse &&
      (selectedCourse.isFullModular ||
        selectedCourseCat.includes('in-house') ||
        selectedCourseCat.includes('in house') ||
        (selectedCourseCat.includes('modular') && !selectedCourseCat.includes('practical')) ||
        (selectedCourse.practicalDays !== undefined && Number(selectedCourse.practicalDays) === 0) ||
        (selectedCourse.practical_days !== undefined && Number(selectedCourse.practical_days) === 0))
  );
  const selectedDurationHours = Number(selectedCourse?.durationHours || selectedCourse?.duration_hours || 40);
  const selectedDurationDays = Math.max(1, Math.ceil(selectedDurationHours / 8));
  const selectedTheoryDays = isSelectedCourseFullModular
    ? Math.min(3, selectedDurationDays)
    : Number(selectedCourse?.theoryDays ?? selectedCourse?.theory_days ?? (selectedDurationDays === 1 ? 1 : Math.max(1, Math.round(selectedDurationDays * 0.4))));
  const selectedPracticalDays = isSelectedCourseFullModular
    ? 0
    : Number(selectedCourse?.practicalDays ?? selectedCourse?.practical_days ?? (selectedDurationDays === 1 ? 0 : Math.max(0, selectedDurationDays - selectedTheoryDays)));
  const selectedTotalDays = Math.max(1, selectedTheoryDays + selectedPracticalDays);
  const calculatedEndDate = computeEndDate(formData.date, selectedTotalDays);

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
                Course Assignment & Timetable
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Course Assignment & Timetable Operations
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl">
              Assign STCW/IMO courses to instructors and schedule simulation suites. Assigning a course automatically initiates learning progress and unlocks modules for all enrolled trainees.
            </p>
          </div>

          <button
            onClick={() => {
              setConflictError(null);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Course to Instructor</span>
          </button>
        </div>
      </motion.div>

      {/* Success Notification Alert */}
      <AnimatePresence>
        {successNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-mono flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold">{successNotification}</span>
            </div>
            <button
              onClick={() => setSuccessNotification(null)}
              className="text-emerald-700 dark:text-emerald-300 hover:opacity-75 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulation Suite Allocation Telemetry Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        onViewportEnter={() => setRoomChartInView(true)}
        transition={{ duration: 0.45, ease: easeOutCurve }}
        className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                Simulation Suite & Classroom Allocation Telemetry
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                Active suite scheduling across bridge, engine room, and ECDIS maritime simulator facilities.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono">
              <button
                type="button"
                onClick={() => setFilterMode('UPCOMING')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterMode === 'UPCOMING'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ✦ Upcoming Only
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterMode === 'ALL'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All History
              </button>
            </div>
          </div>
        </div>

        {/* Room Telemetry BarChart */}
        {roomTelemetry.length > 0 && (
          <div className="h-36 w-full pt-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${filterMode}-${statusFilter}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.35, ease: easeOutCurve }}
                className="w-full h-full"
              >
                <ImmersiveChartFrame
                  ready={!loading}
                  triggerKey={`rooms-${filterMode}-${statusFilter}-${roomChartInView ? 'in' : 'wait'}`}
                  duration={1.8}
                  className="w-full h-full"
                >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={roomTelemetry} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={resolvedTheme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontFamily="monospace" tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} fontFamily="monospace" tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(2,132,199,0.06)' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const r = payload[0]?.payload || {};
                        return (
                          <div className="rounded-xl bg-white/95 dark:bg-[#0c1a2c]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-2.5 shadow-xl text-xs font-mono space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white">{r.fullName}</div>
                            <div className="text-sky-600 dark:text-sky-400 font-bold">{r.count} Assigned Session{r.count !== 1 ? 's' : ''}</div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="Assigned Sessions"
                      fill="#0284c7"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={32}
                      isAnimationActive={true}
                      animationDuration={1750}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
                </ImmersiveChartFrame>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {['ALL', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold uppercase whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            Showing <strong className="text-slate-900 dark:text-white">{displayedSchedules.length}</strong> {filterMode === 'UPCOMING' ? 'upcoming ' : ''}session{displayedSchedules.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Schedules Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="schedules-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                  <div className="h-5 w-20 bg-slate-100 dark:bg-slate-800/60 rounded-full" />
                </div>
                <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="space-y-2 pt-2">
                  <div className="h-3.5 w-48 bg-slate-100 dark:bg-slate-800/60 rounded" />
                  <div className="h-3.5 w-36 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : displayedSchedules.length === 0 ? (
          <motion.div
            key={`schedules-empty-${filterMode}-${statusFilter}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="py-16 text-center text-slate-400 font-mono text-xs rounded-3xl bg-white dark:bg-[#0c1a2c] border border-dashed border-slate-200 dark:border-slate-800 p-8"
          >
            {filterMode === 'UPCOMING'
              ? 'No upcoming training sessions found. Switch to "All History" to view completed and past schedules.'
              : 'No assigned courses or training schedules found.'}
          </motion.div>
        ) : (
          <motion.div
            key={`schedules-grid-${filterMode}-${statusFilter}-${displayedSchedules.length}`}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {displayedSchedules.map((s) => (
              <motion.div
                key={s.id}
                variants={cascadeItem}
                whileHover={{ y: -2 }}
                className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {s.sessionCode}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold hidden sm:inline">
                        Assigned Course
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      s.status === 'COMPLETED'
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                        : s.status === 'ONGOING'
                        ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                        : s.status === 'SCHEDULED'
                        ? 'bg-teal-500/15 text-teal-600 border border-teal-500/30'
                        : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                    }`}>
                      {s.status === 'COMPLETED' ? '✓ COMPLETED' : s.status}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-3">
                    {s.courseTitle}
                  </h3>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Schedule Period</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {s.totalDays || 1} Day{(s.totalDays || 1) > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block font-semibold">Date Started</span>
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC] text-[11px] leading-tight">
                              {s.startDate || s.date}
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block font-semibold">Date End</span>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px] leading-tight">
                              {s.endDate || computeEndDate(s.date || s.startDate, s.totalDays || 1)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="pt-1.5 mt-1 border-t border-slate-200/50 dark:border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                        <span>Daily Hours:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{s.startTime} - {s.endTime}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Enrolled Trainees</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                            Cohort Quorum
                          </span>
                        </div>
                        <div className="font-extrabold text-slate-900 dark:text-[#F8FAFC] text-base mt-0.5">
                          {s.enrolledCount} / {s.capacity}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {Math.max(0, s.capacity - s.enrolledCount)} seats available
                        </div>
                      </div>
                      <div className="pt-1.5 mt-1 border-t border-slate-200/50 dark:border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                        <span>Course Partition:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {s.theoryDays || 1}d Theory • {s.practicalDays || 0}d Practical
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-xs font-mono space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Room / Suite:</span>
                      <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{s.room}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">Assigned Instructor:</span>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          src={s.instructorAvatarUrl}
                          name={s.instructorName}
                          alt={s.instructorName || 'Instructor'}
                          className="w-5 h-5 rounded-md"
                          fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold"
                        />
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[140px]" title={s.instructorName}>
                          {s.instructorName}
                        </span>
                        <button
                          onClick={() => handleOpenSubstituteModal(s)}
                          className="px-2 py-0.5 rounded-lg bg-purple-500/10 hover:bg-purple-600 text-purple-700 dark:text-purple-300 hover:text-white border border-purple-500/30 text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                          title="Substitute or reassign instructor for this session"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Substitute</span>
                        </button>
                      </div>
                    </div>

                    {s.instructorOnLeave && (
                      <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Instructor on Leave ({s.leaveDetails?.startDate} to {s.leaveDetails?.endDate})</span>
                        </div>
                        {s.substituteInstructorId ? (
                          <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                src={s.substituteInstructorAvatarUrl}
                                name={s.substituteInstructorName}
                                alt={s.substituteInstructorName || 'Substitute Instructor'}
                                className="w-6 h-6 rounded-md"
                                fallbackClassName="bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[9px] font-bold"
                              />
                              <div className="min-w-0">
                                <span className="text-[9px] uppercase font-bold text-purple-600 dark:text-purple-400 block">Covered by Substitute:</span>
                                <strong className="text-purple-700 dark:text-purple-300 font-mono text-[11px] truncate block">{s.substituteInstructorName}</strong>
                              </div>
                            </div>
                            <button
                              onClick={() => handleOpenSubstituteModal(s)}
                              className="px-2 py-0.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold transition-all"
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-rose-600 dark:text-rose-400 block">Operation Alert:</span>
                              <span className="text-rose-700 dark:text-rose-300 text-[10px] font-bold">Substitute Needed!</span>
                            </div>
                            <button
                              onClick={() => handleOpenSubstituteModal(s)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] shadow-sm transition-all"
                            >
                              + Assign Substitute
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {!s.instructorOnLeave && s.substituteInstructorId && (
                      <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-[11px] p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar
                            src={s.substituteInstructorAvatarUrl}
                            name={s.substituteInstructorName}
                            alt={s.substituteInstructorName || 'Substitute Instructor'}
                            className="w-6 h-6 rounded-md"
                            fallbackClassName="bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[9px] font-bold"
                          />
                          <div className="min-w-0">
                            <span className="text-[9px] uppercase font-bold text-purple-600 dark:text-purple-400 block">Substitute Assigned:</span>
                            <strong className="text-purple-700 dark:text-purple-300 font-mono text-[11px] truncate block">{s.substituteInstructorName}</strong>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenSubstituteModal(s)}
                          className="px-2 py-0.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold transition-all"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">{s.centerName || 'Main Training Center'}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenSubstituteModal(s)}
                      className="px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-600 text-purple-700 dark:text-purple-300 hover:text-white border border-purple-500/30 text-[10px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                      title="Assign or Change Substitute Instructor"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Substitute</span>
                    </button>
                    {s.status !== 'CANCELLED' && s.status !== 'COMPLETED' ? (
                      <button
                        onClick={() => handleUpdateStatus(s.id, 'COMPLETED')}
                        className="px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white border border-blue-500/30 text-[10px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                        title="Mark schedule session as Completed"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Complete</span>
                      </button>
                    ) : s.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-mono font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    ) : null}
                    {s.status !== 'CANCELLED' && s.status !== 'COMPLETED' && (
                      <button
                        onClick={() => handleCancelSchedule(s.id)}
                        className="px-2 py-0.5 rounded text-[10px] text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-500/20 font-bold transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSchedule(s.id)}
                      className="px-2 py-0.5 rounded text-[10px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-500/20 font-bold transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Course Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setCreateModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">Assign Course to Instructor</h3>
                </div>
                <button disabled={submitting} onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informational Callout */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-mono space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Automatic Trainee Progress Activation</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-700/90 dark:text-emerald-300/90">
                  Assigning this course to the instructor will immediately initiate course progress and unlock training modules for all enrolled trainees.
                </p>
              </div>

              {isSelectedCourseOngoing && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-mono space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Course Currently Ongoing (Next Batch Blocked)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                    A training session for this course is currently ongoing. In compliance with maritime batch rules, the current batch must complete before the next batch can be scheduled.
                  </p>
                </div>
              )}

              {conflictError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{conflictError}</span>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Select Course *</label>
                  <select
                    required
                    value={formData.courseId}
                    onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                  >
                    <option value="">-- Select Course --</option>
                    {courses.map((c) => {
                      const isOngoing = ongoingCourseIds.has(c.id);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.code ? `${c.code}: ` : ''}{c.title || c.name}{isOngoing ? ' — [ONGOING SESSION]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Assigned Instructor *</label>
                    <select
                      required
                      value={formData.instructorId}
                      onChange={(e) => setFormData({ ...formData, instructorId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                    >
                      <option value="">-- Choose Instructor --</option>
                      {instructors.map((ins) => {
                        const id = ins.instructorId || ins.id;
                        const onLeave = approvedLeaves.find(
                          (l: any) =>
                            l.instructor_id === id &&
                            l.start_date <= calculatedEndDate &&
                            l.end_date >= formData.date
                        );
                        return (
                          <option key={id} value={id}>
                            {ins.name || `${ins.firstName || ''} ${ins.lastName || ''}`.trim()} ({ins.specialization || 'Instructor'})
                            {onLeave ? ` ⚠️ [ON LEAVE: ${onLeave.start_date} to ${onLeave.end_date}]` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {(() => {
                      const selLeave = approvedLeaves.find(
                        (l: any) =>
                          l.instructor_id === formData.instructorId &&
                          l.start_date <= calculatedEndDate &&
                          l.end_date >= formData.date
                      );
                      if (!selLeave) return null;
                      return (
                        <div className="mt-1.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-[10px] flex items-center gap-1.5 font-mono">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Instructor on approved leave ({selLeave.start_date} to {selLeave.end_date}). System blocks scheduling during leave.
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                      {isSelectedCourseFullModular ? 'Training Mode' : 'Classroom / Simulator Suite'}
                    </label>
                    {isSelectedCourseFullModular ? (
                      <div className="w-full px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[11px]">
                        Full Modular Online (No Practical Room)
                      </div>
                    ) : (
                      <input
                        type="text"
                        required
                        value={formData.room}
                        onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                        placeholder="e.g. Bridge Simulator Alpha"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                      />
                    )}
                  </div>
                </div>

                {!isSelectedCourseFullModular ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Practical Date (Day 1) *</label>
                        <input
                          type="date"
                          required
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Daily Start Time</label>
                        <select
                          value={formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                        >
                          <option>08:00 AM</option>
                          <option>10:00 AM</option>
                          <option>01:00 PM</option>
                          <option>03:00 PM</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Daily End Time</label>
                        <select
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                        >
                          <option>12:00 PM</option>
                          <option>02:00 PM</option>
                          <option>05:00 PM</option>
                          <option>07:00 PM</option>
                        </select>
                      </div>
                    </div>

                    {/* Course Finish Period Preview */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 uppercase text-[10px] font-bold">Calculated Course Finish Schedule</span>
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                          {selectedTotalDays} Day{selectedTotalDays > 1 ? 's' : ''} to Finish
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Date Started (Day 1)</span>
                          <strong className="text-slate-900 dark:text-white text-xs">{formData.date}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Date End (Completion)</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 text-xs">{calculatedEndDate}</strong>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200/40 dark:border-slate-800">
                        Course partition: <strong>{selectedTheoryDays} day(s)</strong> of theory modules + <strong>{selectedPracticalDays} day(s)</strong> of practical training ({selectedDurationHours}h total).
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-indigo-700 dark:text-indigo-300 uppercase text-[10px] font-bold">
                        Full Modular / In-House Course (No Practical Date)
                      </span>
                      <span className="px-2 py-0.5 rounded font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-[10px]">
                        0 Practical Days
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed pt-1 border-t border-indigo-200/50 dark:border-indigo-800/40">
                      This course is <strong>100% Modular</strong> (maximum {selectedTheoryDays}-day online completion window). No practical training date or physical attendance is generated; the assigned instructor acts strictly as the <strong>Academic Record Reviewer</strong>.
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[#CBD5E1] font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || isSelectedCourseOngoing}
                    className={`px-4 py-2 rounded-xl font-semibold shadow-md flex items-center gap-2 transition-all active:scale-[0.98] ${
                      isSelectedCourseOngoing
                        ? 'bg-amber-600/60 text-white cursor-not-allowed opacity-90'
                        : 'bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Assigning & Activating...</span>
                      </>
                    ) : isSelectedCourseOngoing ? (
                      <span>Course Ongoing — Next Batch Blocked</span>
                    ) : (
                      <span>Assign Course & Start Progress</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Substitute Instructor Modal */}
      <AnimatePresence>
        {substituteModalOpen && targetScheduleForSubstitute && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submittingSubstitute && setSubstituteModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              <div className="h-1.5 bg-sky-500 w-full shrink-0" />

              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <span>Assign Substitute Instructor</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Maintain training session continuity by assigning a verified substitute instructor.
                  </p>
                </div>
                <button
                  onClick={() => setSubstituteModalOpen(false)}
                  disabled={submittingSubstitute}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSubstitute} className="p-6 space-y-4 text-xs font-mono">
                {substituteError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{substituteError}</span>
                  </div>
                )}

                {/* Session Summary Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Course / Module:</span>
                    <strong className="text-slate-900 dark:text-[#F8FAFC]">{targetScheduleForSubstitute.courseTitle}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Schedule Period:</span>
                    <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                      {targetScheduleForSubstitute.startDate} to {targetScheduleForSubstitute.endDate}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Room / Suite:</span>
                    <span className="text-slate-700 dark:text-slate-300">{targetScheduleForSubstitute.room}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/40 dark:border-slate-800">
                    <span className="text-slate-400">Original Instructor:</span>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        src={targetScheduleForSubstitute.instructorAvatarUrl}
                        name={targetScheduleForSubstitute.instructorName}
                        alt={targetScheduleForSubstitute.instructorName || 'Instructor'}
                        className="w-5 h-5 rounded-md"
                        fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold"
                      />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {targetScheduleForSubstitute.instructorName}
                      </span>
                    </div>
                  </div>
                  {targetScheduleForSubstitute.instructorOnLeave && (
                    <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px] flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>
                        Instructor on leave ({targetScheduleForSubstitute.leaveDetails?.startDate} to {targetScheduleForSubstitute.leaveDetails?.endDate} - {targetScheduleForSubstitute.leaveDetails?.leaveType}).
                      </span>
                    </div>
                  )}
                </div>

                {/* Substitute Instructor Dropdown */}
                <div>
                  <label className="block text-slate-400 uppercase text-[10px] mb-1 font-bold">
                    Select Substitute Instructor *
                  </label>
                  <select
                    value={selectedSubstituteId}
                    onChange={(e) => setSelectedSubstituteId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-bold"
                  >
                    <option value="">-- Choose Available Substitute --</option>
                    {instructors
                      .filter((ins) => (ins.instructorId || ins.id) !== targetScheduleForSubstitute.instructorId)
                      .map((ins) => {
                        const id = ins.instructorId || ins.id;
                        const onLeave = approvedLeaves.find(
                          (l: any) =>
                            l.instructor_id === id &&
                            l.start_date <= targetScheduleForSubstitute.endDate &&
                            l.end_date >= targetScheduleForSubstitute.startDate
                        );
                        return (
                          <option key={id} value={id} disabled={Boolean(onLeave)}>
                            {ins.name || `${ins.firstName || ''} ${ins.lastName || ''}`.trim()}
                            {onLeave ? ` ⚠️ (ON LEAVE: ${onLeave.start_date} to ${onLeave.end_date})` : ''}
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {targetScheduleForSubstitute.substituteInstructorId ? (
                    <button
                      type="button"
                      onClick={handleRemoveSubstitute}
                      disabled={submittingSubstitute}
                      className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-500/20 font-bold transition-all"
                    >
                      Remove Substitute
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSubstituteModalOpen(false)}
                      disabled={submittingSubstitute}
                      className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingSubstitute || !selectedSubstituteId}
                      className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md shadow-purple-500/25 transition-all disabled:opacity-50"
                    >
                      {submittingSubstitute ? 'Assigning...' : 'Confirm Substitute'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

