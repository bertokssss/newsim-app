'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  Key,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  X,
  Mail,
  Send,
  ArrowLeft,
  Clock,
  Trash2,
  Save,
} from 'lucide-react';
import { Button, NeuralInput, PasswordStrength, UserAvatar } from '@newsim/ui';
import {
  ADMIN_ROLE_PRESETS,
  getPermissionsCatalogForRole,
  isFinancialPermissionId,
  sanitizePermissionsForRole,
  validatePassword,
} from '@newsim/utils';
import { StepUpAuthModal } from '@/components/super-admin/StepUpAuthModal';
import { ConfirmationModal } from '@/components/super-admin/ConfirmationModal';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];
const ADMIN_PERMISSION_CATALOG = getPermissionsCatalogForRole('ADMIN');
const DEFAULT_OPERATIONS_PERMS = ADMIN_ROLE_PRESETS[0]?.permissions || [];

function normalizeAdminUiPermissions(raw?: string[] | null): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_OPERATIONS_PERMS];
  }
  if (raw.some((p) => String(p).toUpperCase().trim() === 'ALL')) {
    return ADMIN_PERMISSION_CATALOG.map((p) => p.id);
  }
  const mapped = raw.map((p) => (String(p).toUpperCase().trim() === 'USER_VIEW' ? 'ENROLLMENT_VIEW' : String(p)));
  return sanitizePermissionsForRole('ADMIN', mapped);
}

