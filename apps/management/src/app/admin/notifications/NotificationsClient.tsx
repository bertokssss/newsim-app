'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  CreditCard,
  FileSpreadsheet,
  CalendarCheck2,
  ShieldCheck,
  CalendarDays,
  ExternalLink,
  Trash2
} from 'lucide-react';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [canViewPayments, setCanViewPayments] = useState<boolean>(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/notifications');
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
        if (typeof json.canViewPayments === 'boolean') {
          setCanViewPayments(json.canViewPayments);
        }
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
      await fetch('/api/admin/notifications', {
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
      await fetch('/api/admin/notifications', {
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
    if (severityFilter !== 'ALL' && n.severity !== severityFilter) return false;
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
      case 'BATCH':
      case 'SCHEDULE':
        return 'bg-indigo-50 text-indigo-700 dark:bg-sky-500/15 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'ATTENDANCE':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'ASSESSMENT':
        return 'bg-purple-50 text-purple-700 dark:bg-sky-500/15 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'CERTIFICATION':
        return 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800';
      case 'SECURITY':
      case 'ACCOUNT':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getPriorityBadgeClass = (priority?: string, severity?: string) => {
    if (priority === 'HIGH' || severity === 'CRITICAL') {
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
    if (priority === 'MEDIUM' || severity === 'WARNING') {
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
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
                Operational Dispatch
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Operational Notifications & Alerts
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl">
              Stay informed on enrollment applications, instructor leave requests, schedule changes, attendance alerts, and certificate approvals.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark All as Read ({unreadCount})</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Filter Pills */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold uppercase transition-all cursor-pointer ${
                severityFilter === sev
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="ENROLLMENT">Enrollment</option>
              {canViewPayments && <option value="PAYMENT">Payment</option>}
              <option value="BATCH">Batch</option>
              <option value="SCHEDULE">Schedule & Leaves</option>
              <option value="ATTENDANCE">Attendance</option>
              <option value="PROGRESS">Progress</option>
              <option value="PRACTICAL">Practical</option>
              <option value="CERTIFICATION">Certification</option>
              <option value="ACCOUNT">Account</option>
              <option value="SECURITY">Security</option>
            </select>
          </div>

          <span className="text-xs font-mono text-slate-400 hidden sm:inline">
            {filtered.length} Notifications Listed
          </span>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 animate-pulse">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3.5 w-3/4 bg-slate-100 dark:bg-slate-800/60 rounded" />
              </div>
              <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-mono text-xs">
            No notifications found in this category.
          </div>
        ) : (
          filtered.map((n, idx) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.04 }}
              className={`p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                n.isRead
                  ? 'bg-white/60 dark:bg-[#0c1a2c] border-slate-200/80 dark:border-slate-800 opacity-80'
                  : 'bg-white dark:bg-[#0c1a2c] border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/10'
              }`}
            >
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md ${
                    n.severity === 'CRITICAL' || n.priority === 'HIGH'
                      ? 'bg-gradient-to-br from-rose-500 to-red-600'
                      : n.severity === 'WARNING' || n.priority === 'MEDIUM'
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                      : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                  }`}
                >
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                      {n.title}
                    </h3>
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
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Unread" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-[#CBD5E1] mt-1 max-w-2xl leading-relaxed">
                    {n.message}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-slate-400">
                    <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {n.link && (
                  <Link
                    href={n.link}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-xs font-mono font-bold transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Inspect</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
                {!n.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(n.id)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    title="Mark as read"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

