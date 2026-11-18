'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ban,
  CheckCircle,
  Users,
  Search,
  Filter,
  Plus,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Shield,
  BookOpen,
  Calendar,
  Award,
  CreditCard,
  ChevronRight,
  X,
  Mail,
  Send,
  Phone,
  MapPin,
  Ship,
  Eye,
  EyeOff,
  ArrowLeft,
  Sparkles,
  Download,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { Button, NeuralInput, PasswordStrength, UserAvatar } from '@newsim/ui';
import { validatePassword } from '@newsim/utils';
import { ConfirmationModal } from '@/components/super-admin/ConfirmationModal';
import { StepUpAuthModal } from '@/components/super-admin/StepUpAuthModal';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function TraineesClient() {
  const [trainees, setTrainees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL ACCOUNTS');
  const [selectedTrainee, setSelectedTrainee] = useState<any | null>(null);
  const [traineeDrawerDetails, setTraineeDrawerDetails] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'enrollments' | 'assessments' | 'attendance' | 'certificates'>('profile');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpAction, setStepUpAction] = useState<{ action: string; traineeId: string } | null>(null);
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
  const [createStep, setCreateStep] = useState<'form' | 'review' | 'success'>('form');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editingSrn, setEditingSrn] = useState(false);
  const [srnInputValue, setSrnInputValue] = useState('');
  const [savingAdminSrn, setSavingAdminSrn] = useState(false);

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
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    srn: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const fetchTrainees = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (statusFilter !== 'ALL ACCOUNTS') query.set('status', statusFilter);

      const res = await fetch(`/api/super-admin/trainees?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTrainees(json.data);
      }
    } catch (err) {
      console.error('Failed to load trainees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainees();
  }, [search, statusFilter]);

  const handleSelectTrainee = async (trainee: any) => {
    setSelectedTrainee(trainee);
    setActiveTab('profile');
    try {
      setDrawerLoading(true);
      const res = await fetch(`/api/super-admin/trainees/${trainee.id}`);
      const json = await res.json();
      if (json.success) {
        setTraineeDrawerDetails(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleContinueToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setCreateError("Please enter the trainee's full name.");
      return;
    }
    if (!formData.srn.trim()) {
      setCreateError('SRN is required.');
      return;
    }
    if (!formData.email.trim()) {
      setCreateError('Please enter a valid email address.');
      return;
    }
    const passwordVal = validatePassword(formData.password, 12);
    if (!passwordVal.isValid) {
      setCreateError(`Password does not meet security requirements: missing ${passwordVal.errors.join(', ')}.`);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setCreateError('Passwords do not match.');
      return;
    }

    setCreateStep('review');
  };

  const resetCreateForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      srn: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
    });
    setCreateStep('form');
    setCreateError(null);
    setCreateLoading(false);
    setShowPassword(false);
    setShowConfirm(false);
  };

  const openCreateModal = () => {
    resetCreateForm();
    setAddModalOpen(true);
  };

  const closeCreateModal = () => {
    setAddModalOpen(false);
    resetCreateForm();
  };

  const handleCreateTrainee = async () => {
    setCreateError(null);
    setCreateLoading(true);
    try {
      const res = await fetch('/api/super-admin/trainees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          srn: formData.srn.trim(),
          email: formData.email.trim(),
          password: formData.password,
          phone: formData.phone?.trim() || null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCreateStep('success');
        fetchTrainees();
      } else {
        const message = json.details ? `${json.error} (${json.details})` : (json.error || 'Failed to create trainee account.');
        setCreateError(message);
      }
    } catch (err) {
      console.error(err);
      setCreateError('Network error while creating trainee.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteTrainee = async (id: string) => {
    try {
      const res = await fetch('/api/super-admin/trainees/' + id, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchTrainees();
        if (selectedTrainee?.id === id) {
          setSelectedTrainee(null);
          setTraineeDrawerDetails(null);
        }
      } else {
        alert(json.error || 'Failed to delete trainee');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while deleting');
    }
  };

  const handleResendInvitation = async (id: string) => {
    try {
      const res = await fetch(`/api/super-admin/trainees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESEND_INVITATION' }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Confirmation email resent successfully.');
      } else {
        alert(data.error || 'Failed to resend confirmation email.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to resend confirmation email.');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/super-admin/trainees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        fetchTrainees();
        if (selectedTrainee?.id === id) {
          setSelectedTrainee({ ...selectedTrainee, status: newStatus });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="relative overflow-hidden rounded-2xl p-6 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/80">
                Seafarer Database
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
              Trainee Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl">
              Inspect seafarer profiles, monitor enrollment progression, review attendance logs, and verify STCW certification eligibility.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Trainee Account</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SRN, email, rank..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 shadow-2xs transition-colors"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL ACCOUNTS', 'ACTIVE', 'PENDING', 'SUSPENDED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium uppercase whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === status
                  ? 'bg-sky-600 text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {status}
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
        className="rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200">
            <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Trainee</th>
                <th className="py-3 px-4">SRN</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Email Verified</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800/70 rounded" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : trainees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No trainee accounts found matching criteria.
                  </td>
                </tr>
              ) : (
                trainees.map((trainee) => (
                  <tr key={trainee.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer" onClick={() => handleSelectTrainee(trainee)}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={trainee.avatarUrl}
                          firstName={trainee.firstName}
                          lastName={trainee.lastName}
                          alt={`${trainee.firstName || ''} ${trainee.lastName || ''}`.trim() || 'Trainee'}
                          className="w-8 h-8 rounded-lg border border-sky-200 dark:border-sky-800/80 shadow-2xs"
                          fallbackClassName="bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold text-xs font-mono"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {trainee.firstName} {trainee.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{trainee.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-700 dark:text-slate-300 text-xs font-mono">{trainee.srn || '—'}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                          trainee.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80'
                            : trainee.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/80'
                            : trainee.status === 'SUSPENDED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/80'
                            : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          trainee.status === 'ACTIVE' ? 'bg-emerald-500' : trainee.status === 'PENDING' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                        }`} />
                        {trainee.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {trainee.status === 'ACTIVE' ? (
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
                      {trainee.createdAt ? new Date(trainee.createdAt).toLocaleDateString([], { dateStyle: 'medium' }) : '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {trainee.status === 'PENDING' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResendInvitation(trainee.id);
                            }}
                            className="h-8 text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5 mr-1" />
                            Resend
                          </Button>
                        )}

                        {trainee.status === 'ACTIVE' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmModal({
                                isOpen: true,
                                title: 'Suspend Trainee Account',
                                message: `Are you sure you want to suspend access for ${trainee.firstName} ${trainee.lastName} (${trainee.email})?`,
                                onConfirm: () => {
                                  setStepUpAction({ action: 'SUSPEND', traineeId: trainee.id });
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

                        {trainee.status === 'SUSPENDED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(trainee.id, 'ACTIVE'); }}
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
                              title: 'Delete Trainee Account',
                              message: `Are you sure you want to permanently delete the trainee account for ${trainee.firstName} ${trainee.lastName}? This action cannot be undone.`,
                              onConfirm: () => {
                                setStepUpAction({ action: 'DELETE', traineeId: trainee.id });
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
      </motion.div>

      {/* Trainee Details Drawer */}
      <AnimatePresence>
        {selectedTrainee && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTrainee(null)} />
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ duration: 0.25, ease: easeCurve }}
              className="fixed top-0 bottom-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-[#0c1a2c] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#0c1a2c]">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={selectedTrainee.avatarUrl}
                    firstName={selectedTrainee.firstName}
                    lastName={selectedTrainee.lastName}
                    alt={`${selectedTrainee.firstName || ''} ${selectedTrainee.lastName || ''}`.trim() || 'Trainee'}
                    className="w-10 h-10 rounded-2xl shadow-md"
                    fallbackClassName="bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-mono font-bold"
                  />
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                      {selectedTrainee.firstName} {selectedTrainee.lastName}
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">{selectedTrainee.srn} • {selectedTrainee.rank}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTrainee(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0 ml-4"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-5 border-b border-slate-200 dark:border-slate-800 flex gap-3 overflow-x-auto text-xs font-mono">
                {[
                  { id: 'profile', label: 'Profile' },
                  { id: 'enrollments', label: 'Training History' },
                  { id: 'assessments', label: 'Grades & Exams' },
                  { id: 'attendance', label: 'Attendance' },
                  { id: 'certificates', label: 'Certificates' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-3 border-b-2 font-bold transition-all ${
                      activeTab === tab.id
                        ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
                {activeTab === 'profile' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400">Email</span>
                        <div className="font-semibold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-1 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-sky-500" /> {selectedTrainee.email}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400">Phone</span>
                        <div className="font-semibold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-1 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-sky-500" /> {selectedTrainee.phone}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400">Vessel Type</span>
                        <div className="font-semibold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-1 mt-0.5">
                          <Ship className="w-3.5 h-3.5 text-indigo-500" /> {selectedTrainee.vesselType}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400">Primary Campus</span>
                        <div className="font-semibold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" /> {selectedTrainee.centerName}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Seafarer Registration Number (SRN)</span>
                        {!editingSrn && (
                          <button
                            type="button"
                            onClick={() => {
                              setSrnInputValue(selectedTrainee.srn || '');
                              setEditingSrn(true);
                            }}
                            className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                          >
                            Edit SRN
                          </button>
                        )}
                      </div>

                      {editingSrn ? (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={srnInputValue}
                            onChange={(e) => setSrnInputValue(e.target.value)}
                            placeholder="Enter 10-digit SRN"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white outline-none focus:border-sky-500"
                          />
                          <button
                            type="button"
                            disabled={savingAdminSrn || !srnInputValue.trim()}
                            onClick={async () => {
                              try {
                                setSavingAdminSrn(true);
                                const res = await fetch(`/api/super-admin/trainees/${selectedTrainee.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ srn: srnInputValue.trim() }),
                                });
                                const json = await res.json();
                                if (json.success) {
                                  setSelectedTrainee({ ...selectedTrainee, srn: srnInputValue.trim() });
                                  setEditingSrn(false);
                                  fetchTrainees();
                                } else {
                                  alert(json.error || 'Failed to update SRN.');
                                }
                              } catch (e: any) {
                                alert(e?.message || 'Error updating SRN.');
                              } finally {
                                setSavingAdminSrn(false);
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-mono font-bold text-xs disabled:opacity-50 cursor-pointer"
                          >
                            {savingAdminSrn ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            disabled={savingAdminSrn}
                            onClick={() => setEditingSrn(false)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="font-semibold text-slate-900 dark:text-[#F8FAFC] font-mono text-xs flex items-center gap-1.5 mt-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            {selectedTrainee.srn || 'SRN Not Assigned'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800 space-y-3">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Operational Status Controls</span>
                      <div className="flex items-center gap-2">
                        {['ACTIVE', 'PENDING', 'SUSPENDED', 'COMPLETED'].map((st) => (
                          <button
                            key={st}
                            onClick={() => handleStatusChange(selectedTrainee.id, st)}
                            className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold ${
                              selectedTrainee.status === st
                                ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-sm'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1]'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800 space-y-3">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Trainee Actions</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedTrainee.status === 'PENDING' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleResendInvitation(selectedTrainee.id)}
                            className="text-xs justify-start cursor-pointer col-span-2"
                          >
                            <Send className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                            Resend Confirmation Email
                          </Button>
                        )}
                        {selectedTrainee.status === 'ACTIVE' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: 'Suspend Trainee Account',
                                message: `Are you sure you want to suspend access for ${selectedTrainee.firstName} ${selectedTrainee.lastName} (${selectedTrainee.email})?`,
                                onConfirm: () => {
                                  setStepUpAction({ action: 'SUSPEND', traineeId: selectedTrainee.id });
                                  setStepUpOpen(true);
                                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                                },
                              });
                            }}
                            className="text-xs justify-start cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
                            Suspend Trainee
                          </Button>
                        )}
                        {selectedTrainee.status === 'SUSPENDED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStatusChange(selectedTrainee.id, 'ACTIVE')}
                            className="text-xs justify-start cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Activate Trainee
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Delete Trainee Account',
                              message: `Are you sure you want to permanently delete the trainee account for ${selectedTrainee.firstName} ${selectedTrainee.lastName}? This action cannot be undone.`,
                              onConfirm: () => {
                                setStepUpAction({ action: 'DELETE', traineeId: selectedTrainee.id });
                                setStepUpOpen(true);
                                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                              },
                            });
                          }}
                          className="text-xs justify-start cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Permanently Delete Trainee
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'enrollments' && (
                  <div className="space-y-3">
                    {traineeDrawerDetails?.enrollments?.length ? (
                      traineeDrawerDetails.enrollments.map((e: any) => (
                        <div key={e.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{e.courseTitle}</div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-600 border border-sky-500/30">
                              {e.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-500">
                            <span>{e.enrollmentNo}</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                              {e.courseCategory || 'MODULAR + PRACTICAL'}
                            </span>
                            <span>•</span>
                            <span>Instructor Role: {e.instructorPurpose || 'PRACTICAL_TRAINING'}</span>
                          </div>
                          {e.reviewNotes && (
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                              {e.reviewNotes}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-slate-400 font-mono">No training history or enrollments for this trainee.</div>
                    )}
                  </div>
                )}

                {activeTab === 'assessments' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                        Written Assessments &amp; Quizzes (Passing Standard: 75%)
                      </span>
                      {traineeDrawerDetails?.assessmentAttempts?.length ? (
                        traineeDrawerDetails.assessmentAttempts.map((att: any) => (
                          <div key={att.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                            <div>
                              <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{att.title}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {att.courseCode} • {att.type === 'POST_TEST' ? 'Course Post-Test' : 'Module Quiz'} • Pass: {att.passingScore}%
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                              att.passed
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            }`}>
                              {att.scoreDisplay} • {att.passed ? 'PASSED' : 'FAILED'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="py-4 text-center text-slate-400 font-mono">No assessment attempts recorded yet.</div>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                        Course Grades &amp; Practical Evaluations
                      </span>
                      {traineeDrawerDetails?.grades?.length ? (
                        traineeDrawerDetails.grades.map((g: any) => (
                          <div key={g.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{g.courseCode} — {g.courseTitle}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Theory: {g.moduleScore}% • Practical: {g.practicalScore}% • Attendance: {g.attendanceScore}%
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-600 border border-sky-500/30">
                              Final: {g.finalScore}% ({g.status})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="py-4 text-center text-slate-400 font-mono">No finalized course grades yet.</div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'attendance' && (
                  <div className="space-y-3">
                    {traineeDrawerDetails?.attendance?.length ? (
                      traineeDrawerDetails.attendance.map((a: any) => (
                        <div key={a.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{a.courseTitle}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{a.date} • {a.sessionCode} ({a.room})</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${a.status === 'PRESENT' ? 'bg-sky-500/15 text-sky-600' : 'bg-amber-500/15 text-amber-600'}`}>
                            {a.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-slate-400 font-mono">No attendance records logged yet.</div>
                    )}
                  </div>
                )}

                {activeTab === 'certificates' && (
                  <div className="space-y-3">
                    {traineeDrawerDetails?.certificates?.length ? (
                      traineeDrawerDetails.certificates.map((c: any) => {
                        const vStatus = c.validityStatus || c.status || 'VALID';
                        const badgeStyle =
                          vStatus === 'VALID'
                            ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                            : vStatus === 'NEAR_EXPIRATION'
                            ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                            : vStatus === 'EXPIRED'
                            ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                            : 'bg-sky-500/15 text-sky-600 border-sky-500/30';
                        return (
                          <div key={c.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{c.courseTitle}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{c.certificateNo} • Exp: {c.expiryDate || 'No Expiration'}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeStyle}`}>
                              {vStatus}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-slate-400 font-mono">No certificates issued yet.</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════ MODAL: Create Trainee ═══════════════════ */}
      <AnimatePresence>
        {addModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCreateModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-10 text-slate-900 dark:text-[#F7F9FC] max-h-[90vh] flex flex-col my-auto"
            >
              <button
                onClick={closeCreateModal}
                className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer z-30"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Step indicator */}
              <div className="shrink-0 flex items-center gap-2 mb-8 mt-10 pr-12 sm:pr-14">
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
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-[#F7F9FC] font-heading">Create Trainee</h3>
                        <p className="text-sm text-slate-500 dark:text-[#CBD5E1] mt-0.5">Enter the new trainee's information. They'll receive an email to verify and activate their account.</p>
                      </div>
                    </div>

                    {createError && (
                      <div ref={errorRef} className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
                        {createError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <NeuralInput
                        label="First Name"
                        placeholder="e.g. Maria"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                      />
                      <NeuralInput
                        label="Last Name"
                        placeholder="e.g. Santos"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <NeuralInput
                        label="SRN *"
                        placeholder="e.g. 12345678"
                        value={formData.srn}
                        onChange={(e) => setFormData({ ...formData, srn: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                        required
                      />
                      <NeuralInput
                        label="Email Address *"
                        placeholder="e.g. trainee@maritime.ph"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
                      <div>
                        <NeuralInput
                          label="Initial Password *"
                          placeholder="Enter a secure password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                          autoComplete="new-password"
                          rightAction={
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-sky-500 cursor-pointer mr-2">
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          }
                        />
                        {formData.password && (
                          <div className="mt-2.5">
                            <PasswordStrength password={formData.password} minLength={12} />
                          </div>
                        )}
                      </div>
                      <div>
                        <NeuralInput
                          label="Confirm Password *"
                          placeholder="Confirm password"
                          type={showConfirm ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          required
                          autoComplete="new-password"
                          rightAction={
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-slate-400 hover:text-sky-500 cursor-pointer mr-2">
                              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          }
                        />
                        {formData.confirmPassword && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                            {formData.password === formData.confirmPassword ? (
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
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  {/* Always Visible Pinned Footer */}
                  <div className="shrink-0 flex justify-end gap-3 pt-5 mt-5 border-t border-slate-200 dark:border-slate-800">
                    <Button type="button" variant="ghost" onClick={closeCreateModal}>
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
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-sky-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-[#F7F9FC] font-heading">Review Trainee</h3>
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
                        ['Full Name', `${formData.firstName} ${formData.lastName}`],
                        ['SRN', formData.srn],
                        ['Email', formData.email],
                        ['Phone', formData.phone || '—'],
                        ['Role', 'TRAINEE'],
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
                      An invitation email with a <strong>"Confirm Account"</strong> button will be sent to <strong>{formData.email}</strong>. The account will automatically activate once the email is verified.
                    </div>
                  </div>

                  {/* Always Visible Pinned Footer */}
                  <div className="shrink-0 flex justify-between gap-3 pt-5 mt-5 border-t border-slate-200 dark:border-slate-800">
                    <Button type="button" variant="ghost" onClick={() => { setCreateStep('form'); setCreateError(null); }}>
                      <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                      Back
                    </Button>
                    <Button variant="primary" isLoading={createLoading} onClick={handleCreateTrainee}>
                      {createLoading ? 'Sending Invitation...' : 'Send Invitation'}
                    </Button>
                  </div>
                </div>
              )}

              {/* ───── STEP 3: Success ───── */}
              {createStep === 'success' && (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 text-center space-y-4 my-auto">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-[#F7F9FC]">Account Created & Invitation Sent</h4>
                  <p className="text-xs text-slate-600 dark:text-[#CBD5E1]">
                    The trainee account has been created with <strong>PENDING</strong> status. An invitation email has been sent to <strong>{formData.email}</strong>.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#CBD5E1]">
                    The trainee must click <strong>"Confirm Account"</strong> in their email to verify ownership and activate their account.
                  </p>
                  <Button onClick={closeCreateModal} className="w-full cursor-pointer">
                    Done
                  </Button>
                </div>
              )}

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
            if (stepUpAction.action === 'SUSPEND') {
              handleStatusChange(stepUpAction.traineeId, 'SUSPENDED');
            } else if (stepUpAction.action === 'DELETE') {
              handleDeleteTrainee(stepUpAction.traineeId);
            }
            setStepUpAction(null);
          }
        }}
        actionName={stepUpAction?.action || 'TRAINEE_STATUS_CHANGE'}
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