'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UserCheck,
  Search,
  BookOpen,
  Calendar,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Award,
  Clock,
  Sparkles
} from 'lucide-react';
import { UserAvatar } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function InstructorsClient() {
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/instructors?search=${encodeURIComponent(search)}`);
        const json = await res.json();
        if (json.success) {
          setInstructors(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [search]);

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
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
              Faculty Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Instructor Operations & Allocations
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed font-sans">
            Oversee instructor session assignments, simulator scheduling loads, and training delivery availability at NEWSIM Talisay Training Center.
          </p>
        </div>
      </motion.div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instructors by name or specialization..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
        <span className="text-xs font-mono text-slate-400 hidden sm:inline">
          {instructors.length} Instructors Active
        </span>
      </div>

      {/* Instructor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-4 animate-pulse">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3.5 w-28 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
              </div>
            </div>
          ))
        ) : instructors.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-400 font-mono text-xs">
            No instructors found matching search.
          </div>
        ) : (
          instructors.map((ins, idx) => (
            <motion.div
              key={ins.instructorId || ins.id || `instructor-${idx}`}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, ease: easeCurve, delay: idx * 0.05 }}
              whileHover={{ y: -2 }}
              className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <UserAvatar
                      src={ins.avatarUrl}
                      firstName={ins.firstName}
                      lastName={ins.lastName}
                      alt={`${ins.firstName || ''} ${ins.lastName || ''}`.trim() || 'Instructor'}
                      className="w-12 h-12 rounded-2xl shadow-md shadow-emerald-500/25 shrink-0"
                      fallbackClassName="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white font-bold font-mono text-sm"
                    />
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                        {ins.firstName} {ins.lastName}
                      </h3>
                      <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {ins.employeeId}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                    {ins.status}
                  </span>
                </div>

                <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-700 dark:text-[#CBD5E1] font-medium">
                  {ins.specialization}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Upcoming Sessions</span>
                    <div className="font-semibold text-slate-900 dark:text-[#F8FAFC] truncate mt-0.5">{ins.upcomingSessionsCount} Sessions</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Active Courses</span>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{ins.activeCoursesCount} Courses</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono text-[11px] truncate mr-2" title={ins.email}>{ins.email}</span>
                <button
                  onClick={() => window.location.href = `/admin/instructors/${ins.instructorId || ins.id}`}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors text-[11px] whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  View Details & Load
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

