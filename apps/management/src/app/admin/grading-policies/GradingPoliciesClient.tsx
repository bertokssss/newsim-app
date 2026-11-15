'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Scale,
  ShieldCheck,
  CalendarCheck2,
  BookOpen,
  Compass,
  Edit3,
  X,
  Save,
  Info
} from 'lucide-react';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface GradingPolicy {
  id: string;
  course_id?: string | null;
  courseId?: string | null;
  name: string;
  attendance_weight?: number;
  attendanceWeight?: number;
  practical_weight?: number;
  practicalWeight?: number;
  module_quiz_weight?: number;
  moduleQuizWeight?: number;
  passing_grade?: number;
  passingGrade?: number;
  min_attendance_pct?: number;
  minAttendancePct?: number;
  late_credit_pct?: number;
  lateCreditPct?: number;
  excused_mode?: string;
  excusedMode?: string;
  practical_competency_required?: boolean;
  practicalCompetencyRequired?: boolean;
  status: string;
  courseName?: string;
  courseCode?: string;
  courses?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export default function GradingPoliciesClient() {
  const [policies, setPolicies] = useState<GradingPolicy[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<GradingPolicy | null>(null);
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState<string>('');
  const [attendanceWeight, setAttendanceWeight] = useState(10);
  const [practicalWeight, setPracticalWeight] = useState(50);
  const [moduleQuizWeight, setModuleQuizWeight] = useState(40);
  const [passingGrade, setPassingGrade] = useState(75);
  const [minAttendancePct, setMinAttendancePct] = useState(80);
  const [lateCreditPct, setLateCreditPct] = useState(75);
  const [excusedMode, setExcusedMode] = useState('EXCLUDE');
  const [practicalCompetencyRequired, setPracticalCompetencyRequired] = useState(true);
  const [status, setStatus] = useState('ACTIVE');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/grading-policies');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPolicies(json.data);
      }
    } catch (err) {
      console.error('Failed to load grading policies:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/admin/courses');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCourses(json.data);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  useEffect(() => {
    fetchPolicies();
    fetchCourses();
  }, []);

  const handleOpenCreate = () => {
    setEditingPolicy(null);
    setName('');
    setCourseId('');
    setAttendanceWeight(10);
    setPracticalWeight(50);
    setModuleQuizWeight(40);
    setPassingGrade(75);
    setMinAttendancePct(80);
    setLateCreditPct(75);
    setExcusedMode('EXCLUDE');
    setPracticalCompetencyRequired(true);
    setStatus('ACTIVE');
    setErrorMessage('');
    setModalOpen(true);
  };

  const handleOpenEdit = (policy: GradingPolicy) => {
    const rawExcused = policy.excused_mode || policy.excusedMode || 'EXCLUDE';
    setEditingPolicy(policy);
    setName(policy.name);
    setCourseId(policy.course_id ?? policy.courseId ?? '');
    setAttendanceWeight(Number(policy.attendance_weight ?? policy.attendanceWeight) || 0);
    setPracticalWeight(Number(policy.practical_weight ?? policy.practicalWeight) || 0);
    setModuleQuizWeight(Number(policy.module_quiz_weight ?? policy.moduleQuizWeight) || 0);
    setPassingGrade(Number(policy.passing_grade ?? policy.passingGrade) || 75);
    setMinAttendancePct(Number(policy.min_attendance_pct ?? policy.minAttendancePct) || 80);
    setLateCreditPct(Number(policy.late_credit_pct ?? policy.lateCreditPct) || 75);
    setExcusedMode(rawExcused === 'EXCLUDE_FROM_TOTAL' ? 'EXCLUDE' : rawExcused);
    setPracticalCompetencyRequired(
      Boolean(policy.practical_competency_required ?? policy.practicalCompetencyRequired ?? true)
    );
    setStatus(policy.status || 'ACTIVE');
    setErrorMessage('');
    setModalOpen(true);
  };

  const totalWeight = attendanceWeight + practicalWeight + moduleQuizWeight;
  const isWeightValid = totalWeight === 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightValid) {
      setErrorMessage(`Total component weights must equal exactly 100%. Current sum: ${totalWeight}%.`);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      const res = await fetch('/api/admin/grading-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPolicy?.id,
          courseId: courseId || null,
          name,
          attendanceWeight: Number(attendanceWeight),
          practicalWeight: Number(practicalWeight),
          moduleQuizWeight: Number(moduleQuizWeight),
          passingGrade: Number(passingGrade),
          minAttendancePct: Number(minAttendancePct),
          lateCreditPct: Number(lateCreditPct),
          excusedMode,
          practicalCompetencyRequired,
          status,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setModalOpen(false);
        await fetchPolicies();
      } else {
        setErrorMessage(json.error || 'Failed to save grading policy');
      }
    } catch (err: any) {
      console.error('Error saving policy:', err);
      setErrorMessage('Network or server error.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = policies.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.courses?.name && p.courses.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.courses?.code && p.courses.code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm"
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                STCW Section A-I/12 Academic Standards
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Grading Policies & Calculation Formulas
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed font-sans">
              Configure institutional and course-specific weighted grading formulas. Enforce mandatory attendance minimums and non-negotiable practical competency gates that raw averages cannot bypass.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-mono text-xs font-bold shadow-md shadow-sky-500/20 transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Grading Policy</span>
          </button>
        </div>
      </motion.div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {/* Active Policies */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-300">
              Active Formulas
            </span>
            <Scale className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
            {policies.length} Policies
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Configured in registry</div>
        </div>

        {/* Standard Institutional Weights */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-emerald-200/60 dark:border-emerald-900/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              Default Weighting
            </span>
            <GraduationCap className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
            10% / 50% / 40%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Att / Practical / Quizzes</div>
        </div>

        {/* Passing Benchmark */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-amber-200/60 dark:border-amber-900/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300">
              Passing Standard
            </span>
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
            75% Benchmark
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Institutional passing score</div>
        </div>

        {/* Mandatory Attendance Requirement */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-purple-200/60 dark:border-purple-900/50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300">
              Attendance Rule
            </span>
            <CalendarCheck2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
            Min. 80% Hours
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Non-negotiable STCW gate</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search policy name or course..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none"
          />
        </div>
      </div>

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
              </div>
              <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
                <div className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
                <div className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-400 font-mono text-xs">
            No grading policies configured.
          </div>
        ) : (
          filtered.map((p) => {
            const resolvedCourseId = p.course_id ?? p.courseId ?? null;
            const isDefault = !resolvedCourseId;
            const resolvedCourseCode = p.courses?.code || (p.courseCode !== 'INSTITUTIONAL' ? p.courseCode : undefined) || 'STCW';
            const resolvedCourseName = p.courses?.name || (!isDefault ? p.courseName : undefined);
            const attWeight = p.attendance_weight ?? p.attendanceWeight ?? 0;
            const pracWeight = p.practical_weight ?? p.practicalWeight ?? 0;
            const modWeight = p.module_quiz_weight ?? p.moduleQuizWeight ?? 0;
            const passGrade = p.passing_grade ?? p.passingGrade ?? 75;
            const minAtt = p.min_attendance_pct ?? p.minAttendancePct ?? 80;
            const lateCred = p.late_credit_pct ?? p.lateCreditPct ?? 75;
            const pracReq = p.practical_competency_required ?? p.practicalCompetencyRequired ?? true;
            const excMode = p.excused_mode || p.excusedMode || 'EXCLUDE';

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isDefault
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isDefault ? 'Institutional Default' : `Course Specific: ${resolvedCourseCode}`}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                        p.status === 'ACTIVE'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-slate-500/15 text-slate-500'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                      {p.name}
                    </h3>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      {!isDefault && resolvedCourseName
                        ? `${resolvedCourseCode}: ${resolvedCourseName}`
                        : 'Applies to all courses without custom policies'}
                    </div>
                  </div>

                  {/* Weighting Formula Visualizer */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-500 uppercase">Weight Distribution</span>
                      <span className="text-slate-900 dark:text-white">Total: 100%</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                      <div className="p-2 rounded-xl bg-purple-50 dark:bg-sky-500/15 border border-purple-200/40">
                        <div className="text-[10px] text-purple-700 dark:text-purple-300 font-bold uppercase">Attendance</div>
                        <div className="text-base font-extrabold text-purple-900 dark:text-purple-200 mt-0.5">
                          {attWeight}%
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/40">
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase">Practical</div>
                        <div className="text-base font-extrabold text-emerald-900 dark:text-emerald-200 mt-0.5">
                          {pracWeight}%
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/40">
                        <div className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase">Quizzes</div>
                        <div className="text-base font-extrabold text-blue-900 dark:text-blue-200 mt-0.5">
                          {modWeight}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mandatory Rules Badges */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50">
                      <span className="text-[10px] text-slate-400 uppercase">Passing Benchmark</span>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {passGrade}% minimum
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50">
                      <span className="text-[10px] text-slate-400 uppercase">Attendance Requirement</span>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {minAtt}% contact hours
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50">
                      <span className="text-[10px] text-slate-400 uppercase">Lateness Credit</span>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {lateCred}% credit
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50">
                      <span className="text-[10px] text-slate-400 uppercase">Must-Pass Practical</span>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {pracReq ? 'Enforced' : 'Optional'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 text-[11px]">
                    Excused: {excMode.replace(/_/g, ' ')}
                  </span>

                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-900 dark:text-white font-bold transition-all flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Formula</span>
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Policy Configuration Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-0.5">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {editingPolicy ? 'Modify Grading Policy' : 'Configure New Grading Policy'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Ensure attendance, practical, and module weights sum to exactly 100%.
                  </p>
                </div>
                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
                {/* Policy Name */}
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1 font-bold">
                    Policy Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Standard Maritime Simulator Policy"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
                  />
                </div>

                {/* Course Association */}
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1 font-bold">
                    Applies To:
                  </label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-bold"
                  >
                    <option value="">Default (All courses without specific policies)</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}: {c.name || c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Component Weights Form */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white uppercase text-[11px]">
                      Component Weights (Must Equal 100%)
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isWeightValid
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-rose-500/15 text-rose-600 animate-pulse'
                      }`}
                    >
                      Sum: {totalWeight}% {isWeightValid ? '✓' : '(Invalid)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        Attendance (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={attendanceWeight}
                        onChange={(e) => setAttendanceWeight(Number(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-center font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        Practical Drills (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={practicalWeight}
                        onChange={(e) => setPracticalWeight(Number(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-center font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        Module Quizzes (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={moduleQuizWeight}
                        onChange={(e) => setModuleQuizWeight(Number(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-center font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Policy Parameters */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Passing Benchmark Grade (%)
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={passingGrade}
                      onChange={(e) => setPassingGrade(Number(e.target.value) || 75)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Minimum Attendance Requirement (%)
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={minAttendancePct}
                      onChange={(e) => setMinAttendancePct(Number(e.target.value) || 80)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Lateness Attendance Credit (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={lateCreditPct}
                      onChange={(e) => setLateCreditPct(Number(e.target.value) || 75)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Excused Session Handling
                    </label>
                    <select
                      value={excusedMode}
                      onChange={(e) => setExcusedMode(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 font-bold"
                    >
                      <option value="EXCLUDE">Exclude from Total Hours</option>
                      <option value="FULL_CREDIT">Award 100% Full Credit</option>
                      <option value="NO_CREDIT">No Credit (Count in Total)</option>
                    </select>
                  </div>
                </div>

                {/* Practical Competency Gate Checkbox */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="pracComp"
                    checked={practicalCompetencyRequired}
                    onChange={(e) => setPracticalCompetencyRequired(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <label htmlFor="pracComp" className="text-[11px] font-sans text-slate-600 dark:text-slate-300">
                    <strong className="block font-mono text-slate-900 dark:text-white">
                      Enforce Mandatory Practical Competency Gate (STCW Rule 4.4)
                    </strong>
                    Trainees who fail the practical assessment or critical safety criteria will be marked as FAILED for the course, even if their numerical average exceeds the passing threshold.
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={!isWeightValid || submitting}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingPolicy ? 'Update Policy' : 'Save Policy'}</span>
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
