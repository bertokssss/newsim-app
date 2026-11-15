'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  Shield,
  Filter
} from 'lucide-react';
import { Button } from '@newsim/ui';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/super-admin/notifications');
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleAction = async (action: string, notificationId?: string) => {
    try {
      await fetch('/api/super-admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notificationId }),
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to update notification', err);
    }
  };

  const filtered = notifications.filter((n) => {
    if (severityFilter !== 'ALL' && n.severity !== severityFilter) return false;
    if (statusFilter === 'UNREAD' && n.isRead) return false;
    if (statusFilter === 'READ' && !n.isRead) return false;
    if (categoryFilter !== 'ALL' && n.category !== categoryFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'SECURITY':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'ACCOUNT':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'SYSTEM':
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      default:
        return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.5, ease: easeCurve }}
        className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200"
      >
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-heading flex items-center gap-2">
            <span>Executive System Notifications</span>
            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/80">
              DISPATCH
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Real-time security threat dispatches, infrastructure alerts, and privileged administrative event notices.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          {unreadCount > 0 && (
            <button
              onClick={() => handleAction('MARK_ALL_READ')}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All Read ({unreadCount})</span>
            </button>
          )}
          <Button variant="secondary" size="sm" onClick={fetchNotifications} disabled={isLoading} className="cursor-pointer border-slate-200 dark:border-slate-800">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.45, ease: easeCurve }}
        className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-sky-500" /> Filters:
          </span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="UNREAD">Unread Only</option>
            <option value="READ">Read Only</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="SECURITY">Security</option>
            <option value="ACCOUNT">Account</option>
            <option value="SYSTEM">System</option>
          </select>
        </div>

        <div className="text-xs font-mono text-sky-600 dark:text-sky-400 font-semibold">
          {unreadCount} unread / {notifications.length} total
        </div>
      </motion.div>

      {/* Notifications Feed */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.5, ease: easeCurve }}
        className="rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800/60 transition-colors duration-200"
      >
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs font-mono">
            No system notifications found matching filters.
          </div>
        ) : (
          filtered.map((n, idx) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: idx * 0.04, ease: easeCurve }}
              className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                !n.isRead
                  ? 'bg-sky-50/40 dark:bg-sky-950/20 hover:bg-sky-50/60 dark:hover:bg-sky-950/30'
                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                    n.severity === 'CRITICAL'
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/80'
                      : n.severity === 'WARNING'
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80'
                      : 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200 dark:border-sky-800/80'
                  }`}
                >
                  {n.severity === 'CRITICAL' && <AlertTriangle className="w-4 h-4" />}
                  {n.severity === 'WARNING' && <AlertTriangle className="w-4 h-4" />}
                  {n.severity === 'INFO' && <Info className="w-4 h-4" />}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white font-heading">{n.title}</span>
                    {n.category && (
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-semibold border ${getCategoryBadgeClass(n.category)}`}>
                        {n.category}
                      </span>
                    )}
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                        n.severity === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/80'
                          : n.severity === 'WARNING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/80'
                          : 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/80'
                      }`}
                    >
                      {n.priority || n.severity}
                    </span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-sky-500" title="Unread" />
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">{n.message}</p>

                  <div className="text-[10px] text-slate-400 font-mono pt-1">
                    Received: {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {n.link && (
                  <Link href={n.link}>
                    <Button variant="secondary" size="sm" className="h-8 text-xs cursor-pointer border-slate-200 dark:border-slate-800">
                      <ExternalLink className="w-3.5 h-3.5 mr-1 text-sky-500" />
                      Investigate
                    </Button>
                  </Link>
                )}

                {!n.isRead && (
                  <Button variant="ghost" size="sm" onClick={() => handleAction('MARK_READ', n.id)} className="h-8 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                    Mark Read
                  </Button>
                )}

                <button
                  onClick={() => handleAction('DELETE', n.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  aria-label="Delete notification"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
}

