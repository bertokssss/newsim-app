'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  BookOpen,
  UserCheck,
  GraduationCap,
  FileSpreadsheet,
  CreditCard,
  ShieldCheck,
  CalendarDays,
  ArrowRight,
  Loader2,
  Compass,
} from 'lucide-react';
import { canAccessPortalRoute, hasModulePermission, resolveNavigationPermissions } from '@newsim/utils';
import { UserAvatar } from '@newsim/ui';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  link: string;
  category: string;
  status?: string;
  avatarUrl?: string | null;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissions?: string[] | null;
  userRole?: string | null;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  permissions = null,
  userRole = 'ADMIN',
}: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    trainees: SearchResultItem[];
    courses: SearchResultItem[];
    enrollments: SearchResultItem[];
    instructors: SearchResultItem[];
    schedules: SearchResultItem[];
    payments: SearchResultItem[];
    certificates: SearchResultItem[];
  }>({
    trainees: [],
    courses: [],
    enrollments: [],
    instructors: [],
    schedules: [],
    payments: [],
    certificates: [],
  });

  useEffect(() => {
    if (!query.trim()) {
      setResults({
        trainees: [],
        courses: [],
        enrollments: [],
        instructors: [],
        schedules: [],
        payments: [],
        certificates: [],
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        if (json.success && json.data) {
          setResults({
            trainees: json.data.trainees || [],
            courses: json.data.courses || [],
            enrollments: json.data.enrollments || [],
            instructors: json.data.instructors || [],
            schedules: json.data.schedules || [],
            payments: json.data.payments || [],
            certificates: json.data.certificates || [],
          });
        }
      } catch (err) {
        console.error('Admin search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleNavigate = (path: string) => {
    onClose();
    router.push(path);
  };

  // Full Admin Portal features and functionalities
  const ADMIN_PAGES = [
    { id: 'ap1', title: 'Operational Dashboard', subtitle: 'View high-level KPIs, center admissions, and daily alerts', link: '/admin/dashboard' },
    { id: 'ap2', title: 'Course Catalog & Curriculum', subtitle: 'Manage available maritime programs, STCW certifications, and fees', link: '/admin/courses' },
    { id: 'ap3', title: 'Enrollments & Admissions', subtitle: 'Process student applications, admission approvals, and class rosters', link: '/admin/enrollments' },
    { id: 'ap4', title: 'Class Schedules & Timetables', subtitle: 'Schedule simulator training sessions, batches, and room bookings', link: '/admin/schedules' },
    { id: 'ap5', title: 'Daily Attendance Tracking', subtitle: 'Roll call records, mandatory training hour compliance, and presence logs', link: '/admin/attendance' },
    { id: 'ap6', title: 'Grading Policies & Rules', subtitle: 'Passing thresholds, late deduction penalties, and competency rubrics', link: '/admin/grading-policies' },
    { id: 'ap7', title: 'Payment Processing & Invoices', subtitle: 'Handle student transactions, receipts, balances, and fee verification', link: '/admin/payments' },
    { id: 'ap8', title: 'Certificates Registry & Issuance', subtitle: 'Issue, inspect, and verify official maritime certificates with QR codes', link: '/admin/certificates' },
    { id: 'ap9', title: 'Instructors Roster & Faculty', subtitle: 'View active instructors, qualifications, and class assignments', link: '/admin/instructors' },
    { id: 'ap10', title: 'Instructor Leave Requests', subtitle: 'Review and approve instructor absence and substitute assignments', link: '/admin/leaves' },
    { id: 'ap11', title: 'Reports & Analytics', subtitle: 'Generate operational summaries, completion rates, and metrics', link: '/admin/reports' },
    { id: 'ap12', title: 'Alerts & Operational Notices', subtitle: 'System notifications, broadcast messages, and operational alerts', link: '/admin/notifications' },
    { id: 'ap13', title: 'Branch & Account Settings', subtitle: 'Manage center configurations, operating hours, and MFA settings', link: '/admin/settings' },
  ];

  const effectivePermissions = resolveNavigationPermissions('ADMIN', permissions, userRole || 'ADMIN');
  const permittedPages = ADMIN_PAGES.filter((p) =>
    canAccessPortalRoute('ADMIN', p.link, effectivePermissions, userRole || 'ADMIN')
  );
  const canViewPayments = hasModulePermission(effectivePermissions, 'PAYMENT_VIEW', userRole);

  const filteredPages = query.trim()
    ? permittedPages.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const hasResults =
    results.trainees.length > 0 ||
    results.courses.length > 0 ||
    results.enrollments.length > 0 ||
    results.instructors.length > 0 ||
    results.schedules.length > 0 ||
    results.payments.length > 0 ||
    results.certificates.length > 0 ||
    filteredPages.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -15 }}
            className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10 text-slate-900 dark:text-white"
          >
            {/* Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0c1a2c]">
              <Search className="w-5 h-5 text-sky-500 shrink-0 mr-3" />
              <input
                type="text"
                placeholder={
                  canViewPayments
                    ? 'Search trainees, courses, enrollments, schedules, payments...'
                    : 'Search trainees, courses, enrollments, schedules...'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-sky-500 mr-2" />}
              <button
                onClick={onClose}
                className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Results Container */}
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              {!query.trim() && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">
                  {canViewPayments
                    ? 'Type to search trainees, courses, enrollments, schedules, payments, or portal features.'
                    : 'Type to search permitted records, schedules, or portal features.'}
                </div>
              )}

              {query.trim() && !hasResults && !isLoading && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">
                  No matching operational records found for &ldquo;<span className="text-slate-900 dark:text-white font-medium">{query}</span>&rdquo;.
                </div>
              )}

              {/* Portal Functionalities / System Features Group */}
              {filteredPages.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-fuchsia-600 dark:text-fuchsia-400 px-2 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5" /> Portal Features & Functionalities ({filteredPages.length})
                  </div>
                  {filteredPages.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNavigate(item.link)}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between cursor-pointer text-xs group transition-colors border border-transparent hover:border-fuchsia-500/30"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-[#F8FAFC] group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{item.subtitle}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}

              {/* Trainees Section (Supabase) */}
              {results.trainees.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400 px-2 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" /> Trainees ({results.trainees.length})
                  </div>
                  {results.trainees.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleNavigate(t.link)}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between cursor-pointer text-xs group transition-colors border border-transparent hover:border-emerald-500/30"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          src={t.avatarUrl}
                          name={t.title}
                          alt={t.title || 'Trainee'}
                          className="w-8 h-8 rounded-xl"
                          fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] group-hover:text-emerald-500 transition-colors truncate">
                            {t.title}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">{t.subtitle}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.status && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {t.status}
                          </span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Courses Section (Supabase) */}
              {results.courses.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-teal-600 dark:text-teal-400 px-2 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Courses ({results.courses.length})
                  </div>
                  {results.courses.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleNavigate(c.link)}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between cursor-pointer text-xs group transition-colors border border-transparent hover:border-teal-500/30"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-[#F8FAFC] group-hover:text-teal-500 transition-colors">
                          {c.title}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{c.subtitle}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}

              {/* Enrollments Section (Supabase) */}
              {results.enrollments.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-sky-600 dark:text-sky-400 px-2 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Enrollments ({results.enrollments.length})
                  </div>
                  {results.enrollments.map((e) => (
                    <div
                      key={e.id}
                      onClick={() => handleNavigate(e.link)}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between cursor-pointer text-xs group transition-colors border border-transparent hover:border-sky-500/30"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          src={e.avatarUrl}
                          name={e.title}
                          alt={e.title || 'Trainee'}
                          className="w-8 h-8 rounded-xl"
                          fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] group-hover:text-sky-500 transition-colors truncate">
                            {e.title}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">{e.subtitle}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.status && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            {e.status}
                          </span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Instructors Section (Supabase) */}
              {results.instructors.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-cyan-600 dark:text-cyan-400 px-2 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" /> Instructors ({results.instructors.length})
                  </div>
                  {results.instructors.map((i) => (
                    <div
                      key={i.id}
                      onClick={() => handleNavigate(i.link)}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between cursor-pointer text-xs group transition-colors border border-transparent hover:border-cyan-500/30"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          src={i.avatarUrl}
                          name={i.title}
                          alt={i.title || 'Instructor'}
                          className="w-8 h-8 rounded-xl"
                          fallbackClassName="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] group-hover:text-cyan-500 transition-colors truncate">
                            {i.title}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">{i.subtitle}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}

              {/* Schedules Section (Supabase) */}
              {results.schedules.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-indigo-600 dark:text-indigo-400 px-2 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Class Schedules ({results.schedules.length})
                  </div>
                  {results.schedules.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleNavigate(s.link)}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between cursor-pointer text-xs group transition-colors border border-transparent hover:border-indigo-500/30"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-[#F8FAFC] group-hover:text-indigo-500 transition-colors">
                          {s.title}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{s.subtitle}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}

              {/* Payments Section (Supabase) */}
              {results.payments.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400 px-2 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Payments ({results.payments.length})
                  </div>
                  {results.payments.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleNavigate(p.link)}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between cursor-pointer text-xs group transition-colors border border-transparent hover:border-emerald-500/30"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          src={p.avatarUrl}
                          name={p.title}
                          alt={p.title || 'Payment Trainee'}
                          className="w-8 h-8 rounded-xl"
                          fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] group-hover:text-emerald-500 transition-colors truncate">
                            {p.title}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">{p.subtitle}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.status && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {p.status}
                          </span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Certificates Section (Supabase) */}
              {results.certificates.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-amber-600 dark:text-amber-400 px-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Certificates ({results.certificates.length})
                  </div>
                  {results.certificates.map((cert) => (
                    <div
                      key={cert.id}
                      onClick={() => handleNavigate(cert.link)}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between cursor-pointer text-xs group transition-colors border border-transparent hover:border-amber-500/30"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          src={cert.avatarUrl}
                          name={cert.title}
                          alt={cert.title || 'Certificate Holder'}
                          className="w-8 h-8 rounded-xl"
                          fallbackClassName="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-[#F8FAFC] group-hover:text-amber-500 transition-colors truncate">
                            {cert.title}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">{cert.subtitle}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cert.status && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            {cert.status}
                          </span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#0c1a2c] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">ESC</kbd> to close</span>
              <span className="text-sky-600 dark:text-sky-400 font-bold text-[10px]">NEWSIM Operational Search</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