export default function AdminsClient() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);

  // Step-up & Confirmation
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpAction, setStepUpAction] = useState<{ action: string; adminId: string; payload?: any } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Create Form — multi-step
  const [createStep, setCreateStep] = useState<'form' | 'review' | 'success'>('form');
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    position: '',
    password: '',
    confirmPassword: '',
    permissions: [...DEFAULT_OPERATIONS_PERMS],
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const formScrollRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const scrollToError = () => {
    setTimeout(() => {
      if (errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (formScrollRef.current) {
        formScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
  };

  useEffect(() => {
    if (createError) {
      scrollToError();
    }
  }, [createError]);

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/admins?search=${encodeURIComponent(search)}&status=${statusFilter}&page=${pagination.page}&limit=${pagination.limit}`);
      const data = await res.json();
      if (data.success) {
        setAdmins(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to load admins', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, [search, statusFilter, pagination.page]);

  const handleAdminAction = async (adminId: string, action: string, extraPayload: any = {}) => {
    try {
      const res = await fetch(`/api/super-admin/admins/${adminId}`, {
        method: action === 'DELETE' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraPayload }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAdmins();
        if (action === 'DELETE') {
          if (selectedAdmin && selectedAdmin.id === adminId) {
            setSelectedAdmin(null);
            setIsDetailsOpen(false);
          }
        } else if (selectedAdmin && selectedAdmin.id === adminId) {
          const updatedAdmin = { ...selectedAdmin, ...(data.data || { status: action === 'ACTIVATE' ? 'ACTIVE' : action === 'SUSPEND' ? 'SUSPENDED' : selectedAdmin.status }) };
          setSelectedAdmin(updatedAdmin);
          if (data.data?.permissions) {
            setEditingPermissions(normalizeAdminUiPermissions(data.data.permissions));
          }
        }
      } else {
        alert(data.error || 'Failed to update administrator account.');
      }
    } catch (err) {
      console.error('Failed to update admin', err);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      phone: '',
      position: '',
      password: '',
      confirmPassword: '',
      permissions: [...DEFAULT_OPERATIONS_PERMS],
    });
    setCreateStep('form');
    setCreateError(null);
    setCreateLoading(false);
    setShowPassword(false);
    setShowConfirm(false);
  };

  const handleContinueToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Client-side validation
    if (!createForm.firstName.trim() || !createForm.lastName.trim()) {
      setCreateError("Please enter the administrator's full name.");
      return;
    }
    if (!createForm.username.trim() || createForm.username.trim().length < 3) {
      setCreateError('Username is required (minimum 3 characters).');
      return;
    }
    if (!createForm.email.trim()) {
      setCreateError('Please enter a valid email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createForm.email.trim())) {
      setCreateError('Please enter a valid email address.');
      return;
    }
    const passwordVal = validatePassword(createForm.password, 12);
    if (!passwordVal.isValid) {
      setCreateError(`Password does not meet security requirements: missing ${passwordVal.errors.join(', ')}.`);
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('Passwords do not match.');
      return;
    }
    if (!createForm.position.trim()) {
      setCreateError('Position is required.');
      return;
    }

    setCreateStep('review');
  };

  const handleSendInvitation = async () => {
    setCreateError(null);
    setCreateLoading(true);

    try {
      const res = await fetch('/api/super-admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: createForm.firstName.trim(),
          lastName: createForm.lastName.trim(),
          username: createForm.username.trim(),
          email: createForm.email.trim(),
          phone: createForm.phone.trim(),
          position: createForm.position.trim(),
          password: createForm.password,
          permissions: createForm.permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCreateError(
          (data.error || 'Failed to create administrator account.') +
            (data.details ? ` (${data.details})` : '')
        );
        setCreateLoading(false);
        return;
      }

      setCreateStep('success');
      setCreateLoading(false);
      fetchAdmins();
    } catch {
      setCreateError('Network error while creating admin.');
      setCreateLoading(false);
    }
  };

  const handleResendInvitation = async (adminId: string) => {
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/super-admin/admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESEND_INVITATION' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback({
          type: 'success',
          message: data.message || 'Confirmation email resent successfully.',
        });
        fetchAdmins();
      } else {
        setActionFeedback({
          type: 'error',
          message: data.error || 'Failed to resend confirmation email.',
        });
      }
    } catch (err) {
      console.error('Failed to resend invitation', err);
      setActionFeedback({
        type: 'error',
        message: 'Network error while resending confirmation email.',
      });
    }
  };

  const openAdminDetails = async (adminId: string) => {
    try {
      const res = await fetch(`/api/super-admin/admins/${adminId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedAdmin(data.data);
        setEditingPermissions(normalizeAdminUiPermissions(data.data.permissions));
        setIsDetailsOpen(true);
      }
    } catch (err) {
      console.error('Failed to load admin details', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/80">
              Governance Staff
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-heading flex items-center gap-2">
            <span>Administrators Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Provision, manage, and audit Admin accounts. Invitation-based verification ensures secure onboarding.
          </p>
        </div>

        <div className="relative z-10">
          <button
            onClick={() => { setIsCreateOpen(true); resetCreateForm(); }}
            className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Admin Account</span>
          </button>
        </div>
      </motion.div>

      {actionFeedback && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-medium ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs"
      >
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'ACTIVE', 'PENDING', 'SUSPENDED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium uppercase whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === status
                  ? 'bg-sky-600 text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {status === 'ALL' ? 'ALL ACCOUNTS' : status}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Admins Table */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs transition-colors duration-200"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200">
            <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Administrator</th>
                <th className="py-3 px-4">Position</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Email Verified</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No administrator accounts found matching criteria.
                  </td>
                </tr>
              ) : (
                admins.map((adm) => (
                  <tr
                    key={adm.id}
                    onClick={() => openAdminDetails(adm.id)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={adm.avatarUrl}
                          firstName={adm.firstName}
                          lastName={adm.lastName}
                          alt={`${adm.firstName || ''} ${adm.lastName || ''}`.trim() || 'Administrator'}
                          className="w-8 h-8 rounded-lg border border-sky-200 dark:border-sky-800/80 shadow-2xs"
                          fallbackClassName="bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold text-xs font-mono"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {adm.firstName} {adm.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{adm.email}</div>
                          {adm.username && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">@{adm.username}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-700 dark:text-slate-300 text-xs">{adm.position || '—'}</div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {Array.isArray(adm.permissions) && adm.permissions.length > 0
                            ? `${adm.permissions.length} modules`
                            : 'Default Ops'}
                        </span>
                        {Array.isArray(adm.permissions) && adm.permissions.some((p: string) => isFinancialPermissionId(p)) ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            Billing
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                            Non-Billing
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                          adm.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80'
                            : adm.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/80'
                            : adm.status === 'SUSPENDED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/80'
                            : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          adm.status === 'ACTIVE' ? 'bg-emerald-500' : adm.status === 'PENDING' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                        }`} />
                        {adm.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {adm.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-mono">
                          <Clock className="w-3.5 h-3.5" /> Awaiting
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {adm.createdAt ? new Date(adm.createdAt).toLocaleDateString([], { dateStyle: 'medium' }) : '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {adm.status === 'PENDING' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResendInvitation(adm.id);
                            }}
                            className="h-8 text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5 mr-1" />
                            Resend
                          </Button>
                        )}

                        {adm.status === 'ACTIVE' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmModal({
                                isOpen: true,
                                title: 'Suspend Administrator Account',
                                message: `Are you sure you want to suspend access for ${adm.firstName} ${adm.lastName} (${adm.email})?`,
                                onConfirm: () => {
                                  setStepUpAction({ action: 'SUSPEND', adminId: adm.id });
                                  setStepUpOpen(true);
                                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                                },
                              });
                            }}
                            className="h-8 text-xs cursor-pointer"
                          >
                            Suspend
                          </Button>
                        )}

                        {adm.status === 'SUSPENDED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdminAction(adm.id, 'ACTIVATE');
                            }}
                            className="h-8 text-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Activate
                          </Button>
                        )}

                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmModal({
                              isOpen: true,
                              title: 'Delete Administrator Account',
                              message: `Are you sure you want to permanently delete the administrator account for ${adm.firstName} ${adm.lastName}? This action cannot be undone.`,
                              onConfirm: () => {
                                setStepUpAction({ action: 'DELETE', adminId: adm.id });
                                setStepUpOpen(true);
                                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                              },
                            });
                          }}
                          className="h-8 text-xs cursor-pointer px-2"
                          title="Permanently Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
          <div>
            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} admins
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary" size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="h-7 text-xs px-2 cursor-pointer"
            >
              Previous
            </Button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <Button
              variant="secondary" size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="h-7 text-xs px-2 cursor-pointer"
            >
              Next
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════ MODAL: Create Admin ═══════════════════ */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCreateOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-10 text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col my-auto">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer z-30"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-8 mt-10 pr-12 sm:pr-14">
                <div className={`flex items-center gap-1.5 text-xs font-bold ${createStep === 'form' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono ${createStep === 'form' ? 'bg-sky-500 text-white' : createStep === 'review' || createStep === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>1</span>
                  Information
                </div>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <div className={`flex items-center gap-1.5 text-xs font-bold ${createStep === 'review' ? 'text-sky-600 dark:text-sky-400' : createStep === 'success' ? 'text-emerald-500' : 'text-slate-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono ${createStep === 'review' ? 'bg-sky-500 text-white' : createStep === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>2</span>
                  Review
                </div>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <div className={`flex items-center gap-1.5 text-xs font-bold ${createStep === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono ${createStep === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>3</span>
                  Complete
                </div>
              </div>

              {/* ───── STEP 1: Form ───── */}
              {createStep === 'form' && (
                <form onSubmit={handleContinueToReview} className="flex flex-col flex-1 overflow-hidden">
                  <div ref={formScrollRef} className="flex-1 overflow-y-auto pr-1 space-y-5">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-[#F7F9FC] font-heading">Create Administrator</h3>
                      <p className="text-sm text-slate-500 dark:text-[#CBD5E1] mt-0.5">Enter the new admin's information and initial password. They'll receive a confirmation email to verify ownership and activate their account.</p>
                    </div>
                  </div>

                  {createError && (
                    <div ref={errorRef} className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
                      {createError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <NeuralInput
                      label="First Name"
                      placeholder="e.g. Maria"
                      value={createForm.firstName}
                      onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                      required
                    />
                    <NeuralInput
                      label="Last Name"
                      placeholder="e.g. Santos"
                      value={createForm.lastName}
                      onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <NeuralInput
                      label="Username"
                      placeholder="e.g. msantos"
                      value={createForm.username}
                      onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })}
                      required
                    />
                    <NeuralInput
                      label="Position"
                      placeholder="e.g. Training Administrator"
                      value={createForm.position}
                      onChange={(e) => setCreateForm({ ...createForm, position: e.target.value })}
                      required
                    />
                  </div>

                  <NeuralInput
                    label="Email Address"
                    type="email"
                    placeholder="e.g. m.santos@gmail.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
                    <div>
                      <NeuralInput
                        label="Initial Password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter a secure password"
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                        required
                        rightAction={
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-sky-500 cursor-pointer mr-2">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        }
                      />
                      {createForm.password && (
                        <div className="mt-2.5">
                          <PasswordStrength password={createForm.password} minLength={12} />
                        </div>
                      )}
                    </div>
                    <div>
                      <NeuralInput
                        label="Confirm Password"
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirm password"
                        value={createForm.confirmPassword}
                        onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                        required
                        rightAction={
                          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-slate-400 hover:text-sky-500 cursor-pointer mr-2">
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        }
                      />
                      {createForm.confirmPassword && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                          {createForm.password === createForm.confirmPassword ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Passwords match
                            </span>
                          ) : (
                            <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1 font-medium">
                              <XCircle className="w-3.5 h-3.5 shrink-0" /> Passwords do not match
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <NeuralInput
                    label="Phone Number (Optional)"
                    type="text"
                    placeholder="e.g. 09171234567"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  />

                  {/* Least-Privilege Admin Module Permissions */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-sky-500" />
                          Module Permissions ({createForm.permissions.length} selected)
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Assign only the Admin modules required for this account&apos;s role. Billing permissions are isolated to Finance staff.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {ADMIN_ROLE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            const presetPositions = new Set(ADMIN_ROLE_PRESETS.map((p) => p.position));
                            const nextPos = !createForm.position.trim() || presetPositions.has(createForm.position.trim())
                              ? preset.position
                              : createForm.position;
                            setCreateForm((prev) => ({
                              ...prev,
                              position: nextPos,
                              permissions: [...preset.permissions],
                            }));
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-sky-500/50 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                      {ADMIN_PERMISSION_CATALOG.map((perm) => {
                        const checked = createForm.permissions.includes(perm.id);
                        return (
                          <button
                            key={perm.id}
                            type="button"
                            onClick={() => {
                              setCreateForm((prev) => ({
                                ...prev,
                                permissions: checked
                                  ? prev.permissions.filter((id) => id !== perm.id)
                                  : [...prev.permissions, perm.id],
                              }));
                            }}
                            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[11px] transition-colors cursor-pointer ${
                              checked
                                ? 'bg-sky-500/10 border-sky-500/40 text-slate-900 dark:text-white'
                                : 'bg-white/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            <span className="truncate font-medium">{perm.name}</span>
                            {perm.isFinancial && (
                              <span className="shrink-0 text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                Billing
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  </div>
                  <div className="shrink-0 flex justify-end gap-3 pt-5 mt-5 border-t border-slate-200 dark:border-slate-800">
                    <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                      Continue to Review
                    </Button>
                  </div>
                </form>
              )}

              {/* ───── STEP 2: Review ───── */}
              {createStep === 'review' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-sky-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-[#F7F9FC] font-heading">Review Administrator</h3>
                      <p className="text-xs text-slate-500 dark:text-[#CBD5E1]">Confirm the details before sending the invitation.</p>
                    </div>
                  </div>

                  {createError && (
                    <div ref={errorRef} className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
                      {createError}
                    </div>
                  )}

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-white/10">
                    {[
                      ['Full Name', `${createForm.firstName} ${createForm.lastName}`],
                      ['Username', `@${createForm.username}`],
                      ['Email', createForm.email],
                      ['Phone', createForm.phone || '—'],
                      ['Position', createForm.position],
                      ['Role', 'ADMIN'],
                      [
                        'Module Scope',
                        `${createForm.permissions.length} modules (${createForm.permissions.some((p) => isFinancialPermissionId(p)) ? 'Includes Billing' : 'Non-Billing'})`,
                      ],
                      ['Initial Status', 'PENDING'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between items-center px-4 py-3">
                        <span className="text-[11px] text-slate-500 dark:text-[#CBD5E1] font-mono uppercase">{label}</span>
                        <span className={`text-sm font-bold ${
                          label === 'Role' ? 'text-sky-600 dark:text-sky-400' :
                          label === 'Initial Status' ? 'text-amber-600 dark:text-amber-400' :
                          'text-slate-900 dark:text-[#F7F9FC]'
                        }`}>{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-400/30 text-sky-700 dark:text-sky-300 text-xs">
                    <Mail className="w-3.5 h-3.5 inline mr-1.5" />
                    A confirmation email with a <strong>"Confirm Account"</strong> button will be sent to <strong>{createForm.email}</strong>. The account will automatically activate once the email is verified.
                  </div>

                  <div className="flex justify-between gap-3 pt-8 mt-10 border-t border-slate-200 dark:border-slate-800">
                    <Button type="button" variant="ghost" onClick={() => { setCreateStep('form'); setCreateError(null); }}>
                      <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                      Back
                    </Button>
                    <Button variant="primary" isLoading={createLoading} onClick={handleSendInvitation}>
                      {createLoading ? 'Sending Invitation...' : 'Send Invitation'}
                    </Button>
                  </div>
                </div>
              )}

              {/* ───── STEP 3: Success ───── */}
              {createStep === 'success' && (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 text-center space-y-4 my-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-[#F7F9FC]">Account Created & Invitation Sent</h4>
                  <p className="text-xs text-slate-600 dark:text-[#CBD5E1]">
                    The administrator account has been created with <strong>PENDING</strong> status. A confirmation email has been sent to <strong>{createForm.email}</strong>.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#CBD5E1]">
                    The admin must click <strong>"Confirm Account"</strong> in their email to verify ownership and activate their account.
                  </p>
                  <Button onClick={() => setIsCreateOpen(false)} className="w-full cursor-pointer">
                    Done
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ DRAWER: Admin Details ═══════════════════ */}
      <AnimatePresence>
        {isDetailsOpen && selectedAdmin && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDetailsOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }} className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border-l border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-10 text-slate-900 dark:text-slate-100 overflow-y-auto flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={selectedAdmin.avatarUrl}
                      firstName={selectedAdmin.firstName}
                      lastName={selectedAdmin.lastName}
                      alt={`${selectedAdmin.firstName || ''} ${selectedAdmin.lastName || ''}`.trim() || 'Administrator'}
                      className="w-10 h-10 rounded-xl border border-sky-400/40 shadow-sm"
                      fallbackClassName="bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sky-600 dark:text-sky-400 font-bold text-sm font-mono"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-[#F7F9FC]">{selectedAdmin.firstName} {selectedAdmin.lastName}</h3>
                      <p className="text-xs text-slate-500 dark:text-[#CBD5E1] font-mono">{selectedAdmin.email}</p>
                      {selectedAdmin.username && (
                        <p className="text-[10px] text-slate-400 dark:text-[#94A3B8] font-mono">@{selectedAdmin.username}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDetailsOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0 ml-4"
                    aria-label="Close drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-inner">
                    <span className="text-[10px] text-slate-500 dark:text-[#CBD5E1] font-mono uppercase">Account Status</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-[#F7F9FC] mt-0.5">{selectedAdmin.status}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-inner">
                    <span className="text-[10px] text-slate-500 dark:text-[#CBD5E1] font-mono uppercase">Position</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-[#F7F9FC] mt-0.5">{selectedAdmin.position || '—'}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-inner">
                    <span className="text-[10px] text-slate-500 dark:text-[#CBD5E1] font-mono uppercase">Phone</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-[#F7F9FC] mt-0.5">{selectedAdmin.phone || '—'}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-inner">
                    <span className="text-[10px] text-slate-500 dark:text-[#CBD5E1] font-mono uppercase">Created</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-[#F7F9FC] mt-0.5">{selectedAdmin.createdAt ? new Date(selectedAdmin.createdAt).toLocaleDateString() : '—'}</div>
                  </div>
                </div>

                {/* Per-Admin Module Permissions */}
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-[#CBD5E1] uppercase font-heading flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-sky-500" />
                      Assigned Module Privileges ({editingPermissions.length})
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {editingPermissions.some((p) => isFinancialPermissionId(p)) ? 'Billing Enabled' : 'Non-Billing'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {ADMIN_ROLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setEditingPermissions([...preset.permissions])}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-sky-500/50 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {ADMIN_PERMISSION_CATALOG.map((perm) => {
                      const active = editingPermissions.includes(perm.id);
                      return (
                        <button
                          key={perm.id}
                          type="button"
                          onClick={() =>
                            setEditingPermissions((prev) =>
                              active ? prev.filter((id) => id !== perm.id) : [...prev, perm.id]
                            )
                          }
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-sky-500/10 border-sky-500/40 text-slate-900 dark:text-white'
                              : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{perm.name}</div>
                            <div className="text-[10px] font-mono opacity-75">{perm.id}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {perm.isFinancial && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                Billing
                              </span>
                            )}
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                                active
                                  ? 'bg-sky-500 text-white'
                                  : 'border border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {active ? '✓' : ''}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setStepUpAction({
                        action: 'UPDATE_PERMISSIONS',
                        adminId: selectedAdmin.id,
                        payload: { permissions: editingPermissions },
                      });
                      setStepUpOpen(true);
                    }}
                    className="w-full text-xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save Module Privileges
                  </Button>
                </div>

                {/* Security Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-700 dark:text-[#CBD5E1] uppercase font-heading">Admin Actions</span>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedAdmin.status === 'PENDING' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResendInvitation(selectedAdmin.id)}
                        className="text-xs justify-start cursor-pointer col-span-2"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                        Resend Invitation
                      </Button>
                    )}
                    {selectedAdmin.status === 'ACTIVE' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: 'Suspend Administrator Account',
                            message: `Are you sure you want to suspend access for ${selectedAdmin.firstName} ${selectedAdmin.lastName}?`,
                            onConfirm: () => {
                              setStepUpAction({ action: 'SUSPEND', adminId: selectedAdmin.id });
                              setStepUpOpen(true);
                              setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                            },
                          });
                        }}
                        className="text-xs justify-start cursor-pointer col-span-2"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
                        Suspend Administrator
                      </Button>
                    )}
                    {selectedAdmin.status === 'SUSPENDED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAdminAction(selectedAdmin.id, 'ACTIVATE')}
                        className="text-xs justify-start cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white col-span-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Activate Administrator
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setStepUpAction({ action: 'RESET_MFA', adminId: selectedAdmin.id });
                        setStepUpOpen(true);
                      }}
                      className="text-xs justify-start cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                      Reset MFA Key
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAdminAction(selectedAdmin.id, 'REQUIRE_PASSWORD_RESET')}
                      className="text-xs justify-start cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                      Require Password Reset
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Delete Administrator Account',
                          message: `Are you sure you want to permanently delete the administrator account for ${selectedAdmin.firstName} ${selectedAdmin.lastName}? This action cannot be undone.`,
                          onConfirm: () => {
                            setStepUpAction({ action: 'DELETE', adminId: selectedAdmin.id });
                            setStepUpOpen(true);
                            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                            setIsDetailsOpen(false);
                          },
                        });
                      }}
                      className="text-xs justify-start cursor-pointer col-span-2"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Permanently Delete Admin
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button variant="ghost" onClick={() => setIsDetailsOpen(false)} className="w-full cursor-pointer">
                  Close Inspector
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Step-Up Auth Modal */}
      <StepUpAuthModal
        isOpen={stepUpOpen}
        onClose={() => { setStepUpOpen(false); setStepUpAction(null); }}
        onSuccess={() => {
          if (stepUpAction) {
            handleAdminAction(stepUpAction.adminId, stepUpAction.action, stepUpAction.payload);
            setStepUpAction(null);
          }
        }}
        actionName={stepUpAction?.action || 'ADMIN_PRIVILEGE_CHANGE'}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}

