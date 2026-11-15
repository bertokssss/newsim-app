'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  BookOpen,
  Users,
  Award,
  FileSpreadsheet,
  ArrowRight,
  X,
  Loader2
} from 'lucide-react';
import { hasModulePermission } from '@newsim/utils';
import { UserAvatar } from '@newsim/ui';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'COURSES' | 'TRAINEES' | 'ASSESSMENTS' | 'SCHEDULES' | 'MATERIALS';
  link: string;
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
  userRole = 'INSTRUCTOR',
}: GlobalSearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const canViewCourses = hasModulePermission(permissions, 'COURSE_VIEW', userRole);
    const canViewTrainees = hasModulePermission(permissions, 'TRAINEE_VIEW', userRole);
    const canViewAssessments = hasModulePermission(permissions, 'ASSESSMENT_VIEW', userRole);

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [resCourses, resTrainees, resAssessments] = await Promise.all([
          canViewCourses
            ? fetch(`/api/instructor/my-courses?search=${encodeURIComponent(query)}`).then((r) => r.json()).catch(() => ({ success: false }))
            : Promise.resolve({ success: false }),
          canViewTrainees
            ? fetch(`/api/instructor/trainees?search=${encodeURIComponent(query)}`).then((r) => r.json()).catch(() => ({ success: false }))
            : Promise.resolve({ success: false }),
          canViewAssessments
            ? fetch(`/api/instructor/assessments?search=${encodeURIComponent(query)}`).then((r) => r.json()).catch(() => ({ success: false }))
            : Promise.resolve({ success: false }),
        ]);

        const combined: SearchResultItem[] = [];

        if (resCourses.success && Array.isArray(resCourses.data)) {
          resCourses.data.slice(0, 3).forEach((c: any) => {
            combined.push({
              id: `crs-${c.id}`,
              title: `${c.code}: ${c.title}`,
              subtitle: `${c.durationHours}h • ${c.centerName}`,
              category: 'COURSES',
              link: '/my-courses',
            });
          });
        }

        if (resTrainees.success && Array.isArray(resTrainees.data)) {
          resTrainees.data.slice(0, 3).forEach((t: any) => {
            combined.push({
              id: `trn-${t.id}`,
              title: `${t.firstName} ${t.lastName}`,
              subtitle: `${t.srn} • ${t.rank}`,
              category: 'TRAINEES',
              link: '/trainees',
              avatarUrl: t.avatarUrl || null,
            });
          });
        }

        if (resAssessments.success && Array.isArray(resAssessments.data)) {
          resAssessments.data.slice(0, 3).forEach((a: any) => {
            combined.push({
              id: `asm-${a.id}`,
              title: `${a.code}: ${a.title}`,
              subtitle: `${a.type} • Pass: ${a.passingScore}/${a.totalPoints}`,
              category: 'ASSESSMENTS',
              link: '/assessments',
            });
          });
        }

        setResults(combined);
        setSelectedIndex(0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, permissions, userRole]);

  const handleSelect = (item: SearchResultItem) => {
    router.push(item.link);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'COURSES':
        return BookOpen;
      case 'TRAINEES':
        return Users;
      case 'ASSESSMENTS':
        return Award;
      default:
        return FileSpreadsheet;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-20">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -15 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 text-slate-900 dark:text-white"
          >
            {/* Search Input */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0c1a2c]">
              <Search className="w-5 h-5 text-sky-500 shrink-0 mr-3" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search assigned courses, trainees, assessments..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
              {loading && <Loader2 className="w-4 h-4 animate-spin text-sky-500 mr-2" />}
              <button
                onClick={onClose}
                className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto p-3 space-y-1.5">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Searching teaching database...
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  {query.trim() ? 'No matching courses, trainees, or assessments found.' : 'Type to search across your assigned teaching roster.'}
                </div>
              ) : (
                results.map((item, idx) => {
                  const Icon = getCategoryIcon(item.category);
                  const isSelected = idx === selectedIndex;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors border ${
                        isSelected
                          ? 'bg-sky-500/10 border-sky-500/30 dark:bg-sky-500/15'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-700 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.category === 'TRAINEES' ? (
                          <UserAvatar
                            src={item.avatarUrl}
                            name={item.title}
                            alt={item.title || 'Trainee'}
                            className="w-8 h-8 rounded-lg"
                            fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate font-sans">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {item.category}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Shortcut Hints */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#0c1a2c] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px]">ESC</kbd> to close</span>
              <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 font-bold">Instructor Command Search</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
