'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  Laptop,
  Smartphone,
  Globe,
  Clock,
  AlertTriangle,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Trash2,
  Radio,
  Eye
} from 'lucide-react';
import { Button, UserAvatar } from '@newsim/ui';
import { StepUpAuthModal } from '@/components/super-admin/StepUpAuthModal';
import { ConfirmationModal } from '@/components/super-admin/ConfirmationModal';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function SecurityClient() {
  const [activeSection, setActiveSection] = useState<'OVERVIEW' | 'LOGINS' | 'SESSIONS' | 'EVENTS'>('OVERVIEW');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [resolvingEventId, setResolvingEventId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Step-up Auth & Confirmation Modals
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingRevokeSessionId, setPendingRevokeSessionId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm Action',
    onConfirm: () => {},
  });

  const fetchSecurityData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/super-admin/security');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load security telemetry', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleRevokeSession = async (sessionId: string, userId?: string, userEmail?: string) => {
    setRevokingSessionId(sessionId);
    try {
      const res = await fetch('/api/super-admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE_SESSION', sessionId, userId, userEmail }),
      });
      const json = await res.json();
      if (json.success) {
        // Optimistically remove session from local state immediately
        setData((prev: any) => {
          if (!prev) return prev;
          const updated = (prev.activeSessions || []).filter((s: any) => s.id !== sessionId);
          return {
            ...prev,
            overview: {
              ...prev.overview,
              activeSessionsCount: updated.length,
            },
            activeSessions: updated,
          };
        });

        setNotice({
          type: 'success',
          message: `Session for ${userEmail || sessionId} has been successfully revoked and disconnected.`,
        });
        setTimeout(() => setNotice(null), 5000);
        fetchSecurityData();
      } else {
        setNotice({
          type: 'error',
          message: json.error || 'Failed to revoke session.',
        });
      }
    } catch (err) {
      console.error('Failed to revoke session', err);
      setNotice({
        type: 'error',
        message: 'Network error while revoking session.',
      });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleResolveEvent = async (eventId: string) => {
    setResolvingEventId(eventId);
    try {
      const res = await fetch('/api/super-admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESOLVE_SECURITY_EVENT', eventId }),
      });
      const json = await res.json();
      if (json.success) {
        // Optimistically mark event as resolved
        setData((prev: any) => {
          if (!prev) return prev;
          const updated = (prev.securityEvents || []).map((e: any) =>
            e.id === eventId ? { ...e, resolved: true } : e
          );
          return {
            ...prev,
            securityEvents: updated,
          };
        });

        setNotice({
          type: 'success',
          message: 'Security threat incident marked as resolved.',
        });
        setTimeout(() => setNotice(null), 4000);
        fetchSecurityData();
      }
    } catch (err) {
      console.error('Failed to resolve security event', err);
    } finally {
      setResolvingEventId(null);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-72 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          {[1, 2, 3, 4, 5].map((j) => (
            <div key={j} className="h-12 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const overview = data?.overview || {};
  const loginActivity = data?.loginActivity || [];
  const activeSessions = data?.activeSessions || [];
  const securityEvents = data?.securityEvents || [];

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
            <span>Enterprise Security Center</span>
            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80">
              SHIELD
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Real-time threat mitigation, active session termination, brute-force defense, and MFA compliance verification.
          </p>
        </div>

        <div className="relative z-10">
          <Button variant="secondary" size="sm" onClick={fetchSecurityData} disabled={isLoading} className="cursor-pointer border-slate-200 dark:border-slate-800">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
        </div>
      </motion.div>

      {/* Action Notification Banner */}
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/80'
          }`}
        >
          <span className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            {notice.message}
          </span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer font-bold px-1">✕</button>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Security Status', value: overview.securityStatus || 'PROTECTED', isStatus: true, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'MFA Coverage', value: overview.mfaCoverage || '0%', color: 'text-slate-900 dark:text-white' },
          { label: 'Failed Logins (24h)', value: overview.failedLoginAttempts24h || 0, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Locked Accounts', value: overview.lockedAccounts || 0, color: 'text-rose-600 dark:text-rose-400' },
          { label: 'Threat Events', value: overview.suspiciousEventsCount || 0, color: 'text-sky-600 dark:text-sky-400' },
          { label: 'Active Tokens', value: overview.activeSessionsCount || 0, color: 'text-sky-600 dark:text-sky-400' },
        ].map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: idx * 0.04, ease: easeCurve }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="relative p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 text-center shadow-xs overflow-hidden hover:border-slate-300 dark:hover:border-slate-700"
          >
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">{kpi.label}</span>
            <div className={`text-base font-bold ${kpi.color} mt-1 font-heading flex items-center justify-center gap-1`}>
              {kpi.isStatus && <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1" />}
              {kpi.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-2">
        {[
          { id: 'OVERVIEW', label: 'Security Overview & Telemetry' },
          { id: 'SESSIONS', label: `Active Sessions (${activeSessions.length})` },
          { id: 'LOGINS', label: 'Login Activity Stream' },
          { id: 'EVENTS', label: `Threat Events (${securityEvents.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeSection === tab.id
                ? 'bg-sky-600 text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. SESSIONS TAB */}
      {(activeSection === 'SESSIONS' || activeSection === 'OVERVIEW') && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20px' }}
          transition={{ duration: 0.5, ease: easeCurve }}
          className="rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs space-y-2 transition-colors duration-200"
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Authenticated User Sessions</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Real-time session monitoring with remote emergency revocation capability.</p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">{activeSessions.length} active sessions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">User & Role</th>
                  <th className="py-3 px-4">Device & Browser</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Login Time</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {activeSessions.map((s: any) => (
                  <tr key={s.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${s.isCurrent ? 'bg-sky-50/40 dark:bg-sky-950/20' : ''}`}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          src={s.userAvatarUrl}
                          name={s.userName || s.userEmail}
                          alt={s.userName || s.userEmail || 'User'}
                          className="w-8 h-8 rounded-lg"
                          fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="truncate">{s.userName}</span>
                            {s.isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 text-[9px] font-mono font-semibold">
                                CURRENT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{s.userEmail} • {s.userRole}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 dark:text-slate-200">{s.device}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">{s.ipAddress}</td>

                    <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(s.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(s.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {!s.isCurrent && (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={revokingSessionId === s.id}
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Revoke User Session',
                              message: `Are you sure you want to terminate the active session for ${s.userName} (${s.userEmail})? The user will be immediately logged out.`,
                              confirmText: 'Revoke Session',
                              onConfirm: () => {
                                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                                handleRevokeSession(s.id, s.userId, s.userEmail);
                              },
                            });
                          }}
                          className="h-7 text-xs cursor-pointer font-bold"
                        >
                          {revokingSessionId === s.id ? (
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3 mr-1" />
                          )}
                          {revokingSessionId === s.id ? 'REVOKING...' : 'REVOKE'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* 2. THREAT EVENTS TAB */}
      {(activeSection === 'EVENTS' || activeSection === 'OVERVIEW') && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20px' }}
          transition={{ duration: 0.5, ease: easeCurve }}
          className="rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs space-y-2 transition-colors duration-200"
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Security Threats & Incident Log</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Automated threat classification and administrator incident handling.</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {securityEvents.map((evt: any) => (
              <div key={evt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                    evt.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/80' : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/80'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white font-mono">{evt.eventType}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                        evt.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/80' : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/80'
                      }`}>
                        {evt.severity}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">{evt.description}</p>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1 flex flex-wrap items-center gap-1.5">
                      <span>Target:</span>
                      <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                        <UserAvatar
                          src={evt.targetAvatarUrl}
                          name={evt.targetName || evt.targetUser}
                          alt={evt.targetName || evt.targetUser || 'Target User'}
                          className="w-4 h-4 rounded-md"
                          fallbackClassName="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[8px] font-bold"
                        />
                        <span>{evt.targetName ? `${evt.targetName} (${evt.targetUser})` : evt.targetUser}</span>
                      </span>
                      <span>• IP: <span className="text-slate-800 dark:text-slate-200">{evt.ipAddress}</span> • {new Date(evt.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {evt.resolved ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono text-xs flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> RESOLVED
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={resolvingEventId === evt.id}
                      onClick={() => handleResolveEvent(evt.id)}
                      className="h-8 text-xs cursor-pointer border-slate-200 dark:border-slate-800"
                    >
                      {resolvingEventId === evt.id && (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      )}
                      {resolvingEventId === evt.id ? 'Resolving...' : 'Mark Resolved'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 3. LOGIN ACTIVITY STREAM TAB */}
      {activeSection === 'LOGINS' && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20px' }}
          transition={{ duration: 0.5, ease: easeCurve }}
          className="rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs transition-colors duration-200"
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Authentication & Login Audit Ledger</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Stream of all successful, failed, and recovery code authentication events.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Account / Identifier</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Source IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {loginActivity.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-900 dark:text-white font-medium">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar
                          src={log.actorAvatarUrl}
                          name={log.actorName || log.actorEmail}
                          alt={log.actorName || log.actorEmail || 'Account'}
                          className="w-6 h-6 rounded-md"
                          fallbackClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[9px] font-bold"
                        />
                        <div className="min-w-0">
                          {log.actorName && (
                            <div className="text-xs font-semibold text-slate-900 dark:text-white font-sans truncate">{log.actorName}</div>
                          )}
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{log.actorEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{log.actorRole}</td>
                    <td className="py-3 px-4 text-sky-600 dark:text-sky-400 font-semibold">{log.action}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80' : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/80'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Step-Up Auth Modal */}
      <StepUpAuthModal
        isOpen={stepUpOpen}
        onClose={() => { setStepUpOpen(false); setPendingRevokeSessionId(null); }}
        onSuccess={() => {
          if (pendingRevokeSessionId) {
            handleRevokeSession(pendingRevokeSessionId);
            setPendingRevokeSessionId(null);
          }
        }}
        title="Authorize Session Revocation"
        description="Terminating an active privileged session requires password confirmation to protect against unauthorized account tampering."
        actionName="SESSION_REVOKE"
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isLoading={!!revokingSessionId}
      />
    </div>
  );
}

