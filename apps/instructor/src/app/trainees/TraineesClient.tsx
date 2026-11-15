'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Award,
  CalendarCheck2,
  TrendingUp,
  X,
  Building2,
  GraduationCap
} from 'lucide-react';
import { TablePageSkeleton, UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function TraineesClient() {
  const [trainees, setTrainees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTrainee, setSelectedTrainee] = useState<any | null>(null);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [traineeFullData, setTraineeFullData] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'progress' | 'assessments' | 'attendance'>('profile');

  const fetchTrainees = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);

      const res = await fetch(`/api/instructor/trainees?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTrainees(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainees();
  }, [search, statusFilter]);

  const handleOpenProfile = async (trainee: any) => {
    setSelectedTrainee(trainee);
    setProfileDrawerOpen(true);
    setLoadingProfile(true);
    try {
      const res = await fetch(`/api/instructor/trainees/${trainee.id}`);
      const json = await res.json();
      if (json.success) {
        setTraineeFullData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
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
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              Assigned Cohort
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Seafarer Trainee Directory
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed font-sans">
            Access training evaluations, attendance rates, exam scores, and module milestones for seafarers assigned to your maritime courses.
          </p>
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
            placeholder="Search trainee name, SRN, rank, email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'ACTIVE', 'COMPLETED', 'PENDING'].map((st) => (
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

      {/* Trainees Table */}
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
                <th className="py-3.5 px-4 font-bold">Seafarer Trainee</th>
                <th className="py-3.5 px-4 font-bold">SRN Number</th>
                <th className="py-3.5 px-4 font-bold">Rank / Rating</th>
                <th className="py-3.5 px-4 font-bold">Vessel Assignment</th>
                <th className="py-3.5 px-4 font-bold">Attendance</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4">
                    <TablePageSkeleton rows={5} columns={6} showHeader={false} />
                  </td>
                </tr>
              ) : trainees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono">
                    No assigned trainees found.
                  </td>
                </tr>
              ) : (
                trainees.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          src={t.avatarUrl}
                          firstName={t.firstName}
                          lastName={t.lastName}
                          alt={`${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Trainee'}
                          className="w-8 h-8 rounded-xl"
                          fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-bold"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] font-sans">{t.firstName} {t.lastName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{t.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                      {t.srn}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-sans font-medium">
                      {t.rank}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-sans">
                      {t.vesselType}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {t.attendanceRate}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        t.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 border border-sky-500/20'
                          : t.status === 'COMPLETED'
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                          : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenProfile(t)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-600 hover:text-white font-mono text-[11px] font-bold transition-all"
                      >
                        Inspect Progress →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Trainee Profile Drawer */}
      <AnimatePresence>
        {profileDrawerOpen && selectedTrainee && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setProfileDrawerOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="relative w-full max-w-xl h-full bg-white dark:bg-[#0c1a2c] border-l border-slate-200 dark:border-slate-800 shadow-2xl z-10 flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={selectedTrainee.avatarUrl}
                      firstName={selectedTrainee.firstName}
                      lastName={selectedTrainee.lastName}
                      alt={`${selectedTrainee.firstName || ''} ${selectedTrainee.lastName || ''}`.trim() || 'Trainee'}
                      className="w-11 h-11 rounded-2xl"
                      fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-sm font-bold"
                    />
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        {selectedTrainee.srn}
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading mt-1">
                        {selectedTrainee.firstName} {selectedTrainee.lastName}
                      </h3>
                    </div>
                  </div>
                  <button onClick={() => setProfileDrawerOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-4 text-xs font-mono">
                  {[
                    { id: 'profile', label: 'Profile' },
                    { id: 'progress', label: 'Progress' },
                    { id: 'assessments', label: 'Assessments' },
                    { id: 'attendance', label: 'Attendance' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-3 font-bold border-b-2 transition-all ${
                        activeTab === tab.id
                          ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                          : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] text-xs">
                  {activeTab === 'profile' && (
                    <div className="space-y-3 font-mono">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase">Rank / Rating</span>
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] mt-1">{selectedTrainee.rank}</div>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase">Vessel Category</span>
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] mt-1">{selectedTrainee.vesselType}</div>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase">Contact Email</span>
                        <div className="font-bold text-slate-900 dark:text-[#F8FAFC] mt-1">{selectedTrainee.email}</div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase">Campus Academy</span>
                        <div className="font-bold text-slate-900 dark:text-[#F8FAFC] mt-1">{selectedTrainee.centerName}</div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'progress' && (
                    <div className="space-y-3">
                      {traineeFullData?.progress ? (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 space-y-3 font-mono">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 uppercase text-[10px]">Course Completion</span>
                            <span className="font-bold text-sky-600 dark:text-sky-400 text-sm">{traineeFullData.progress.progressPercent}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-sky-600 rounded-full" style={{ width: `${traineeFullData.progress.progressPercent}%` }} />
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <div>Modules: {traineeFullData.progress.modulesCompleted} / {traineeFullData.progress.totalModules}</div>
                            <div>Average: {traineeFullData.progress.averageGrade} pts</div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400 font-mono">No progress milestone recorded.</div>
                      )}
                    </div>
                  )}

                  {activeTab === 'assessments' && (
                    <div className="space-y-2 font-mono">
                      {(traineeFullData?.submissions || []).map((sub: any) => (
                        <div key={sub.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 space-y-1">
                          <div className="flex justify-between">
                            <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{sub.assessmentTitle}</span>
                            <span className={`font-bold ${sub.result === 'PASSED' ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600'}`}>{sub.score} / {sub.maxScore}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-sans italic">{sub.feedback || 'No feedback provided'}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'attendance' && (
                    <div className="space-y-2 font-mono">
                      {(traineeFullData?.attendance || []).map((att: any) => (
                        <div key={att.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{att.date} ({att.sessionCode})</div>
                            <div className="text-[10px] text-slate-400">{att.courseTitle}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{att.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setProfileDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[#CBD5E1] font-semibold"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

