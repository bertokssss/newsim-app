'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { OfficialReceiptData } from '@/components/OfficialReceiptModal';
import { trackAnalyticsEvent, CardGridSkeleton, ResponsiveModal } from '@newsim/ui';

const OfficialReceiptModal = dynamic(() => import('@/components/OfficialReceiptModal'), { ssr: false });
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  CreditCard,
  X,
  Send,
  AlertCircle,
  Search,
  BookOpen,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Users,
  Check,
  Printer,
  User,
  Receipt,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export default function EnrollmentClient() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCatalogTab, setActiveCatalogTab] = useState<'COURSES' | 'PACKAGES'>('COURSES');
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [recentApplication, setRecentApplication] = useState<any | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<OfficialReceiptData | null>(null);

  const [traineeProfile, setTraineeProfile] = useState<any>(null);
  const [missingSrnModalOpen, setMissingSrnModalOpen] = useState(false);
  const [prereqError, setPrereqError] = useState('');
  const [ongoingError, setOngoingError] = useState('');
  const [enrollmentType, setEnrollmentType] = useState<'NEW' | 'REFRESHER'>('NEW');
  const [previousCertNo, setPreviousCertNo] = useState('');
  const [docGovIdChecked, setDocGovIdChecked] = useState(true);
  const [docSirbChecked, setDocSirbChecked] = useState(true);
  const [docPriorCertChecked, setDocPriorCertChecked] = useState(false);

  const fetchTraineeProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/trainee/profile');
      const json = await res.json();
      if (json.success) {
        setTraineeProfile(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch trainee profile:', err);
    }
  }, []);

  const handleOpenReceiptFromEnr = (enr: any) => {
    const statusUpper = (enr.status || '').toUpperCase();
    const isApproved = ['ENROLLED', 'APPROVED', 'ACTIVE', 'COMPLETED'].includes(statusUpper) || (enr.paymentStatus || '').toUpperCase() === 'VERIFIED';

    const trainee = enr.trainee || {
      fullName: 'Maritime Trainee',
      srn: 'SRN-PENDING',
      email: '',
      phone: '',
    };

    const receiptData: OfficialReceiptData = {
      receiptNo: enr.paymentReference ? `REC-${enr.id.slice(0, 8).toUpperCase()}` : `ENR-${enr.id.slice(0, 8).toUpperCase()}`,
      referenceNumber: enr.paymentReference || enr.enrollmentNo,
      paymongoCheckoutId: enr.paymongoCheckoutId,
      paymongoPaymentId: enr.paymongoPaymentId,
      amount: Number(enr.fee) || 0,
      paymentMethod: enr.paymentMethod || 'GCASH',
      environment: 'TEST',
      status: isApproved ? 'VERIFIED' : (enr.paymentStatus === 'VERIFIED' ? 'PAID' : enr.paymentStatus),
      isApproved,
      paidAt: enr.paidAt || enr.appliedAt,
      trainee: {
        fullName: trainee.fullName || 'Maritime Trainee',
        srn: trainee.srn || 'SRN-PENDING',
        traineeNumber: trainee.traineeNumber,
        email: trainee.email,
        phone: trainee.phone,
        address: trainee.address,
        nationality: trainee.nationality,
      },
      course: {
        title: enr.courseTitle,
        code: enr.courseCode,
        batchCode: enr.batchCode || 'Cohort',
        startDate: enr.startDate,
        endDate: enr.endDate,
        centerName: enr.centerName || 'NEWSIM Maritime Training Center',
      },
      notice: isApproved
        ? 'Payment verified and approved by training center administrator.'
        : 'Your payment is on-going. Please wait for admin verification to proceed.',
    };

    setActiveReceipt(receiptData);
    setReceiptModalOpen(true);
  };

  const fetchEnrollments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trainee/enrollment');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnrollments();
    fetchTraineeProfile();
  }, [fetchEnrollments, fetchTraineeProfile]);

  const availableCourses = (data?.availableCourses as Array<Record<string, any>>) || [];
  const availablePackages = (data?.availablePackages as Array<Record<string, any>>) || [];
  const enrollments = (data?.enrollments as Array<Record<string, any>>) || [];

  // Selected course object
  const currentSelectedCourse = useMemo(() => {
    return availableCourses.find((c) => c.id === selectedCourseId) || availableCourses[0] || null;
  }, [availableCourses, selectedCourseId]);

  // Batches for the currently selected course
  const currentCourseBatches = useMemo(() => {
    if (!currentSelectedCourse) return [];
    return (currentSelectedCourse.batches || []).filter((b: any) => b.status === 'OPEN');
  }, [currentSelectedCourse]);

  // When selected course changes, auto-select first open batch
  useEffect(() => {
    if (currentCourseBatches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(currentCourseBatches[0].id);
    }
  }, [currentCourseBatches, selectedBatchId]);

  const handleOpenEnrollModal = (courseId: string, preselectedBatchId?: string, packageId?: string) => {
    // Check if trainee has an SRN before opening enrollment (Section 11)
    if (!traineeProfile?.srn) {
      setMissingSrnModalOpen(true);
      return;
    }

    setSelectedCourseId(courseId);
    setSelectedPackageId(packageId || null);
    const targetCourse = availableCourses.find((c) => c.id === courseId);
    const batches = (targetCourse?.batches || []).filter((b: any) => b.status === 'OPEN');
    setSelectedBatchId(preselectedBatchId || batches[0]?.id || '');
    setApplyModalOpen(true);
    setRecentApplication(null);
    setErrorMessage('');
    setPrereqError('');
    setOngoingError('');
  };

  const handleApply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCourseId) return;

    // Double check SRN
    if (!traineeProfile?.srn) {
      setApplyModalOpen(false);
      setMissingSrnModalOpen(true);
      return;
    }

    if (!docGovIdChecked || !docSirbChecked || (enrollmentType === 'REFRESHER' && !docPriorCertChecked)) {
      setErrorMessage('Please confirm all mandatory enrollment document checklist items before continuing.');
      return;
    }
    if (enrollmentType === 'REFRESHER' && !previousCertNo.trim()) {
      setErrorMessage('Please enter your previous STCW certificate number for REFRESHER validation.');
      return;
    }

    try {
      setApplying(true);
      setErrorMessage('');
      setPrereqError('');
      setOngoingError('');
      const res = await fetch('/api/trainee/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          batchId: selectedBatchId || undefined,
          packageId: selectedPackageId || undefined,
          enrollmentType,
          previousCertificateNumber: enrollmentType === 'REFRESHER' ? previousCertNo.trim() : undefined,
          checklistConfirmed: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRecentApplication(json.data);
        trackAnalyticsEvent('course_enrollment_submitted', {
          has_batch: Boolean(selectedBatchId),
          has_package: Boolean(selectedPackageId),
        });
        setSuccessMessage('Enrollment application submitted successfully! Please settle payment via GCash or Maya.');
        fetchEnrollments();
      } else {
        if (json.code === 'MISSING_SRN') {
          setApplyModalOpen(false);
          setMissingSrnModalOpen(true);
        } else if (json.code === 'ONGOING_COURSE_EXISTS') {
          setOngoingError(json.error || 'You have an ongoing enrollment.');
        } else if (json.code === 'PREREQUISITE_REQUIRED') {
          setPrereqError(json.error);
        } else {
          setErrorMessage(json.error || 'Failed to apply for course');
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error while applying for course');
    } finally {
      setApplying(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    availableCourses.forEach((c) => {
      const cat = (c.category as string) || '';
      if (cat) set.add(cat);
    });
    return ['ALL', ...Array.from(set)];
  }, [availableCourses]);

  const filteredCourses = useMemo(() => {
    return availableCourses.filter((c) => {
      const title = ((c.title || c.name || '') as string).toLowerCase();
      const code = ((c.code || '') as string).toLowerCase();
      const desc = ((c.description || '') as string).toLowerCase();
      const cat = ((c.category || '') as string);
      const matchesSearch = !searchQuery || title.includes(searchQuery.toLowerCase()) || code.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'ALL' || cat === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [availableCourses, searchQuery, categoryFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-slate-200/80 dark:border-slate-800">
              Registrar &amp; Admissions
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              Batch Scheduling Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Enrollment &amp; Batch Admissions
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] font-sans mt-0.5">
            Select an IMO/STCW certified batch, submit your seafarer application, and settle tuition via PayMongo (GCash / Maya).
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <Link
            href="/payments"
            className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-mono text-[11px] font-bold shadow-xs hover:bg-emerald-500 transition-colors"
          >
            Pay Tuition →
          </Link>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-mono font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active Enrollments Section */}
      <div className="rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden relative">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-sky-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
              Active Seafarer Applications &amp; Enrollments
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {enrollments.length} Records
          </span>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <CardGridSkeleton numCards={3} showHeader={false} />
          ) : enrollments.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-slate-400">
              No active enrollments found. Choose an upcoming batch below to register.
            </div>
          ) : (
            enrollments.map((enr: Record<string, any>) => {
              const statusUpper = (enr.status || '').toUpperCase();
              const paymentStatusUpper = (enr.paymentStatus || '').toUpperCase();
              const isPaid = paymentStatusUpper === 'VERIFIED' || paymentStatusUpper === 'PAID';
              const isEnrolled = statusUpper === 'ENROLLED' || statusUpper === 'APPROVED' || statusUpper === 'ACTIVE' || statusUpper === 'COMPLETED';
              const isPendingReview = statusUpper === 'PENDING_REVIEW' || statusUpper === 'UNDER_REVIEW' || (isPaid && !isEnrolled);
              const isPaymentPending = (statusUpper === 'PAYMENT_PENDING' || statusUpper === 'PENDING') && !isPaid && !isPendingReview && !isEnrolled;
              const isRejected = statusUpper === 'REJECTED' || statusUpper === 'CANCELLED';

              return (
                <div
                  key={enr.id}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs text-sky-500 dark:text-sky-400">
                        {enr.enrollmentNo}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">• {enr.courseCode}</span>
                      {enr.batchCode && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-slate-900 dark:bg-sky-500/10 dark:text-sky-400 border border-slate-200/80 dark:border-slate-800">
                          Batch: {enr.batchCode}
                        </span>
                      )}
                      {enr.trainee?.srn && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          SRN: {enr.trainee.srn}
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                      {enr.courseTitle}
                    </h4>
                    <div className="text-xs font-mono text-slate-600 dark:text-[#CBD5E1] flex flex-wrap items-center gap-3 pt-0.5">
                      <span>Center: {enr.centerName}</span>
                      {isEnrolled && enr.startDate ? (
                        <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold">
                          <Calendar className="w-3 h-3 text-sky-500" />
                          Schedule: {enr.startDate} {enr.endDate ? `to ${enr.endDate}` : ''}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Schedule: Set by Admin
                        </span>
                      )}
                      <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">
                        Tuition: ₱{Number(enr.fee || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Review / Classification Notes if present */}
                    {enr.reviewNotes && (
                      <div
                        className={`text-[11px] font-sans p-2 rounded-xl border mt-1 ${
                          isRejected
                            ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-500/20'
                            : 'text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700'
                        }`}
                      >
                        <strong>{isRejected ? 'Registrar Remarks:' : 'Enrollment Details:'}</strong> {enr.reviewNotes}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
                    {/* Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase flex items-center gap-1.5 ${
                        isEnrolled
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : isPendingReview
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : isPaymentPending
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isPendingReview ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                          <span>PENDING — WAITING FOR APPROVAL</span>
                        </>
                      ) : isEnrolled ? (
                        statusUpper === 'COMPLETED' ? 'COMPLETED' : 'ENROLLED'
                      ) : isPaymentPending ? (
                        'PAYMENT PENDING'
                      ) : isRejected ? (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          <span>REJECTED — REFUNDABLE</span>
                        </>
                      ) : (
                        statusUpper
                      )}
                    </span>

                    {/* Action depending on status */}
                    {isPaymentPending && (
                      <Link
                        href={`/payments?enrollmentId=${enr.id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-mono text-xs font-bold shadow-sm transition-opacity"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay via GCash / Maya →</span>
                      </Link>
                    )}

                    {(isPendingReview || isEnrolled || isPaid || isRejected) && (
                      <button
                        onClick={() => handleOpenReceiptFromEnr(enr)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-95 text-white font-mono text-xs font-bold shadow-xs transition-opacity cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>View Receipt</span>
                      </button>
                    )}

                    {isEnrolled && (
                      <Link
                        href={`/my-courses`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold shadow-sm transition-colors"
                      >
                        <span>Go to My Courses →</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Catalog Tabs (Individual STCW Courses vs Course Packages) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveCatalogTab('COURSES')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-mono font-bold transition-all ${
                activeCatalogTab === 'COURSES'
                  ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                  : 'bg-white dark:bg-[#0c1a2c] text-slate-600 dark:text-[#CBD5E1] border border-slate-200/80 dark:border-slate-800 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Available STCW Courses ({filteredCourses.length})</span>
            </button>

            <button
              onClick={() => setActiveCatalogTab('PACKAGES')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-mono font-bold transition-all ${
                activeCatalogTab === 'PACKAGES'
                  ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                  : 'bg-white dark:bg-[#0c1a2c] text-slate-600 dark:text-[#CBD5E1] border border-slate-200/80 dark:border-slate-800 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Course Packages ({availablePackages.length})</span>
            </button>
          </div>

          {activeCatalogTab === 'COURSES' && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'ALL', label: 'All Categories' },
                { id: 'Safety and Other STCW Courses', label: 'Safety & Other STCW (Modular + Practical)' },
                { id: 'In-House Courses', label: 'In-House Courses (Full Modular)' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-slate-900 text-white dark:bg-sky-600'
                      : 'bg-white dark:bg-[#0c1a2c] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 focus:outline-none focus:border-slate-200/80 dark:border-slate-800"
                />
              </div>
            </div>
          )}
        </div>

        {/* COURSES TAB CONTENT */}
        {activeCatalogTab === 'COURSES' && (
          <div>
            {loading ? (
              <div className="py-12 text-center text-xs font-mono text-slate-400">Loading courses from database...</div>
            ) : filteredCourses.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-slate-400 bg-white dark:bg-[#0c1a2c] rounded-3xl border border-slate-200/80 dark:border-slate-800">
                No courses found matching your criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredCourses.map((c: Record<string, any>) => {
                  const title = c.title || c.name || 'Maritime Course';
                  const fee = Number(c.fee ?? c.price ?? 0);
                  const duration = Number(c.durationHours ?? c.duration_hours ?? 40);
                  const category = c.category || 'STCW Course';
                  const desc = c.description || 'Comprehensive maritime STCW certified program.';
                  const center = c.centerName || 'NEWSIM Training Center';
                  const activeBatch = c.activeBatch || (c.batches || []).find((b: any) => b.status === 'OPEN');
                  const queuedBatches = c.queuedBatches || (c.batches || []).filter((b: any) => b.status === 'QUEUED');

                  return (
                    <div
                      key={c.id}
                      className="w-full p-5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-sky-500/40 hover:shadow-md transition-all group relative overflow-hidden"
                    >
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-[10px] uppercase text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded truncate max-w-[170px]">
                            {category}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-medium shrink-0">{duration} hrs</span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-mono font-bold text-sky-500 dark:text-sky-400">
                            {c.code}
                          </span>
                          {String(category).toLowerCase().includes('in-house') ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                              Full Modular-Based
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Modular + Practical
                            </span>
                          )}
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading leading-tight pt-0.5 group-hover:text-sky-500 transition-colors">
                          {title}
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                          {desc}
                        </p>

                        {/* Schedule & Center Details */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[10px] font-mono">
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-[#CBD5E1] space-y-1">
                            <div className="font-bold flex items-center justify-between">
                              <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Schedule: Set by Admin</span>
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                                OPEN
                              </span>
                            </div>
                            <div className="text-[9.5px] text-slate-500 dark:text-slate-400">
                              No fixed schedule — training timetable will be set by admin upon enrollment.
                            </div>
                          </div>
                          <div className="text-slate-400 pt-0.5">
                            Center: <span className="text-slate-600 dark:text-slate-300">{center}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC]">
                            ₱{fee.toLocaleString()}
                          </div>
                          <div className="text-[9px] font-mono text-slate-400">Tuition Fee</div>
                        </div>
                        <button
                          onClick={() => handleOpenEnrollModal(c.id, activeBatch?.id)}
                          disabled={applying}
                          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Enroll Now</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PACKAGES TAB CONTENT */}
        {activeCatalogTab === 'PACKAGES' && (
          <div>
            {availablePackages.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-slate-400 bg-white dark:bg-[#0c1a2c] rounded-3xl border border-slate-200/80 dark:border-slate-800">
                No course packages currently available.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availablePackages.map((pkg: any) => {
                  const items = pkg.course_package_items || [];
                  const price = Number(pkg.package_price || 0);
                  const discount = Number(pkg.discount || 0);

                  return (
                    <div
                      key={pkg.id}
                      className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-sky-500/40 transition-all relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                            {pkg.package_code}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            {items.length} Bundled Courses
                          </span>
                        </div>

                        <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                          {pkg.name}
                        </h3>

                        <p className="text-xs text-slate-600 dark:text-[#CBD5E1] line-clamp-2">
                          {pkg.description || 'Comprehensive multi-course maritime package for career acceleration.'}
                        </p>

                        {/* Included Courses List */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                            Included Programs:
                          </span>
                          {items.map((it: any, idx: number) => {
                            const c = it.courses;
                            return (
                              <div key={c?.id || idx} className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-300">
                                <span>• {c?.code}: {c?.name}</span>
                                <span className="text-[10px] text-slate-400">{c?.duration_hours}h</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-lg text-slate-900 dark:text-[#F8FAFC]">
                            ₱{price.toLocaleString()}
                          </div>
                          {discount > 0 && (
                            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                              Save ₱{discount.toLocaleString()}
                            </div>
                          )}
                        </div>

                        {items[0]?.courses?.id && (
                          <button
                            onClick={() => handleOpenEnrollModal(items[0].courses.id, undefined, pkg.id)}
                            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all cursor-pointer"
                          >
                            <span>Enroll Package</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Apply / Batch Selection Modal */}
      <ResponsiveModal
        isOpen={Boolean(applyModalOpen && currentSelectedCourse)}
        onClose={() => setApplyModalOpen(false)}
        disableClose={applying}
        maxWidthClassName="max-w-lg"
        topAccentClassName="h-1 bg-sky-500"
      >
        {currentSelectedCourse && (recentApplication ? (
          /* Success screen inside modal */
          <div className="p-5 sm:p-6 space-y-5 text-center overflow-y-auto overscroll-contain flex-1 min-h-0">
            <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                Seat Reserved in Batch!
              </h3>
              <p className="text-xs font-mono text-sky-500 font-bold mt-1">
                Enrollment Ref: {recentApplication.enrollmentNo}
              </p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Schedule: To be assigned by Admin (No fixed schedule)
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs font-mono text-left space-y-1.5">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <span className="text-slate-400">Course:</span>
                <span className="font-bold text-slate-900 dark:text-[#F8FAFC] text-right">{recentApplication.courseTitle}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <span className="text-slate-400">Schedule:</span>
                <span className="font-bold text-sky-600 dark:text-sky-400">To be set by Admin</span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <span className="text-slate-400">Tuition Fee:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">₱{Number(recentApplication.fee).toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">PAYMENT_PENDING</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left text-[11px] text-amber-700 dark:text-amber-300">
              Please settle your tuition via PayMongo to finalize your seat reservation. Your training schedule will be coordinated and assigned by administration upon approval.
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href={`/payments?enrollmentId=${recentApplication.id}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/20"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay Tuition with PayMongo (GCash / Maya) →</span>
              </Link>
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="p-4 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                  Confirm Course Enrollment
                </h3>
                <p className="text-xs text-sky-500 font-mono mt-0.5">
                  Please verify your enrollment details before proceeding to payment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer shrink-0"
                aria-label="Close enrollment confirmation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 text-xs font-mono overflow-y-auto overscroll-contain flex-1 min-h-0">
              {ongoingError && (
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-mono space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>Ongoing Course Exists</span>
                  </div>
                  <p className="text-[11px] font-sans">{ongoingError}</p>
                </div>
              )}

              {prereqError && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-mono space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Prerequisite Required</span>
                  </div>
                  <p className="text-[11px] font-sans">{prereqError}</p>
                </div>
              )}

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {(() => {
                const selectedPkg = availablePackages.find((p: any) => p.id === selectedPackageId);
                const feeAmount = selectedPkg?.package_price ? Number(selectedPkg.package_price) : Number(currentSelectedCourse.fee || currentSelectedCourse.price || 7500);

                return (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="text-slate-400">Course:</span>
                      <span className="font-bold text-slate-900 dark:text-[#F8FAFC] text-right">
                        {currentSelectedCourse.code} — {currentSelectedCourse.name || currentSelectedCourse.title}
                      </span>
                    </div>

                    {selectedPkg && (
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <span className="text-slate-400">Package:</span>
                        <span className="font-bold text-slate-900 dark:text-[#F8FAFC] text-right">
                          {selectedPkg.name} ({selectedPkg.package_code})
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="text-slate-400">Training Schedule:</span>
                      <span className="font-bold text-sky-600 dark:text-sky-400 text-right">
                        Set by Admin (No fixed schedule)
                      </span>
                    </div>

                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="text-slate-400">Category &amp; Pacing:</span>
                      <span className="font-bold text-sky-600 dark:text-sky-400 text-right">
                        {String(currentSelectedCourse.category || '').toLowerCase().includes('in-house')
                          ? 'MODULAR / IN-HOUSE (Max 3 Days)'
                          : 'MODULAR + PRACTICAL (Max 3 Days Modular)'}
                      </span>
                    </div>

                    <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                      <span className="text-slate-400 block">Enrollment Classification:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(['NEW', 'REFRESHER'] as const).map((typeOpt) => (
                          <button
                            key={typeOpt}
                            type="button"
                            onClick={() => {
                              setEnrollmentType(typeOpt);
                              setErrorMessage('');
                            }}
                            className={`py-1.5 px-3 rounded-xl font-mono text-[11px] font-bold border transition-all cursor-pointer ${
                              enrollmentType === typeOpt
                                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {typeOpt === 'NEW' ? 'NEW ENROLLMENT' : 'REFRESHER'}
                          </button>
                        ))}
                      </div>
                      {enrollmentType === 'REFRESHER' && (
                        <div className="pt-1.5">
                          <input
                            type="text"
                            value={previousCertNo}
                            onChange={(e) => setPreviousCertNo(e.target.value)}
                            placeholder="Enter previous STCW Certificate No. (e.g. CERT-2021-001)"
                            className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-sky-500"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                      <span className="text-slate-400 block">Mandatory Prerequisite &amp; Document Checklist:</span>
                      <label className="flex items-start gap-2 text-[11px] font-sans text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={docGovIdChecked}
                          onChange={(e) => setDocGovIdChecked(e.target.checked)}
                          className="rounded border-slate-300 mt-0.5 shrink-0"
                        />
                        <span>Valid Government-Issued ID / MARINA ID Verified</span>
                      </label>
                      <label className="flex items-start gap-2 text-[11px] font-sans text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={docSirbChecked}
                          onChange={(e) => setDocSirbChecked(e.target.checked)}
                          className="rounded border-slate-300 mt-0.5 shrink-0"
                        />
                        <span>Seafarer&apos;s Record Book (SIRB) &amp; SRN ({traineeProfile?.srn || 'Verified'})</span>
                      </label>
                      {enrollmentType === 'REFRESHER' && (
                        <label className="flex items-start gap-2 text-[11px] font-sans text-slate-700 dark:text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={docPriorCertChecked}
                            onChange={(e) => setDocPriorCertChecked(e.target.checked)}
                            className="rounded border-slate-300 mt-0.5 shrink-0"
                          />
                          <span>Previous Training Certificate (Expired / Eligible for Refresher)</span>
                        </label>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="text-slate-400">Seafarer SRN:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {traineeProfile?.srn || 'Not Set'}
                      </span>
                    </div>

                    <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-1 pt-1">
                      <span className="text-slate-400 uppercase font-bold">Total Tuition Price:</span>
                      <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                        ₱{feeAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                Confirming reserves your seat. An official enrollment record will be created in <strong>PAYMENT_PENDING</strong> status. The training schedule will be set and assigned by administration upon verification.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-[#CBD5E1] hover:bg-sky-500/10 dark:hover:bg-white/5 text-xs font-semibold cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-emerald-600/25 disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{applying ? 'Reserving...' : 'CONTINUE TO PAYMENT'}</span>
              </button>
            </div>
          </div>
        ))}
      </ResponsiveModal>

      {/* MISSING SRN MODAL (SECTIONS 11 & 45) */}
      <ResponsiveModal
        isOpen={missingSrnModalOpen}
        onClose={() => setMissingSrnModalOpen(false)}
        maxWidthClassName="max-w-md"
        panelClassName="border-amber-500/40"
      >
        <div className="p-5 sm:p-6 text-center space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
              Profile Incomplete — SRN Required
            </h3>
            <p className="text-xs text-slate-600 dark:text-[#CBD5E1] mt-1.5 leading-relaxed font-sans">
              Please complete your trainee profile by adding your SRN before enrolling in a training course.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-700 dark:text-amber-300">
            A valid Seafarer&apos;s Registration Number (SRN) is required by MARINA compliance before seat reservation.
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Link
              href="/settings"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-amber-500/25"
            >
              GO TO SETTINGS
            </Link>
            <button
              type="button"
              onClick={() => setMissingSrnModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </ResponsiveModal>

      {/* Official Receipt Modal */}
      <OfficialReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receipt={activeReceipt}
      />
    </div>
  );
}
