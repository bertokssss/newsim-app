'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  CheckCheck,
  Award,
  CreditCard,
  BookOpen,
  CalendarDays
} from 'lucide-react';

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'HIGH'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trainee/notifications');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setNotifications(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch('/api/trainee/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/trainee/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD' && n.isRead) return false;
    if (filter === 'HIGH' && n.priority !== 'HIGH' && n.severity !== 'WARNING' && n.severity !== 'CRITICAL') return false;
    if (categoryFilter !== 'ALL' && n.category !== categoryFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'ENROLLMENT':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'PAYMENT':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'SCHEDULE':
      case 'BATCH':
        return 'bg-indigo-50 text-indigo-700 dark:bg-sky-500/15 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'ATTENDANCE':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'ASSESSMENT':
      case 'PRACTICAL':
        return 'bg-purple-50 text-purple-700 dark:bg-sky-500/15 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'CERTIFICATION':
        return 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800';
      case 'SECURITY':
      case 'ACCOUNT':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getPriorityBadgeClass = (priority?: string, severity?: string) => {
    if (priority === 'HIGH' || severity === 'CRITICAL') {
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
    if (priority === 'MEDIUM' || severity === 'WARNING') {
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-slate-200/80 dark:border-slate-800">
              Dispatch Alerts & Notices
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Notifications & Broadcasts
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] font-sans mt-0.5">
            Real-time training updates, assessment reminders, and registrar notifications.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all self-start sm:self-auto shadow-xs cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-sky-500" />
            <span>Mark All as Read ({unreadCount})</span>
          </button>
        )}
      </div>

      {/* Filter Tabs & Category Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {[
            { id: 'ALL', label: 'All Alerts' },
            { id: 'UNREAD', label: `Unread (${unreadCount})` },
            { id: 'HIGH', label: 'Priority / High' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                filter === tab.id
                  ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="ENROLLMENT">Enrollment</option>
            <option value="PAYMENT">Payment</option>
            <option value="SCHEDULE">Schedule</option>
            <option value="BATCH">Batch</option>
            <option value="ATTENDANCE">Attendance</option>
            <option value="PROGRESS">Progress & Lessons</option>
            <option value="ASSESSMENT">Assessment</option>
            <option value="PRACTICAL">Practical</option>
            <option value="CERTIFICATION">Certification</option>
            <option value="SECURITY">Security</option>
            <option value="ACCOUNT">Account</option>
          </select>
        </div>
      </div>

      {/* Notifications Card */}
      <div className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden relative">
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {loading ? (
            <div className="py-16 text-center text-xs font-mono text-slate-400">
              Loading notifications...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-xs font-mono text-slate-400">
              No notifications matching your filter.
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                className={`p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors ${
                  !n.isRead ? 'bg-slate-50 dark:bg-slate-900/60' : 'hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm ${
                      n.severity === 'CRITICAL' || n.priority === 'HIGH'
                        ? 'bg-rose-500 shadow-rose-500/25'
                        : n.severity === 'WARNING' || n.priority === 'MEDIUM'
                        ? 'bg-amber-500 shadow-amber-500/25'
                        : 'bg-sky-600 hover:bg-sky-700 shadow-sky-500/20'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                        {n.title}
                      </h4>
                      {n.category && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${getCategoryBadgeClass(n.category)}`}>
                          {n.category}
                        </span>
                      )}
                      {n.priority && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${getPriorityBadgeClass(n.priority, n.severity)}`}>
                          {n.priority}
                        </span>
                      )}
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-[#CBD5E1] font-sans leading-relaxed">
                      {n.message}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-slate-400">
                      <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {n.link && (
                    <Link
                      href={n.link}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 hover:opacity-90 text-white text-xs font-mono font-bold shadow-xs inline-flex items-center gap-1.5"
                    >
                      <span>Open</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  )}
                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                      title="Mark as read"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

