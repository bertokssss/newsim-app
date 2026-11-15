'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Search,
  Plus,
  Clock,
  X,
  ChevronRight,
  Package,
  Layers,
  Tags,
  Check,
  AlertCircle,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  Percent,
  Trash2,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Award,
  Power,
  PowerOff,
  Ban,
  FileText,
  Compass,
  GraduationCap,
  Upload,
  FileUp,
  CloudUpload,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  HelpCircle,
  Edit3,
  CheckCircle,
  Loader2,
  Zap,
  RotateCw,
  Download,
  ExternalLink,
  Presentation,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface ProcedureStepItem {
  id: string;
  stepNumber: number;
  phase: 'PREREQUISITE' | 'THEORY' | 'SIMULATOR' | 'ASSESSMENT' | 'CERTIFICATION';
  title: string;
  description: string;
  hours: number;
  mandatory: boolean;
}

const defaultProcedureSteps: ProcedureStepItem[] = [
  {
    id: 'step-1',
    stepNumber: 1,
    phase: 'PREREQUISITE',
    title: 'Enrollment & Pre-requisite Qualification Verification',
    description: 'Verification of Seafarer Registration Number (SRN), valid PEME, and prerequisite STCW certificates before class admission.',
    hours: 2,
    mandatory: true,
  },
  {
    id: 'step-2',
    stepNumber: 2,
    phase: 'THEORY',
    title: 'Classroom Theory, Syllabus Induction & Lecture Slides (PPT)',
    description: 'Undergo classroom instruction covering STCW modular theoretical standards, comprehensive syllabus review, and presentation slides.',
    hours: 16,
    mandatory: true,
  },
  {
    id: 'step-3',
    stepNumber: 3,
    phase: 'SIMULATOR',
    title: 'Simulator Practical Exercises & Scenario Drills',
    description: 'Hands-on bridge / engine-room simulation training, operational procedures, emergency scenario response, and equipment watchkeeping drills.',
    hours: 14,
    mandatory: true,
  },
  {
    id: 'step-4',
    stepNumber: 4,
    phase: 'ASSESSMENT',
    title: 'Formal Competency Assessment & Examination',
    description: 'Completion of official written comprehensive examination (minimum passing mark >= 75%) and practical simulator performance demonstration.',
    hours: 6,
    mandatory: true,
  },
  {
    id: 'step-5',
    stepNumber: 5,
    phase: 'CERTIFICATION',
    title: 'Debriefing, Audit Review & Certificate of Completion',
    description: 'Instructor performance debriefing, compliance audit log sign-off, and release of MARINA/STCW-accredited Certificate of Training Completion.',
    hours: 2,
    mandatory: true,
  },
];

const initialCourseForm = {
  code: '',
  title: '',
  category: 'Safety and Other STCW Courses',
  description: '',
  durationHours: '40',
  capacity: '24',
  fee: '10000',
  // Syllabus
  syllabusOutline: '',
  syllabusFiles: [] as File[],
  // Procedures
  procedureOverview: '',
  procedureSteps: defaultProcedureSteps,
  // Assessment
  assessmentTitle: '',
  assessmentType: 'WRITTEN',
  assessmentPassingScore: '75',
  assessmentDurationMinutes: '60',
  assessmentDescription: '',
};

export const MAX_SYLLABUS_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB Maximum Total Size

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function CoursesClient() {
  const [activeTab, setActiveTab] = useState<'COURSES' | 'PACKAGES'>('COURSES');

  // Data States
  const [courses, setCourses] = useState<any[]>([]);
  const [allCoursesForPackage, setAllCoursesForPackage] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [courseStatusFilter, setCourseStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  const [packageStatusFilter, setPackageStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

  // Modals
  const [createCourseModal, setCreateCourseModal] = useState(false);
  const [editCourseModal, setEditCourseModal] = useState<any | null>(null);
  const [createPackageModal, setCreatePackageModal] = useState(false);
  const [viewCourse, setViewCourse] = useState<any | null>(null);
  const [viewPackage, setViewPackage] = useState<any | null>(null);
  const [packageCurriculum, setPackageCurriculum] = useState<{
    materials: any[];
    procedures: any[];
    assessments: any[];
  } | null>(null);
  const [loadingPackageCurriculum, setLoadingPackageCurriculum] = useState(false);
  const [activePackageTab, setActivePackageTab] = useState<'COURSES' | 'SYLLABUS' | 'PROCEDURES' | 'ASSESSMENTS'>('COURSES');
  const [packageCourseContentFilter, setPackageCourseContentFilter] = useState<string>('ALL');
  const [viewingSyllabusOutline, setViewingSyllabusOutline] = useState<any | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSubmittingPackage, setIsSubmittingPackage] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [courseSearchInModal, setCourseSearchInModal] = useState('');

  // Package Curriculum Management State
  const [isCurriculumSaving, setIsCurriculumSaving] = useState(false);
  const [curriculumNotice, setCurriculumNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Package Material Modal
  const [pkgMaterialModalOpen, setPkgMaterialModalOpen] = useState(false);
  const [pkgMaterialForm, setPkgMaterialForm] = useState({
    title: '',
    description: '',
    materialType: 'SYLLABUS' as 'SYLLABUS' | 'PRESENTATION' | 'DOCUMENT' | 'VIDEO',
    externalUrl: '',
    sourceCourseCode: 'PACKAGE',
  });
  const [pkgMaterialFile, setPkgMaterialFile] = useState<File | null>(null);
  const [isUploadingPkgMaterial, setIsUploadingPkgMaterial] = useState(false);
  const pkgMaterialFileInputRef = useRef<HTMLInputElement>(null);

  // Package Procedure Step Modal
  const [pkgProcedureModalOpen, setPkgProcedureModalOpen] = useState(false);
  const [editingPkgProcedureIdx, setEditingPkgProcedureIdx] = useState<number | null>(null);
  const [pkgProcedureForm, setPkgProcedureForm] = useState<ProcedureStepItem>({
    id: '',
    stepNumber: 1,
    phase: 'THEORY',
    title: '',
    description: '',
    hours: 8,
    mandatory: true,
  });

  // Package Assessment Modal
  const [pkgAssessmentModalOpen, setPkgAssessmentModalOpen] = useState(false);
  const [editingPkgAssessmentIdx, setEditingPkgAssessmentIdx] = useState<number | null>(null);
  const [pkgAssessmentForm, setPkgAssessmentForm] = useState({
    id: '',
    title: '',
    assessmentType: 'WRITTEN',
    passingScore: 75,
    durationMinutes: 60,
    courseCode: 'PACKAGE',
  });

  // Course Creation Wizard State
  const [createCourseTab, setCreateCourseTab] = useState<'INFO' | 'SYLLABUS' | 'PROCEDURES' | 'ASSESSMENT'>('INFO');
  const [isSubmittingCourse, setIsSubmittingCourse] = useState(false);
  const [isDraggingSyllabus, setIsDraggingSyllabus] = useState(false);
  const [syllabusUploadError, setSyllabusUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhaseText, setUploadPhaseText] = useState('Preparing curriculum assets...');
  const syllabusFileInputRef = useRef<HTMLInputElement>(null);

  // Forms
  const [courseForm, setCourseForm] = useState(initialCourseForm);

  const [packageForm, setPackageForm] = useState({
    packageCode: '',
    name: '',
    description: '',
    discount: '0',
    validityDays: '365'
  });
  const [selectedCourses, setSelectedCourses] = useState<any[]>([]);

  const fetchCourses = async () => {
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);

      const res = await fetch(`/api/admin/courses?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setCourses(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  const fetchAllCoursesForPackage = async () => {
    try {
      const res = await fetch('/api/admin/courses?limit=200');
      const json = await res.json();
      if (json.success) {
        setAllCoursesForPackage(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching all courses for package selector:', err);
    }
  };

  const fetchPackages = async () => {
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (packageStatusFilter !== 'ALL') query.set('status', packageStatusFilter);

      const res = await fetch(`/api/admin/course-packages?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setPackages(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching course packages:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchCourses(), fetchPackages(), fetchAllCoursesForPackage()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [search, packageStatusFilter, activeTab]);

  const fetchPackageCurriculum = async (packageId: string) => {
    try {
      setLoadingPackageCurriculum(true);
      const res = await fetch(`/api/admin/course-packages/${packageId}?t=${Date.now()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success && json.data?.curriculum) {
        setPackageCurriculum(json.data.curriculum);
      }
    } catch (err) {
      console.warn('Failed loading package curriculum:', err);
    } finally {
      setLoadingPackageCurriculum(false);
    }
  };

  useEffect(() => {
    if (viewPackage?.id) {
      setPackageCourseContentFilter('ALL');
      fetchPackageCurriculum(viewPackage.id);
    } else {
      setPackageCurriculum(null);
      setActivePackageTab('COURSES');
      setPackageCourseContentFilter('ALL');
    }
  }, [viewPackage?.id]);

  useEffect(() => {
    if (curriculumNotice) {
      const timer = setTimeout(() => setCurriculumNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [curriculumNotice]);

  const updateProcedureStep = (index: number, patch: Partial<ProcedureStepItem>) => {
    const updated = [...courseForm.procedureSteps];
    updated[index] = { ...updated[index], ...patch };
    setCourseForm((prev) => ({ ...prev, procedureSteps: updated }));
  };

  const removeProcedureStep = (index: number) => {
    if (courseForm.procedureSteps.length <= 1) {
      alert('At least one procedural step is required.');
      return;
    }
    const updated = courseForm.procedureSteps
      .filter((_, i) => i !== index)
      .map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setCourseForm((prev) => ({ ...prev, procedureSteps: updated }));
  };

  const addProcedureStep = () => {
    const newStep: ProcedureStepItem = {
      id: `step-${Date.now()}`,
      stepNumber: courseForm.procedureSteps.length + 1,
      phase: 'THEORY',
      title: '',
      description: '',
      hours: 4,
      mandatory: true,
    };
    setCourseForm((prev) => ({
      ...prev,
      procedureSteps: [...prev.procedureSteps, newStep],
    }));
  };

  const resetToDefaultProcedures = () => {
    setCourseForm((prev) => ({
      ...prev,
      procedureSteps: defaultProcedureSteps,
    }));
  };

  const getFileExtInfo = (filename: string) => {
    const ext = filename.split('.').pop()?.toUpperCase() || 'FILE';
    if (['PPT', 'PPTX'].includes(ext)) {
      return { label: ext, color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' };
    }
    if (['PDF'].includes(ext)) {
      return { label: ext, color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' };
    }
    if (['DOC', 'DOCX'].includes(ext)) {
      return { label: ext, color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' };
    }
    if (['XLS', 'XLSX'].includes(ext)) {
      return { label: ext, color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
    }
    return { label: ext, color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' };
  };

  const handleAddSyllabusFiles = (incomingFiles: File[]) => {
    setSyllabusUploadError(null);
    if (!incomingFiles || incomingFiles.length === 0) return;

    const validFiles: File[] = [];
    let currentTotalSize = courseForm.syllabusFiles.reduce((acc, f) => acc + f.size, 0);
    let errorMsg: string | null = null;

    for (const file of incomingFiles) {
      if (!file || file.size <= 0) continue;

      // Duplicate check
      const exists = courseForm.syllabusFiles.some(
        (f) => f.name === file.name && f.size === file.size
      );
      if (exists) {
        continue;
      }

      if (currentTotalSize + file.size > MAX_SYLLABUS_TOTAL_BYTES) {
        const remainingBytes = Math.max(0, MAX_SYLLABUS_TOTAL_BYTES - currentTotalSize);
        errorMsg = `Cannot add "${file.name}" (${formatFileSize(file.size)}). Total combined files would exceed 50 MB limit (${formatFileSize(remainingBytes)} remaining).`;
        break;
      }

      currentTotalSize += file.size;
      validFiles.push(file);
    }

    if (errorMsg) {
      setSyllabusUploadError(errorMsg);
    }

    if (validFiles.length > 0) {
      setCourseForm((prev) => ({
        ...prev,
        syllabusFiles: [...prev.syllabusFiles, ...validFiles],
      }));
    }
  };

  const handlePasteSyllabus = (e: React.ClipboardEvent) => {
    setSyllabusUploadError(null);
    const pastedFiles: File[] = [];

    // Check clipboardData.files
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      for (let i = 0; i < e.clipboardData.files.length; i++) {
        const f = e.clipboardData.files[i];
        if (f && f.size > 0) {
          pastedFiles.push(f);
        }
      }
    }

    // Check items for files/blobs if files array was empty
    if (pastedFiles.length === 0 && e.clipboardData.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            pastedFiles.push(file);
          }
        }
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      handleAddSyllabusFiles(pastedFiles);
    }
  };

  const removeSyllabusFile = (index: number) => {
    setSyllabusUploadError(null);
    setCourseForm((prev) => ({
      ...prev,
      syllabusFiles: prev.syllabusFiles.filter((_, i) => i !== index),
    }));
  };

  const clearAllSyllabusFiles = () => {
    setSyllabusUploadError(null);
    setCourseForm((prev) => ({
      ...prev,
      syllabusFiles: [],
    }));
    if (syllabusFileInputRef.current) {
      syllabusFileInputRef.current.value = '';
    }
  };

  const handleOpenCreateCourseModal = () => {
    setCourseForm(initialCourseForm);
    setCreateCourseTab('INFO');
    setSyllabusUploadError(null);
    setIsDraggingSyllabus(false);
    setCreateCourseModal(true);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.code.trim() || !courseForm.title.trim()) {
      setCreateCourseTab('INFO');
      alert('Course Code and Course Title are required.');
      return;
    }
    const cap = parseInt(courseForm.capacity, 10);
    if (cap > 24) {
      alert('Course capacity cannot exceed 24 trainees per STCW regulation.');
      return;
    }

    // 50 MB total check
    const totalSyllabusBytes = courseForm.syllabusFiles.reduce((acc, f) => acc + f.size, 0);
    if (totalSyllabusBytes > MAX_SYLLABUS_TOTAL_BYTES) {
      setCreateCourseTab('SYLLABUS');
      setSyllabusUploadError(`Total syllabus files size (${formatFileSize(totalSyllabusBytes)}) exceeds the 50 MB maximum limit.`);
      alert(`Total syllabus files size exceeds 50 MB. Please remove some files before proceeding.`);
      return;
    }

    setIsSubmittingCourse(true);
    setUploadProgress(15);
    setUploadPhaseText('Validating STCW course specifications & curriculum...');

    let progressTimer: any = setInterval(() => {
      setUploadProgress((prev: number) => {
        if (prev < 35) {
          const count = courseForm.syllabusFiles.length;
          setUploadPhaseText(count > 0 ? `Staging and verifying ${count} syllabus file(s)...` : 'Staging course curriculum specifications...');
          return prev + 10;
        } else if (prev < 70) {
          setUploadPhaseText('Uploading curriculum documents to secure maritime repository...');
          return prev + 8;
        } else if (prev < 88) {
          setUploadPhaseText('Registering 5-phase procedural roadmap & assessment...');
          return prev + 4;
        } else if (prev < 96) {
          setUploadPhaseText('Finalizing course registry and access permissions...');
          return prev + 1;
        }
        return prev;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append('code', courseForm.code.trim().toUpperCase());
      formData.append('title', courseForm.title.trim());
      formData.append('category', courseForm.category);
      formData.append('description', courseForm.description.trim());
      formData.append('durationHours', courseForm.durationHours || '40');
      formData.append('capacity', courseForm.capacity || '24');
      formData.append('fee', courseForm.fee || '10000');

      // Syllabus
      if (courseForm.syllabusOutline.trim()) {
        formData.append('syllabusOutline', courseForm.syllabusOutline.trim());
      }
      if (courseForm.syllabusFiles && courseForm.syllabusFiles.length > 0) {
        for (const file of courseForm.syllabusFiles) {
          formData.append('syllabusFiles', file);
        }
      }

      // Procedures
      if (courseForm.procedureOverview.trim()) {
        formData.append('procedureOverview', courseForm.procedureOverview.trim());
      }
      if (courseForm.procedureSteps && courseForm.procedureSteps.length > 0) {
        formData.append('procedureSteps', JSON.stringify(courseForm.procedureSteps));
      }

      // Assessment
      const finalAssessmentTitle = courseForm.assessmentTitle.trim() || `${courseForm.title.trim()} Comprehensive Assessment`;
      formData.append('assessmentTitle', finalAssessmentTitle);
      formData.append('assessmentType', courseForm.assessmentType || 'WRITTEN');
      formData.append('assessmentPassingScore', courseForm.assessmentPassingScore || '75');
      formData.append('assessmentDurationMinutes', courseForm.assessmentDurationMinutes || '60');
      if (courseForm.assessmentDescription.trim()) {
        formData.append('assessmentDescription', courseForm.assessmentDescription.trim());
      }

      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        if (progressTimer) clearInterval(progressTimer);
        setUploadProgress(100);
        setUploadPhaseText('Course created & curriculum files uploaded successfully!');
        await new Promise((resolve) => setTimeout(resolve, 600));

        setCreateCourseModal(false);
        setCourseForm(initialCourseForm);
        setCreateCourseTab('INFO');
        setSyllabusUploadError(null);
        await fetchCourses();
        await fetchAllCoursesForPackage();
      } else {
        if (progressTimer) clearInterval(progressTimer);
        setIsSubmittingCourse(false);
        setUploadProgress(0);
        alert(json.error || 'Failed to create course');
      }
    } catch (err: any) {
      if (progressTimer) clearInterval(progressTimer);
      setIsSubmittingCourse(false);
      setUploadProgress(0);
      console.error('Error creating course:', err);
      alert(err?.message || 'Error creating course');
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setIsSubmittingCourse(false);
      setUploadProgress(0);
    }
  };

  const handleEditCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCourseModal) return;
    const cap = parseInt(courseForm.capacity, 10);
    if (cap > 24) {
      alert('Course capacity cannot exceed 24 trainees per STCW regulation.');
      return;
    }
    try {
      const res = await fetch(`/api/admin/courses/${editCourseModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: courseForm.code,
          title: courseForm.title,
          category: courseForm.category,
          description: courseForm.description,
          duration_hours: parseInt(courseForm.durationHours) || 40,
          capacity: Math.min(Math.max(1, cap || 24), 24),
          fee: parseFloat(courseForm.fee) || 10000,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditCourseModal(null);
        setCourseForm(initialCourseForm);
        fetchCourses();
        fetchAllCoursesForPackage();
      } else {
        alert(json.error || 'Failed to edit course');
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Error updating course');
    }
  };

  const handleToggleCourseStatus = async (id: string, currentStatus: string) => {
    const isCurrentlyDisabled = ['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((currentStatus || '').toUpperCase());
    const newStatus = isCurrentlyDisabled ? 'PUBLISHED' : 'SUSPENDED';

    const confirmMsg = isCurrentlyDisabled
      ? 'Enable this course for registration and scheduling?'
      : 'Disable this course? It will be suspended and hidden from active trainee registrations.';

    if (!confirm(confirmMsg)) return;

    setIsUpdatingStatus(true);
    try {
      if (viewCourse && viewCourse.id === id) {
        setViewCourse((prev: any) => prev ? { ...prev, status: newStatus } : null);
      }
      setCourses(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));

      const res = await fetch(`/api/admin/courses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (viewCourse && viewCourse.id === id) {
          setViewCourse((prev: any) => prev ? { ...prev, status: currentStatus } : null);
        }
        setCourses(prev => prev.map(c => c.id === id ? { ...c, status: currentStatus } : c));
        alert(json.error || 'Failed to update course status');
        return;
      }
      const updatedStatus = json.course?.status || json.data?.status || newStatus;
      if (viewCourse && viewCourse.id === id) {
        setViewCourse((prev: any) => prev ? { ...prev, status: updatedStatus } : null);
      }
      setCourses(prev => prev.map(c => c.id === id ? { ...c, status: updatedStatus } : c));
      await fetchCourses();
    } catch (err: any) {
      console.error(err);
      if (viewCourse && viewCourse.id === id) {
        setViewCourse((prev: any) => prev ? { ...prev, status: currentStatus } : null);
      }
      setCourses(prev => prev.map(c => c.id === id ? { ...c, status: currentStatus } : c));
      alert(err?.message || 'Error updating course status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteCourse = async (id: string, courseCode?: string) => {
    const courseLabel = courseCode ? `course "${courseCode}"` : 'this course';
    if (!confirm(`Are you sure you want to permanently delete ${courseLabel}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/courses/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setViewCourse(null);
        await fetchCourses();
        await fetchAllCoursesForPackage();
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'Failed to delete course. It may have associated enrollments or schedule records.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while attempting to delete course.');
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setPackageError(null);

    if (!packageForm.packageCode.trim()) {
      setPackageError('Package code is required (e.g. PKG-STCW-01).');
      return;
    }
    if (!packageForm.name.trim()) {
      setPackageError('Package name is required.');
      return;
    }
    if (selectedCourses.length === 0) {
      setPackageError('Please select at least one course to bundle into this package.');
      return;
    }

    setIsSubmittingPackage(true);
    try {
      const res = await fetch('/api/admin/course-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageCode: packageForm.packageCode.trim().toUpperCase(),
          name: packageForm.name.trim(),
          description: packageForm.description.trim(),
          discount: packageForm.discount || '0',
          validityDays: packageForm.validityDays || '365',
          courses: selectedCourses,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCreatePackageModal(false);
        setPackageForm({ packageCode: '', name: '', description: '', discount: '0', validityDays: '365' });
        setSelectedCourses([]);
        setCourseSearchInModal('');
        setActiveTab('PACKAGES');
        await fetchPackages();
      } else {
        setPackageError(json.error || 'Failed to create package');
      }
    } catch (err: any) {
      console.error(err);
      setPackageError(err.message || 'Error occurred while creating course package');
    } finally {
      setIsSubmittingPackage(false);
    }
  };

  const handleTogglePackageStatus = async (id: string, currentStatus: string, packageLabel?: string) => {
    const isCurrentlyActive = (currentStatus || '').toUpperCase() === 'ACTIVE';
    const targetStatus = isCurrentlyActive ? 'DISABLED' : 'ACTIVE';
    const label = packageLabel ? `package "${packageLabel}"` : 'this course package';
    const promptMsg = isCurrentlyActive
      ? `Are you sure you want to disable ${label}? Trainees will not be able to view or enroll in this package while disabled.`
      : `Are you sure you want to enable ${label}? It will become available for trainee enrollments.`;

    if (!confirm(promptMsg)) return;

    // Optimistic UI update
    setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, status: targetStatus } : p)));
    if (viewPackage && viewPackage.id === id) {
      setViewPackage((prev: any) => (prev ? { ...prev, status: targetStatus } : null));
    }

    try {
      const res = await fetch(`/api/admin/course-packages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // Revert on failure
        setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, status: currentStatus } : p)));
        if (viewPackage && viewPackage.id === id) {
          setViewPackage((prev: any) => (prev ? { ...prev, status: currentStatus } : null));
        }
        alert(json.error || 'Failed to update course package status');
      } else {
        await fetchPackages();
      }
    } catch (err: any) {
      console.error(err);
      setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, status: currentStatus } : p)));
      if (viewPackage && viewPackage.id === id) {
        setViewPackage((prev: any) => (prev ? { ...prev, status: currentStatus } : null));
      }
      alert(err?.message || 'Error updating package status');
    }
  };

  // ================= PACKAGE CURRICULUM MANAGEMENT HANDLERS =================
  const handleDeletePkgMaterial = async (materialId: string) => {
    if (!viewPackage?.id) return;
    if (!confirm('Are you sure you want to remove this material from the package?')) return;

    try {
      setIsCurriculumSaving(true);
      const res = await fetch(`/api/admin/course-packages/${viewPackage.id}/materials?id=${materialId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setPackageCurriculum((prev: any) => ({
          ...prev,
          materials: (prev?.materials || []).filter((m: any) => m.id !== materialId),
        }));
        setCurriculumNotice({ type: 'success', message: 'Material removed from package curriculum.' });
      } else {
        setCurriculumNotice({ type: 'error', message: json.error || 'Failed to remove material.' });
      }
    } catch (err: any) {
      setCurriculumNotice({ type: 'error', message: err.message || 'Error deleting material.' });
    } finally {
      setIsCurriculumSaving(false);
    }
  };

  const handleAddPkgMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewPackage?.id) return;
    if (!pkgMaterialForm.title.trim()) {
      setCurriculumNotice({ type: 'error', message: 'Title is required for material.' });
      return;
    }

    try {
      setIsUploadingPkgMaterial(true);
      const fd = new FormData();
      fd.append('title', pkgMaterialForm.title.trim());
      fd.append('description', pkgMaterialForm.description.trim());
      fd.append('material_type', pkgMaterialForm.materialType);
      fd.append('source_course_code', pkgMaterialForm.sourceCourseCode);
      if (pkgMaterialFile) {
        fd.append('file', pkgMaterialFile);
      }
      if (pkgMaterialForm.externalUrl.trim()) {
        fd.append('external_url', pkgMaterialForm.externalUrl.trim());
      }

      const res = await fetch(`/api/admin/course-packages/${viewPackage.id}/materials`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (json.success) {
        setPackageCurriculum((prev: any) => ({
          ...prev,
          materials: [json.data, ...(prev?.materials || [])],
        }));
        setPkgMaterialModalOpen(false);
        setPkgMaterialForm({
          title: '',
          description: '',
          materialType: 'SYLLABUS',
          externalUrl: '',
          sourceCourseCode: 'PACKAGE',
        });
        setPkgMaterialFile(null);
        setCurriculumNotice({ type: 'success', message: 'Material added to package curriculum.' });
      } else {
        setCurriculumNotice({ type: 'error', message: json.error || 'Failed to add material.' });
      }
    } catch (err: any) {
      setCurriculumNotice({ type: 'error', message: err.message || 'Error uploading material.' });
    } finally {
      setIsUploadingPkgMaterial(false);
    }
  };

  const handleSavePkgProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewPackage?.id || !packageCurriculum) return;
    if (!pkgProcedureForm.title.trim()) {
      setCurriculumNotice({ type: 'error', message: 'Step title is required.' });
      return;
    }

    try {
      setIsCurriculumSaving(true);
      let updatedProcedures = [...(packageCurriculum.procedures || [])];
      if (editingPkgProcedureIdx !== null && editingPkgProcedureIdx >= 0) {
        updatedProcedures[editingPkgProcedureIdx] = {
          ...pkgProcedureForm,
          stepNumber: editingPkgProcedureIdx + 1,
        };
      } else {
        updatedProcedures.push({
          ...pkgProcedureForm,
          id: `pkg-step-${Date.now()}`,
          stepNumber: updatedProcedures.length + 1,
        });
      }

      updatedProcedures = updatedProcedures.map((p, idx) => ({ ...p, stepNumber: idx + 1 }));

      const res = await fetch(`/api/admin/course-packages/${viewPackage.id}/curriculum`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procedures: updatedProcedures }),
      });
      const json = await res.json();
      if (json.success) {
        setPackageCurriculum((prev: any) => ({ ...prev, procedures: json.data.procedures }));
        setPkgProcedureModalOpen(false);
        setEditingPkgProcedureIdx(null);
        setCurriculumNotice({ type: 'success', message: 'Procedure step saved successfully.' });
      } else {
        setCurriculumNotice({ type: 'error', message: json.error || 'Failed to save procedure step.' });
      }
    } catch (err: any) {
      setCurriculumNotice({ type: 'error', message: err.message || 'Error saving procedure step.' });
    } finally {
      setIsCurriculumSaving(false);
    }
  };

  const handleDeletePkgProcedure = async (index: number) => {
    if (!viewPackage?.id || !packageCurriculum) return;
    if (!confirm('Are you sure you want to delete this procedure step?')) return;

    try {
      setIsCurriculumSaving(true);
      const filtered = (packageCurriculum.procedures || []).filter((_, idx) => idx !== index);
      const reindexed = filtered.map((p, idx) => ({ ...p, stepNumber: idx + 1 }));

      const res = await fetch(`/api/admin/course-packages/${viewPackage.id}/curriculum`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procedures: reindexed }),
      });
      const json = await res.json();
      if (json.success) {
        setPackageCurriculum((prev: any) => ({ ...prev, procedures: json.data.procedures }));
        setCurriculumNotice({ type: 'success', message: 'Procedure step removed.' });
      } else {
        setCurriculumNotice({ type: 'error', message: json.error || 'Failed to delete step.' });
      }
    } catch (err: any) {
      setCurriculumNotice({ type: 'error', message: err.message || 'Error deleting step.' });
    } finally {
      setIsCurriculumSaving(false);
    }
  };

  const handleMovePkgProcedure = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!viewPackage?.id || !packageCurriculum) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const procs = [...(packageCurriculum.procedures || [])];
    if (targetIndex < 0 || targetIndex >= procs.length) return;

    const temp = procs[index];
    procs[index] = procs[targetIndex];
    procs[targetIndex] = temp;
    const reindexed = procs.map((p, idx) => ({ ...p, stepNumber: idx + 1 }));

    try {
      setIsCurriculumSaving(true);
      const res = await fetch(`/api/admin/course-packages/${viewPackage.id}/curriculum`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procedures: reindexed }),
      });
      const json = await res.json();
      if (json.success) {
        setPackageCurriculum((prev: any) => ({ ...prev, procedures: json.data.procedures }));
      }
    } catch (err: any) {
      setCurriculumNotice({ type: 'error', message: 'Failed to reorder procedure steps.' });
    } finally {
      setIsCurriculumSaving(false);
    }
  };

  const handleResetPkgCurriculum = async () => {
    if (!viewPackage?.id) return;
    if (!confirm('Re-sync and reset merged curriculum from original bundled courses? Any custom manual modifications will be replaced with standard STCW pipeline.')) return;

    try {
      setIsCurriculumSaving(true);
      const res = await fetch(`/api/admin/course-packages/${viewPackage.id}/curriculum`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_MERGED' }),
      });
      const json = await res.json();
      if (json.success) {
        setPackageCurriculum(json.data);
        setCurriculumNotice({ type: 'success', message: 'Curriculum successfully re-merged from bundled courses!' });
      } else {
        setCurriculumNotice({ type: 'error', message: json.error || 'Failed to re-sync curriculum.' });
      }
    } catch (err: any) {
      setCurriculumNotice({ type: 'error', message: err.message || 'Error resetting curriculum.' });
    } finally {
      setIsCurriculumSaving(false);
    }
  };

  const handleSavePkgAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewPackage?.id || !packageCurriculum) return;
    if (!pkgAssessmentForm.title.trim()) {
      setCurriculumNotice({ type: 'error', message: 'Assessment title is required.' });
      return;
    }

    try {
      setIsCurriculumSaving(true);
      let updatedAssessments = [...(packageCurriculum.assessments || [])];
      if (editingPkgAssessmentIdx !== null && editingPkgAssessmentIdx >= 0) {
        updatedAssessments[editingPkgAssessmentIdx] = {
          ...pkgAssessmentForm,
          passingScore: Number(pkgAssessmentForm.passingScore) || 75,
          durationMinutes: Number(pkgAssessmentForm.durationMinutes) || 60,
        };
      } else {
        updatedAssessments.push({
          ...pkgAssessmentForm,
          id: `pkg-assess-${Date.now()}`,
          passingScore: Number(pkgAssessmentForm.passingScore) || 75,
          durationMinutes: Number(pkgAssessmentForm.durationMinutes) || 60,
        });
      }

      const res = await fetch(`/api/admin/course-packages/${viewPackage.id}/curriculum`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessments: updatedAssessments }),
      });
      const json = await res.json();
      if (json.success) {
        setPackageCurriculum((prev: any) => ({ ...prev, assessments: json.data.assessments }));
        setPkgAssessmentModalOpen(false);
        setEditingPkgAssessmentIdx(null);
        setCurriculumNotice({ type: 'success', message: 'Assessment saved successfully.' });
      } else {
        setCurriculumNotice({ type: 'error', message: json.error || 'Failed to save assessment.' });
      }
    } catch (err: any) {
      setCurriculumNotice({ type: 'error', message: err.message || 'Error saving assessment.' });
    } finally {
      setIsCurriculumSaving(false);
    }
  };

  const handleDeletePkgAssessment = async (index: number) => {
    if (!viewPackage?.id || !packageCurriculum) return;
    if (!confirm('Are you sure you want to delete this assessment?')) return;

    try {
      setIsCurriculumSaving(true);
      const filtered = (packageCurriculum.assessments || []).filter((_, idx) => idx !== index);

      const res = await fetch(`/api/admin/course-packages/${viewPackage.id}/curriculum`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessments: filtered }),
      });
      const json = await res.json();
      if (json.success) {
        setPackageCurriculum((prev: any) => ({ ...prev, assessments: json.data.assessments }));
        setCurriculumNotice({ type: 'success', message: 'Assessment removed.' });
      } else {
        setCurriculumNotice({ type: 'error', message: json.error || 'Failed to delete assessment.' });
      }
    } catch (err: any) {
      setCurriculumNotice({ type: 'error', message: err.message || 'Error deleting assessment.' });
    } finally {
      setIsCurriculumSaving(false);
    }
  };

  const toggleCourseSelection = (course: any) => {
    if (selectedCourses.find(c => c.id === course.id)) {
      setSelectedCourses(selectedCourses.filter(c => c.id !== course.id));
    } else {
      setSelectedCourses([...selectedCourses, course]);
    }
  };

  // Calculations for Package Form
  const pkgRegularTotal = selectedCourses.reduce((sum, c) => sum + Number(c.fee || c.price || 0), 0);
  const pkgDiscount = Math.max(0, parseFloat(packageForm.discount) || 0);
  const pkgFinalPrice = Math.max(0, pkgRegularTotal - pkgDiscount);
  const pkgSavingsPercent = pkgRegularTotal > 0 ? Math.round((pkgDiscount / pkgRegularTotal) * 100) : 0;
  const pkgTotalHours = selectedCourses.reduce((sum, c) => sum + Number(c.durationHours || c.duration_hours || 40), 0);
  const pkgTotalDays = Math.ceil(pkgTotalHours / 8);

  // Filtered course list for main grid
  const displayedCourses = courses.filter((c: any) => {
    const isDisabled = ['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((c.status || '').toUpperCase());
    if (courseStatusFilter === 'ACTIVE' && isDisabled) return false;
    if (courseStatusFilter === 'DISABLED' && !isDisabled) return false;
    if (categoryFilter !== 'ALL') {
      const cat = String(c.category || '').trim().toLowerCase();
      if (categoryFilter === 'In-House Courses') {
        if (!cat.includes('in-house')) return false;
      } else if (categoryFilter === 'Safety and Other STCW Courses') {
        if (cat.includes('in-house')) return false;
      } else if (c.category !== categoryFilter) {
        return false;
      }
    }
    return true;
  });

  const stcwCoursesCount = courses.filter((c: any) => !String(c.category || '').toLowerCase().includes('in-house')).length;
  const inHouseCoursesCount = courses.filter((c: any) => String(c.category || '').toLowerCase().includes('in-house')).length;

  // Filtered package list for main grid
  const displayedPackages = packages.filter((pkg: any) => {
    const isDisabled = ['SUSPENDED', 'DISABLED', 'ARCHIVED', 'INACTIVE'].includes((pkg.status || '').toUpperCase());
    if (packageStatusFilter === 'ACTIVE' && isDisabled) return false;
    if (packageStatusFilter === 'DISABLED' && !isDisabled) return false;
    return true;
  });

  // Filtered course list for package selector inside modal
  const coursesForModal = (allCoursesForPackage.length > 0 ? allCoursesForPackage : courses).filter((c: any) => {
    if (!courseSearchInModal) return true;
    const q = courseSearchInModal.toLowerCase();
    return (
      (c.code || '').toLowerCase().includes(q) ||
      (c.title || c.name || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q)
    );
  });

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
                Curriculum & Package Management
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Courses & Course Packages
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl">
              Configure maritime curricula, toggle course availability, manage STCW capacities, and bundle accredited courses into packages.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenCreateCourseModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs shadow-md transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>New Course</span>
            </button>
            <button
              onClick={() => {
                setPackageError(null);
                setCourseSearchInModal('');
                setCreatePackageModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-md shadow-blue-900/20 transition-all active:scale-[0.98]"
            >
              <Package className="w-4 h-4" />
              <span>New Course Package</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('COURSES')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all relative ${
              activeTab === 'COURSES'
                ? 'bg-sky-600 text-white shadow-sm shadow-blue-900/20'
                : 'text-slate-600 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#102A3F]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Courses Catalog</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'COURSES' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}>
              {courses.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PACKAGES')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all relative ${
              activeTab === 'PACKAGES'
                ? 'bg-sky-600 text-white shadow-sm shadow-blue-900/20'
                : 'text-slate-600 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#102A3F]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Course Packages</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'PACKAGES' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}>
              {packages.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
        {/* Top Row: Search & Status / Count */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === 'COURSES'
                  ? 'Search courses by code, title, category...'
                  : 'Search packages by code, name, description...'
              }
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-emerald-500/50 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeTab === 'COURSES' ? (
            <div className="flex items-center justify-between sm:justify-end gap-3">
              {/* Status Filter Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
                {(['ALL', 'ACTIVE', 'DISABLED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setCourseStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                      courseStatusFilter === st
                        ? st === 'DISABLED'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                {displayedCourses.length} {displayedCourses.length === 1 ? 'course' : 'courses'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
                {(['ALL', 'ACTIVE', 'DISABLED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setPackageStatusFilter(status)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-mono font-bold uppercase transition-all ${
                      packageStatusFilter === status
                        ? status === 'DISABLED'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                {displayedPackages.length} {displayedPackages.length === 1 ? 'package' : 'packages'}
              </span>
            </div>
          )}
        </div>

        {/* Category Filter Pills Row (Courses Tab) */}
        {activeTab === 'COURSES' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {[
              { id: 'ALL', label: 'All Categories', count: courses.length, badge: null },
              { id: 'Safety and Other STCW Courses', label: 'Safety and Other STCW Courses', count: stcwCoursesCount, badge: 'Modular + Practical' },
              { id: 'In-House Courses', label: 'In-House Courses', count: inHouseCoursesCount, badge: 'Full Modular-Based' },
            ].map((cat) => {
              const isActive = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-sky-600 dark:text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800'
                  }`}
                >
                  <span>{cat.label}</span>
                  {cat.badge && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : cat.id === 'In-House Courses'
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {cat.badge}
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800/60 rounded-full" />
              </div>
              <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
              <div className="h-3.5 w-2/3 bg-slate-100 dark:bg-slate-800/60 rounded" />
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'COURSES' ? (
        /* ================= COURSES GRID ================= */
        displayedCourses.length === 0 ? (
          <div className="py-16 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8">
            <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">No courses found</div>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No course matches your current filter or search criteria.
            </p>
            <button
              onClick={handleOpenCreateCourseModal}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold"
            >
              Add New Course
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
            {displayedCourses.map((c, idx) => {
              const capacity = c.capacity ?? 24;
              const isDisabled = ['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((c.status || '').toUpperCase());

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: easeCurve, delay: idx * 0.03 }}
                  className={`rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${
                    isDisabled ? 'opacity-90 bg-slate-50/50 dark:bg-[#0c1a2c]' : ''
                  }`}
                >
                  <div className="p-5 flex flex-col justify-between flex-1">
                    {/* Top Section */}
                    <div>
                      {/* Row 1: Code Badge & Status Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shrink-0">
                          {c.code}
                        </span>

                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          isDisabled
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            : ['PUBLISHED', 'ACTIVE'].includes(c.status)
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-500/15 text-slate-500 border border-slate-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isDisabled ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                          {isDisabled ? 'DISABLED' : (c.status || 'PUBLISHED')}
                        </span>
                      </div>

                      {/* Category tag & Delivery Mode Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                        <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
                          <span>{c.category || 'Safety and Other STCW Courses'}</span>
                        </div>
                        {String(c.category || '').toLowerCase().includes('in-house') ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            Full Modular-Based
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            Modular + Practical
                          </span>
                        )}
                      </div>

                      {/* Course Title (consistent min-height for uniform alignment across rows) */}
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading leading-snug line-clamp-2 min-h-[2.75rem] flex items-center group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {c.title}
                      </h3>

                      {/* Description (consistent min-height) */}
                      <p className="text-xs text-slate-500 dark:text-[#CBD5E1] line-clamp-2 leading-relaxed min-h-[2.25rem] mt-1.5">
                        {c.description || 'Maritime training curriculum and certified simulator modules.'}
                      </p>
                    </div>

                    {/* Middle Section: Clean Metrics (Duration & Capacity) */}
                    <div className="my-4 py-3 border-y border-slate-100 dark:border-slate-800">
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Duration Card */}
                        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
                          <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                              Duration
                            </div>
                            <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] truncate">
                              {c.durationHours ? `${Math.ceil(c.durationHours / 8)} Days` : 'N/A'}
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                ({c.durationHours || 40}h)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Capacity Card */}
                        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
                          <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                              Capacity
                            </div>
                            <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] truncate">
                              {capacity} Pax
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div>
                        <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider font-semibold">
                          Tuition Fee
                        </div>
                        <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                          ₱{(c.fee || c.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Disable / Enable Button */}
                        <button
                          type="button"
                          title={isDisabled ? "Enable Course" : "Disable Course"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCourseStatus(c.id, c.status);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                            isDisabled
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {isDisabled ? <Power className="w-3.5 h-3.5 text-emerald-600" /> : <PowerOff className="w-3.5 h-3.5 text-amber-600" />}
                          <span>{isDisabled ? 'Enable' : 'Disable'}</span>
                        </button>

                        {/* View Details Button */}
                        <button
                          onClick={() => setViewCourse(c)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs transition-all shadow-xs active:scale-95"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      ) : (
        /* ================= PACKAGES GRID ================= */
        displayedPackages.length === 0 ? (
          <div className="py-16 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8">
            <Package className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {packages.length === 0 ? 'No course packages available' : 'No course packages match your filter'}
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {packages.length === 0
                ? 'Bundle multiple STCW and specialty courses together into packages with custom discounts.'
                : 'Try adjusting your status filter or search query.'}
            </p>
            {packages.length === 0 && (
              <button
                onClick={() => {
                  setPackageError(null);
                  setCourseSearchInModal('');
                  setCreatePackageModal(true);
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold shadow-md shadow-blue-900/20"
              >
                Create Course Package
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
            {displayedPackages.map((pkg, idx) => {
              const regularTotal = Number(pkg.package_price || 0) + Number(pkg.discount || 0);
              const hasDiscount = Number(pkg.discount || 0) > 0;
              const items = pkg.items || [];
              const totalDays = items.reduce((sum: number, it: any) => sum + Math.ceil((it.courses?.duration_hours || 40) / 8), 0);
              const pkgTotalHrs = items.reduce((sum: number, it: any) => sum + (it.courses?.duration_hours || 40), 0);
              const isPkgDisabled = ['DISABLED', 'SUSPENDED', 'ARCHIVED', 'INACTIVE'].includes((pkg.status || '').toUpperCase());

              return (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: easeCurve, delay: idx * 0.03 }}
                  className={`rounded-3xl bg-white dark:bg-[#0c1a2c] border ${
                    isPkgDisabled ? 'border-amber-300/80 dark:border-amber-700/50' : 'border-slate-200/80 dark:border-slate-800'
                  } shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group min-h-[380px]`}
                >
                  <div className="p-5 flex flex-col justify-between flex-1">
                    {/* Header & Badges */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {pkg.package_code}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            !isPkgDisabled
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              !isPkgDisabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                            }`}
                          />
                          {!isPkgDisabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      {/* Package Tag */}
                      <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{items.length} Accredited Courses Bundled</span>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading leading-snug line-clamp-2 min-h-[2.75rem] flex items-center group-hover:text-blue-600 transition-colors">
                        {pkg.name}
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-[#CBD5E1] mt-1.5 line-clamp-2 leading-relaxed min-h-[2.25rem]">
                        {pkg.description || 'Special multi-course maritime bundle program with merged curriculum.'}
                      </p>

                      {/* Course Code Preview chips */}
                      {items.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {items.slice(0, 3).map((item: any) => (
                            <span
                              key={item.courses?.id || Math.random()}
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 truncate max-w-[110px]"
                            >
                              {item.courses?.code}
                            </span>
                          ))}
                          {items.length > 3 && (
                            <span className="text-[10px] font-mono text-slate-400 self-center">
                              +{items.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metrics Section: Duration & Capacity */}
                    <div className="my-3 py-3 border-y border-slate-100 dark:border-slate-800">
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Duration Card */}
                        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
                          <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                              Duration
                            </div>
                            <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] truncate">
                              {totalDays} Days
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                ({pkgTotalHrs}h)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Capacity Card */}
                        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
                          <div className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                              Capacity
                            </div>
                            <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] truncate">
                              24 Pax
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pricing Box & Card Bottom */}
                    <div>
                      {hasDiscount && (
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                          <span>Regular Total: <span className="line-through">₱{regularTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                          <span className="text-emerald-600 font-bold">Save ₱{Number(pkg.discount).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider font-semibold">
                            Package Fee
                          </div>
                          <div className="text-base font-extrabold text-slate-900 dark:text-sky-400 font-mono">
                            ₱{Number(pkg.package_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Disable / Enable Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePackageStatus(pkg.id, pkg.status, pkg.package_code || pkg.name);
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                              isPkgDisabled
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                            }`}
                            title={isPkgDisabled ? 'Enable Course Package' : 'Disable Course Package'}
                          >
                            {isPkgDisabled ? <Power className="w-3.5 h-3.5 text-emerald-600" /> : <PowerOff className="w-3.5 h-3.5 text-amber-600" />}
                            <span>{isPkgDisabled ? 'Enable' : 'Disable'}</span>
                          </button>

                          <button
                            onClick={() => {
                              setViewPackage(pkg);
                              setActivePackageTab('SYLLABUS');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 font-semibold text-xs transition-all shadow-xs active:scale-95"
                            title="Manage Package Curriculum"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Curriculum</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {/* ================= MODALS ================= */}

      {/* 1. View Course Modal */}
      <AnimatePresence>
        {viewCourse && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setViewCourse(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {viewCourse.code}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">
                      {viewCourse.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {viewCourse.title || viewCourse.name}
                  </h3>
                </div>
                <button
                  onClick={() => setViewCourse(null)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full p-1.5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="py-4 overflow-y-auto space-y-6">
                {/* Description */}
                <div>
                  <h4 className="text-xs font-mono font-bold text-slate-400 uppercase mb-2">Full Description</h4>
                  <p className="text-sm text-slate-700 dark:text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">
                    {viewCourse.description || 'No detailed syllabus description provided.'}
                  </p>
                </div>

                {/* Key Metrics Grid (Well-spaced, no crowding) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono mb-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Duration</span>
                    </div>
                    <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {viewCourse.durationHours ? `${Math.ceil(viewCourse.durationHours / 8)} Days` : 'N/A'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {viewCourse.durationHours || 40} Training Hours
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono mb-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Tuition Fee</span>
                    </div>
                    <div className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                      ₱{(viewCourse.fee || viewCourse.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">Standard Rate</div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span>Status</span>
                    </div>
                    <div className={`font-bold font-mono text-xs ${
                      ['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((viewCourse.status || '').toUpperCase()) ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((viewCourse.status || '').toUpperCase()) ? 'DISABLED' : (viewCourse.status || 'PUBLISHED')}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">Course Visibility</div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono mb-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Created</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs">
                      {new Date(viewCourse.createdAt || viewCourse.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">Registry Date</div>
                  </div>
                </div>

                {/* Dedicated Capacity Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white font-heading">
                        Class Capacity
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        STCW Maritime Compliance Standard
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-extrabold font-mono text-blue-600 dark:text-blue-400">
                      {viewCourse.capacity ?? 24} Pax
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Maximum Batch Limit
                    </div>
                  </div>
                </div>

                {/* Course Curriculum & Compliance Quick Indicators */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                      Curriculum Specifications & Compliance
                    </span>
                    <button
                      onClick={() => window.location.href = `/admin/courses/${viewCourse.id}`}
                      className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <span>Open Full Editor</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-black/40 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">Course Syllabus</div>
                        <div className="text-[9px] font-mono text-slate-400">Documents & Topics</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-black/40 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <Compass className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">Procedures</div>
                        <div className="text-[9px] font-mono text-slate-400">5-Phase STCW Pipeline</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-black/40 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <GraduationCap className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">Assessment</div>
                        <div className="text-[9px] font-mono text-slate-400">Passing Mark 75%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions: Disable, Delete, Manage, Edit */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2.5 shrink-0">
                <button
                  onClick={() => window.location.href = `/admin/courses/${viewCourse.id}`}
                  className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 font-semibold text-xs transition-colors"
                >
                  Manage Curriculum
                </button>
                <div className="flex-1" />
                <button
                  disabled={isUpdatingStatus}
                  onClick={() => handleToggleCourseStatus(viewCourse.id, viewCourse.status)}
                  className={`px-3.5 py-2 rounded-xl font-semibold text-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 ${
                    ['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((viewCourse.status || '').toUpperCase())
                      ? 'border border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                      : 'border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  }`}
                >
                  {isUpdatingStatus ? (
                    'Updating...'
                  ) : ['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((viewCourse.status || '').toUpperCase()) ? (
                    <>
                      <Power className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Enable Course</span>
                    </>
                  ) : (
                    <>
                      <PowerOff className="w-3.5 h-3.5 text-amber-600" />
                      <span>Disable Course</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setCourseForm({
                      ...initialCourseForm,
                      code: viewCourse.code || '',
                      title: viewCourse.title || viewCourse.name || '',
                      category: viewCourse.category || 'Safety and Other STCW Courses',
                      description: viewCourse.description || '',
                      durationHours: (viewCourse.durationHours || viewCourse.duration_hours || 40).toString(),
                      capacity: (viewCourse.capacity || 24).toString(),
                      fee: (viewCourse.fee || viewCourse.price || 10000).toString()
                    });
                    setEditCourseModal(viewCourse);
                    setViewCourse(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs"
                >
                  Edit Course
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Create Course Package Modal */}
      <AnimatePresence>
        {createPackageModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setCreatePackageModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 max-h-[92vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-sky-600 text-white shadow-md shadow-blue-900/20">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                      Create Course Package
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Bundle multiple accredited courses together with custom package pricing and discounts.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCreatePackageModal(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full p-1.5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form Content */}
              <form onSubmit={handleCreatePackage} className="py-4 overflow-y-auto space-y-5 flex-1">
                {packageError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{packageError}</span>
                  </div>
                )}

                {/* Section 1: Package Identity */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">
                      Package Code *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. PKG-STCW-01"
                      value={packageForm.packageCode}
                      onChange={(e) => setPackageForm({ ...packageForm, packageCode: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs uppercase"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">
                      Package Name *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. STCW Mandatory Safety Bundle"
                      value={packageForm.name}
                      onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">
                      Description
                    </label>
                    <textarea
                      placeholder="Brief overview of what certifications and skills are covered in this package..."
                      value={packageForm.description}
                      onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none text-xs min-h-[70px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">
                      Validity Period (Days)
                    </label>
                    <div className="relative">
                      <input
                        required
                        type="number"
                        min="1"
                        value={packageForm.validityDays}
                        onChange={(e) => setPackageForm({ ...packageForm, validityDays: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
                        Days
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Default: 365 days (1 year)</span>
                  </div>
                </div>

                {/* Section 2: Course Picker & Bundle Manager */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-slate-900 dark:text-white uppercase font-heading flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-blue-600" />
                        <span>Select Included Courses ({selectedCourses.length} Selected)</span>
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Choose the maritime courses that will be bundled together into this package.
                      </p>
                    </div>

                    {selectedCourses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCourses([])}
                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>

                  {/* Search for courses to bundle */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={courseSearchInModal}
                      onChange={(e) => setCourseSearchInModal(e.target.value)}
                      placeholder="Search courses by code, title, or category..."
                      className="w-full pl-8 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                    />
                  </div>

                  {/* Selected courses preview chips */}
                  {selectedCourses.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                      {selectedCourses.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#0c1a2c] text-slate-800 dark:text-slate-200 border border-blue-200 dark:border-blue-900 text-xs shadow-xs"
                        >
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{c.code}</span>
                          <span className="max-w-[140px] truncate">{c.title || c.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleCourseSelection(c)}
                            className="text-slate-400 hover:text-rose-500 ml-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Scrollable course selection checklist */}
                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900/60">
                    {coursesForModal.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No courses found matching "{courseSearchInModal}".
                      </div>
                    ) : (
                      coursesForModal.map((c) => {
                        const isSelected = selectedCourses.some((sc) => sc.id === c.id);
                        const fee = Number(c.fee || c.price || 0);
                        const days = Math.ceil((c.durationHours || c.duration_hours || 40) / 8);

                        return (
                          <div
                            key={c.id}
                            onClick={() => toggleCourseSelection(c)}
                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50/70 dark:bg-blue-950/40'
                                : 'hover:bg-slate-50 dark:hover:bg-[#0D2438]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'bg-sky-600 border-[#0B3D91] text-white'
                                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                    {c.code}
                                  </span>
                                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                    {c.title || c.name}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {c.category} • {days} Days ({c.durationHours || c.duration_hours || 40} hrs)
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-mono font-extrabold text-xs text-slate-900 dark:text-white">
                                ₱{fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Merged Package Content & Curriculum Roadmap Preview */}
                {selectedCourses.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase font-heading">
                            Merged Curriculum & Course Content
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Syllabus materials, modular STCW procedures, and competency assessments from all {selectedCourses.length} selected courses will be automatically merged into this package.
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                        {selectedCourses.length} Courses Merged
                      </span>
                    </div>

                    {/* Merged Phased Roadmap Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200/70 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase">
                            1. Merged Syllabus
                          </span>
                          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {selectedCourses.length} Syllabus Modules
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          All slides, handouts, and outlines from {selectedCourses.map(c => c.code).join(', ')}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200/70 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400 uppercase">
                            2. Merged Procedures
                          </span>
                          <Compass className="w-3.5 h-3.5 text-teal-500" />
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {pkgTotalHours}h Phased Roadmap
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Theory, bridge/engine simulator drills, and watchkeeping exercises
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200/70 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                            3. Merged Assessments
                          </span>
                          <Award className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {selectedCourses.length} Competency Exams
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Written & practical checks releasing multi-course STCW certificates
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 3: Package Pricing & Discount Live Calculator */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase font-heading flex items-center justify-between">
                    <span>Pricing & Savings Summary</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Total Syllabus: {pkgTotalDays} Days ({pkgTotalHours}h)
                    </span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                        Regular Total (Sum)
                      </label>
                      <div className="font-mono font-bold text-sm text-slate-700 dark:text-slate-300">
                        ₱{pkgRegularTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 font-semibold">
                        Bundle Discount (₱)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={packageForm.discount}
                        onChange={(e) => setPackageForm({ ...packageForm, discount: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-xs font-mono outline-none text-emerald-600 font-bold"
                      />
                    </div>

                    <div className="sm:text-right">
                      <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 font-semibold">
                        Final Package Price
                      </label>
                      <div className="font-mono font-extrabold text-lg text-slate-900 dark:text-sky-400">
                        ₱{pkgFinalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      {pkgDiscount > 0 && (
                        <span className="text-[10px] font-mono text-emerald-600 font-semibold">
                          Save ₱{pkgDiscount.toLocaleString()} ({pkgSavingsPercent}% OFF)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCreatePackageModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPackage || selectedCourses.length === 0}
                    className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-blue-900 text-white font-semibold text-xs shadow-md shadow-blue-900/20 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmittingPackage ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Creating Package...</span>
                      </>
                    ) : (
                      <>
                        <Package className="w-4 h-4" />
                        <span>Create Course Package</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. View Package Modal */}
      <AnimatePresence>
        {viewPackage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setViewPackage(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 max-h-[92vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {viewPackage.package_code}
                    </span>
                    {(() => {
                      const isViewDisabled = ['DISABLED', 'SUSPENDED', 'ARCHIVED', 'INACTIVE'].includes((viewPackage.status || '').toUpperCase());
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          !isViewDisabled
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${!isViewDisabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                          {!isViewDisabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      );
                    })()}
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {viewPackage.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Comprehensive Maritime Course Bundle • {viewPackage.items?.length || 0} Courses Included
                  </p>
                </div>
                <button
                  onClick={() => setViewPackage(null)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full p-1.5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs Bar for Package */}
              <div className="flex items-center gap-1.5 pt-3 pb-2 border-b border-slate-200/80 dark:border-slate-800 shrink-0 overflow-x-auto">
                {[
                  { id: 'COURSES', label: `Included Courses (${viewPackage.items?.length || 0})`, icon: Layers },
                  { id: 'SYLLABUS', label: `Merged Syllabus (${packageCurriculum?.materials?.length ?? '...'})`, icon: BookOpen },
                  { id: 'PROCEDURES', label: `Merged Procedures (${packageCurriculum?.procedures?.length ?? '...'})`, icon: Compass },
                  { id: 'ASSESSMENTS', label: `Merged Assessments (${packageCurriculum?.assessments?.length ?? '...'})`, icon: Award },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActivePackageTab(tab.id as any)}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        activePackageTab === tab.id
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Modal Body */}
              <div className="py-4 overflow-y-auto space-y-5 flex-1">
                {/* Description Callout if present */}
                {viewPackage.description && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <span className="font-bold text-slate-900 dark:text-white mr-1.5">Overview:</span>
                    {viewPackage.description}
                  </div>
                )}

                {loadingPackageCurriculum ? (
                  <div className="py-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Loading merged package curriculum...</span>
                  </div>
                ) : activePackageTab === 'COURSES' ? (
                  /* TAB 1: INCLUDED COURSES */
                  <div className="space-y-4">
                    <div className="space-y-2.5">
                      {viewPackage.items?.sort((a: any, b: any) => a.sort_order - b.sort_order).map((item: any, idx: number) => {
                        const c = item.courses;
                        const durationHrs = c?.duration_hours || 40;
                        const days = Math.ceil(durationHrs / 8);
                        return (
                          <div
                            key={c?.id || item.id}
                            className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between gap-3 hover:border-blue-500/40 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    {c?.code}
                                  </span>
                                  <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                    {c?.name}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 truncate mt-1">
                                  {c?.category || 'STCW Course'} • {days} Days ({durationHrs}h) • Max 24 Pax
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                                ₱{Number(c?.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Individual Fee
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Financial Summary */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between text-xs font-mono text-slate-600 dark:text-slate-400">
                        <span>Combined Regular Tuition Sum</span>
                        <span>
                          ₱{(Number(viewPackage.package_price) + Number(viewPackage.discount)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-mono text-emerald-600">
                        <span>Package Bundle Discount</span>
                        <span>-₱{Number(viewPackage.discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700">
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase font-heading block">
                            PACKAGE FEE
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Valid for {viewPackage.validity_days || 365} days from enrollment
                          </span>
                        </div>
                        <span className="text-2xl font-extrabold text-slate-900 dark:text-sky-400 font-mono">
                          ₱{Number(viewPackage.package_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : activePackageTab === 'SYLLABUS' ? (
                  /* TAB 2: MERGED SYLLABUS & MATERIALS */
                  <div className="space-y-4">
                    {/* Live Aggregation Header Banner */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-sky-500/5 to-emerald-500/10 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 shadow-sm">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                              Live Course Syllabus Aggregation
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Live Sync Active
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Syllabus documents, STCW competency outlines, and slide decks are synchronized in real-time from every course included in this package ({viewPackage.items?.map((it: any) => it.courses?.code).filter(Boolean).join(', ')}).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => fetchPackageCurriculum(viewPackage.id)}
                          disabled={loadingPackageCurriculum}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                          title="Refresh syllabus directly from courses"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${loadingPackageCurriculum ? 'animate-spin text-blue-600' : ''}`} />
                          <span>Live Sync</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPkgMaterialForm({
                              title: '',
                              description: '',
                              materialType: 'SYLLABUS',
                              externalUrl: '',
                              sourceCourseCode: viewPackage.items?.[0]?.courses?.code || 'PACKAGE',
                            });
                            setPkgMaterialFile(null);
                            setPkgMaterialModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Material</span>
                        </button>
                      </div>
                    </div>

                    {/* Course Filter Selector Pills Toolbar */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none">
                      <button
                        type="button"
                        onClick={() => setPackageCourseContentFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                          packageCourseContentFilter === 'ALL'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span>All Courses</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/15 dark:bg-white/15">
                          {packageCurriculum?.materials?.length || 0}
                        </span>
                      </button>

                      {viewPackage.items?.map((it: any) => {
                        const c = it.courses;
                        if (!c) return null;
                        const count = (packageCurriculum?.materials || []).filter(
                          (m: any) => m.sourceCourseCode === c.code || m.sourceCourseId === c.id
                        ).length;
                        const isSelected = packageCourseContentFilter === c.code || packageCourseContentFilter === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setPackageCourseContentFilter(c.code)}
                            className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <span className="font-mono font-bold">[{c.code}]</span>
                            <span className="text-[11px] opacity-80 max-w-[120px] truncate">{c.name}</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/15 dark:bg-white/15">
                              {count}
                            </span>
                          </button>
                        );
                      })}

                      {/* Package Level Pill */}
                      {(() => {
                        const pkgCount = (packageCurriculum?.materials || []).filter(
                          (m: any) => m.sourceCourseCode === 'PACKAGE' || m.isPackageLevel
                        ).length;
                        if (pkgCount === 0) return null;
                        const isSelected = packageCourseContentFilter === 'PACKAGE';
                        return (
                          <button
                            type="button"
                            onClick={() => setPackageCourseContentFilter('PACKAGE')}
                            className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <span className="font-mono font-bold">Package Level</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/15 dark:bg-white/15">
                              {pkgCount}
                            </span>
                          </button>
                        );
                      })()}
                    </div>

                    {(!viewPackage.items || viewPackage.items.length === 0) && (!packageCurriculum?.materials || packageCurriculum.materials.length === 0) ? (
                      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <span>No courses or materials added to this package yet.</span>
                        <button
                          onClick={() => {
                            setPkgMaterialForm({
                              title: '',
                              description: '',
                              materialType: 'SYLLABUS',
                              externalUrl: '',
                              sourceCourseCode: viewPackage.items?.[0]?.courses?.code || 'PACKAGE',
                            });
                            setPkgMaterialFile(null);
                            setPkgMaterialModalOpen(true);
                          }}
                          className="mt-1 text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                        >
                          + Upload First Material
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Render by Course Groupings */}
                        {viewPackage.items
                          ?.filter((it: any) => {
                            if (!it.courses) return false;
                            if (packageCourseContentFilter === 'ALL') return true;
                            if (packageCourseContentFilter === 'PACKAGE') return false;
                            return (
                              it.courses.code === packageCourseContentFilter ||
                              it.courses.id === packageCourseContentFilter
                            );
                          })
                          .map((it: any) => {
                            const c = it.courses;
                            const courseMaterials = (packageCurriculum?.materials || []).filter(
                              (m: any) => m.sourceCourseCode === c.code || m.sourceCourseId === c.id
                            );

                            return (
                              <div
                                key={c.id}
                                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 shadow-xs space-y-3"
                              >
                                {/* Course Header in Package Syllabus */}
                                <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-sky-600 text-white shadow-xs shrink-0">
                                      {c.code}
                                    </span>
                                    <div className="min-w-0">
                                      <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate flex items-center gap-2">
                                        <span>{c.name}</span>
                                        <span className="text-xs font-normal text-slate-400 font-mono shrink-0">
                                          • {c.duration_hours || 40}h
                                        </span>
                                      </h5>
                                      <p className="text-[11px] text-slate-400 truncate">
                                        {courseMaterials.length} syllabus {courseMaterials.length === 1 ? 'material' : 'materials'} attached
                                      </p>
                                    </div>
                                  </div>

                                  <Link
                                    href={`/admin/courses/${c.id}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-sky-400 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 transition-colors shrink-0"
                                    title={`Open ${c.code} course details page to add or manage syllabus`}
                                  >
                                    <span>Manage Course Syllabus</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Link>
                                </div>

                                {/* Course Materials Grid */}
                                {courseMaterials.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <span>No syllabus files uploaded yet for {c.code}.</span>
                                    <Link
                                      href={`/admin/courses/${c.id}`}
                                      target="_blank"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-sky-400 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 transition-colors shrink-0"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Upload Files to {c.code}</span>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </Link>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {courseMaterials.map((mat: any, mIdx: number) => {
                                      const isSyllabus = mat.materialType === 'SYLLABUS';
                                      const isPres = mat.materialType === 'PRESENTATION';
                                      const isVid = mat.materialType === 'VIDEO';
                                      const isOutline = Boolean(mat.isSyllabusOutline);

                                      return (
                                        <div
                                          key={`${mat.id || 'mat'}-${mat.sourceCourseCode || c.code}-${mIdx}`}
                                          className="p-3.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3 hover:border-blue-500/40 transition-colors group"
                                        >
                                          <div className="flex items-start gap-3">
                                            <div
                                              className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                                                isPres
                                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                                  : isVid
                                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                                  : isSyllabus
                                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                              }`}
                                            >
                                              {isPres ? (
                                                <Presentation className="w-4 h-4" />
                                              ) : isVid ? (
                                                <PlayCircle className="w-4 h-4" />
                                              ) : (
                                                <FileText className="w-4 h-4" />
                                              )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center justify-between gap-1.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                    {mat.sourceCourseCode || c.code}
                                                  </span>
                                                  <span
                                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                                      isPres
                                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                                        : isSyllabus
                                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                                        : isVid
                                                        ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                                                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                                    }`}
                                                  >
                                                    {mat.materialType || 'SYLLABUS'}
                                                  </span>
                                                  {isOutline && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                                      STCW Outline
                                                    </span>
                                                  )}
                                                </div>

                                                <Link
                                                  href={`/admin/courses/${c.id}`}
                                                  target="_blank"
                                                  className="p-1 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors opacity-70 group-hover:opacity-100"
                                                  title={`Open ${c.code} in Course Editor`}
                                                >
                                                  <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                              </div>

                                              <h5 className="font-bold text-xs text-slate-900 dark:text-white mt-1.5 line-clamp-1">
                                                {mat.title}
                                              </h5>

                                              {mat.fileName && !isOutline && (
                                                <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                                                  {mat.fileName}
                                                </p>
                                              )}

                                              {mat.description && (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                                                  {mat.description}
                                                </p>
                                              )}
                                            </div>
                                          </div>

                                          {/* Card Footer */}
                                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs gap-2">
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              {mat.fileSize > 0
                                                ? mat.fileSize >= 1024 * 1024
                                                  ? `${(mat.fileSize / (1024 * 1024)).toFixed(2)} MB`
                                                  : `${(mat.fileSize / 1024).toFixed(0)} KB`
                                                : isOutline
                                                ? 'STCW Verified'
                                                : 'Attached'}
                                            </span>

                                            <div className="flex items-center gap-1.5">
                                              {mat.fileUrl && (
                                                <a
                                                  href={mat.fileUrl}
                                                  download={mat.fileName || true}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                                >
                                                  <Download className="w-3 h-3" />
                                                  <span>Download</span>
                                                </a>
                                              )}

                                              {mat.externalUrl && !mat.fileUrl && (
                                                <a
                                                  href={mat.externalUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                                >
                                                  <ExternalLink className="w-3 h-3" />
                                                  <span>Open Resource</span>
                                                </a>
                                              )}

                                              {isOutline && (
                                                <button
                                                  type="button"
                                                  onClick={() => setViewingSyllabusOutline(mat)}
                                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                                >
                                                  <FileText className="w-3 h-3" />
                                                  <span>Read Outline</span>
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                        {/* Package Level Materials Group (if any or if selected) */}
                        {(() => {
                          const pkgMaterials = (packageCurriculum?.materials || []).filter(
                            (m: any) => m.sourceCourseCode === 'PACKAGE' || m.isPackageLevel
                          );
                          if (
                            packageCourseContentFilter !== 'ALL' &&
                            packageCourseContentFilter !== 'PACKAGE'
                          ) {
                            return null;
                          }
                          if (pkgMaterials.length === 0 && packageCourseContentFilter !== 'PACKAGE') {
                            return null;
                          }

                          return (
                            <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-50/30 dark:bg-sky-500/15 shadow-xs space-y-3">
                              <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-purple-200/50 dark:border-purple-800/30">
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-purple-600 text-white shadow-xs">
                                    PACKAGE LEVEL
                                  </span>
                                  <div>
                                    <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                                      Package-Wide Custom Materials
                                    </h5>
                                    <p className="text-[11px] text-slate-400">
                                      Custom documents and orientation materials added specifically to this bundle ({pkgMaterials.length})
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {pkgMaterials.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400 italic">
                                  No package-level materials added yet.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {pkgMaterials.map((mat: any, pIdx: number) => (
                                    <div
                                      key={mat.id || pIdx}
                                      className="p-3.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3 hover:border-purple-500/40 transition-colors group"
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-xl shrink-0 mt-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                          <FileText className="w-4 h-4" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-1.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300">
                                                PACKAGE
                                              </span>
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-600">
                                                {mat.materialType || 'DOCUMENT'}
                                              </span>
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() => handleDeletePkgMaterial(mat.id)}
                                              disabled={isCurriculumSaving}
                                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                                              title="Delete material from package"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>

                                          <h5 className="font-bold text-xs text-slate-900 dark:text-white mt-1.5 line-clamp-1">
                                            {mat.title}
                                          </h5>

                                          {mat.fileName && (
                                            <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                                              {mat.fileName}
                                            </p>
                                          )}

                                          {mat.description && (
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                                              {mat.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs gap-2">
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          {mat.fileSize > 0
                                            ? `${(mat.fileSize / 1024).toFixed(0)} KB`
                                            : 'Attached'}
                                        </span>

                                        <div className="flex items-center gap-1.5">
                                          {mat.fileUrl && (
                                            <a
                                              href={mat.fileUrl}
                                              download={mat.fileName || true}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                            >
                                              <Download className="w-3 h-3" />
                                              <span>Download</span>
                                            </a>
                                          )}

                                          {mat.externalUrl && !mat.fileUrl && (
                                            <a
                                              href={mat.externalUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                              <span>Open Resource</span>
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : activePackageTab === 'PROCEDURES' ? (
                  /* TAB 3: MERGED PROCEDURES ("What Trainee Must Undergo") */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span>Multi-course sequential training workflow & STCW procedures:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          ({packageCurriculum?.procedures?.reduce((sum: number, p: any) => sum + Number(p.hours || 0), 0) || 0} Hours Total)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleResetPkgCurriculum}
                          disabled={isCurriculumSaving}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
                          title="Re-merge and reset STCW pipeline from bundled courses"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isCurriculumSaving ? 'animate-spin' : ''}`} />
                          <span>Re-sync from Courses</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingPkgProcedureIdx(null);
                            setPkgProcedureForm({
                              id: '',
                              stepNumber: (packageCurriculum?.procedures?.length || 0) + 1,
                              phase: 'THEORY',
                              title: '',
                              description: '',
                              hours: 8,
                              mandatory: true,
                            });
                            setPkgProcedureModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Procedure Step</span>
                        </button>
                      </div>
                    </div>

                    {(!packageCurriculum?.procedures || packageCurriculum.procedures.length === 0) ? (
                      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                        <Compass className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <span>No procedural steps recorded for this package.</span>
                        <button
                          onClick={handleResetPkgCurriculum}
                          className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
                        >
                          Generate from Bundled Courses
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {packageCurriculum.procedures.map((proc: any, idx: number) => {
                          const phaseColor =
                            proc.phase === 'PREREQUISITE'
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              : proc.phase === 'THEORY'
                              ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                              : proc.phase === 'SIMULATOR'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : proc.phase === 'ASSESSMENT'
                              ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                              : 'bg-teal-500/10 text-teal-600 border-teal-500/20';

                          return (
                            <div
                              key={proc.id || idx}
                              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3 hover:border-blue-500/40 transition-colors group"
                            >
                              <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {proc.stepNumber || idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${phaseColor}`}>
                                    {proc.phase}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {proc.title}
                                  </span>
                                  {proc.mandatory && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 font-semibold">
                                      Mandatory
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                  {proc.description}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                                  {proc.hours} hrs
                                </span>
                                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleMovePkgProcedure(idx, 'UP')}
                                    disabled={idx === 0 || isCurriculumSaving}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-20 transition-colors"
                                    title="Move Step Up"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMovePkgProcedure(idx, 'DOWN')}
                                    disabled={idx === (packageCurriculum?.procedures?.length || 0) - 1 || isCurriculumSaving}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-20 transition-colors"
                                    title="Move Step Down"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingPkgProcedureIdx(idx);
                                      setPkgProcedureForm({ ...proc });
                                      setPkgProcedureModalOpen(true);
                                    }}
                                    className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                    title="Edit Procedure Step"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePkgProcedure(idx)}
                                    disabled={isCurriculumSaving}
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                    title="Delete Step"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* TAB 4: MERGED ASSESSMENTS */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span>Required competency assessments and examinations across package courses:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          ({packageCurriculum?.assessments?.length || 0})
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setEditingPkgAssessmentIdx(null);
                          setPkgAssessmentForm({
                            id: '',
                            title: '',
                            assessmentType: 'WRITTEN',
                            passingScore: 75,
                            durationMinutes: 60,
                            courseCode: viewPackage.items?.[0]?.courses?.code || 'PACKAGE',
                          });
                          setPkgAssessmentModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Assessment</span>
                      </button>
                    </div>

                    {(!packageCurriculum?.assessments || packageCurriculum.assessments.length === 0) ? (
                      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                        <Award className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <span>No assessments registered for this package.</span>
                        <button
                          onClick={() => {
                            setEditingPkgAssessmentIdx(null);
                            setPkgAssessmentForm({
                              id: '',
                              title: '',
                              assessmentType: 'WRITTEN',
                              passingScore: 75,
                              durationMinutes: 60,
                              courseCode: viewPackage.items?.[0]?.courses?.code || 'PACKAGE',
                            });
                            setPkgAssessmentModalOpen(true);
                          }}
                          className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
                        >
                          + Add Competency Exam
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {packageCurriculum.assessments.map((a: any, idx: number) => (
                          <div
                            key={a.id || idx}
                            className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 hover:border-blue-500/40 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                {a.courseCode || 'PACKAGE'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-emerald-600 font-bold">
                                  Pass: {a.passingScore || 75}%
                                </span>
                                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setEditingPkgAssessmentIdx(idx);
                                      setPkgAssessmentForm({
                                        id: a.id || '',
                                        title: a.title || '',
                                        assessmentType: a.assessmentType || 'WRITTEN',
                                        passingScore: a.passingScore || 75,
                                        durationMinutes: a.durationMinutes || 60,
                                        courseCode: a.courseCode || 'PACKAGE',
                                      });
                                      setPkgAssessmentModalOpen(true);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                    title="Edit Assessment"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePkgAssessment(idx)}
                                    disabled={isCurriculumSaving}
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                    title="Delete Assessment"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <h5 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                              {a.title}
                            </h5>
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span>Type: {a.assessmentType || 'WRITTEN'}</span>
                              <span>Duration: {a.durationMinutes || 60}m</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notification Banner */}
              {curriculumNotice && (
                <div className={`mx-6 mb-2 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shrink-0 ${
                  curriculumNotice.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                }`}>
                  <div className="flex items-center gap-2">
                    {curriculumNotice.type === 'success' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
                    <span>{curriculumNotice.message}</span>
                  </div>
                  <button onClick={() => setCurriculumNotice(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => handleTogglePackageStatus(viewPackage.id, viewPackage.status)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {viewPackage.status === 'ACTIVE' ? 'Archive Package' : 'Activate Package'}
                </button>
                <button
                  onClick={() => setViewPackage(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= PACKAGE CURRICULUM MANAGEMENT SUB-MODALS ================= */}

      {/* A. Add Package Material Modal */}
      <AnimatePresence>
        {pkgMaterialModalOpen && viewPackage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isUploadingPkgMaterial && setPkgMaterialModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-20 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                      Add Package Material
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Upload syllabus, slide deck, or reference document for {viewPackage.package_code}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !isUploadingPkgMaterial && setPkgMaterialModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddPkgMaterial} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={pkgMaterialForm.title}
                    onChange={(e) => setPkgMaterialForm({ ...pkgMaterialForm, title: e.target.value })}
                    placeholder="e.g. Master Bridge Resource Management Handbook"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Material Type
                    </label>
                    <select
                      value={pkgMaterialForm.materialType}
                      onChange={(e) => setPkgMaterialForm({ ...pkgMaterialForm, materialType: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="SYLLABUS">Syllabus Outline</option>
                      <option value="PRESENTATION">Presentation / Slides</option>
                      <option value="DOCUMENT">Manual / Document</option>
                      <option value="VIDEO">Training Video Link</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Course Ref
                    </label>
                    <select
                      value={pkgMaterialForm.sourceCourseCode}
                      onChange={(e) => setPkgMaterialForm({ ...pkgMaterialForm, sourceCourseCode: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="PACKAGE">All Courses (Package Level)</option>
                      {viewPackage.items?.map((it: any) => (
                        <option key={it.courses?.id || it.id} value={it.courses?.code || 'COURSE'}>
                          {it.courses?.code} - {it.courses?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Brief Description
                  </label>
                  <textarea
                    rows={2}
                    value={pkgMaterialForm.description}
                    onChange={(e) => setPkgMaterialForm({ ...pkgMaterialForm, description: e.target.value })}
                    placeholder="Overview of learning objectives covered in this handout..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Upload File (PDF, PPTX, DOCX, MP4 - Max 50MB)
                  </label>
                  <input
                    ref={pkgMaterialFileInputRef}
                    type="file"
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.mp4"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setPkgMaterialFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <div
                    onClick={() => pkgMaterialFileInputRef.current?.click()}
                    className="p-3.5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500/60 dark:hover:border-blue-500/60 bg-slate-50/50 dark:bg-slate-900/60 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 shrink-0">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {pkgMaterialFile ? pkgMaterialFile.name : 'Click to select or drop file'}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {pkgMaterialFile ? `${(pkgMaterialFile.size / 1024 / 1024).toFixed(2)} MB` : 'Max 50MB per file'}
                        </div>
                      </div>
                    </div>
                    {pkgMaterialFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPkgMaterialFile(null);
                        }}
                        className="text-xs text-rose-500 hover:underline shrink-0"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Or External Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={pkgMaterialForm.externalUrl}
                    onChange={(e) => setPkgMaterialForm({ ...pkgMaterialForm, externalUrl: e.target.value })}
                    placeholder="https://drive.google.com/... or https://youtube.com/..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isUploadingPkgMaterial}
                    onClick={() => setPkgMaterialModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingPkgMaterial || (!pkgMaterialFile && !pkgMaterialForm.externalUrl && !pkgMaterialForm.title)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isUploadingPkgMaterial ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save to Package</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* B. Add / Edit Package Procedure Step Modal */}
      <AnimatePresence>
        {pkgProcedureModalOpen && viewPackage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isCurriculumSaving && setPkgProcedureModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-20 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                      {editingPkgProcedureIdx !== null ? 'Edit Procedure Step' : 'Add Procedure Step'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Step in STCW trainee procedural pipeline for {viewPackage.package_code}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !isCurriculumSaving && setPkgProcedureModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSavePkgProcedure} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      STCW Phase *
                    </label>
                    <select
                      value={pkgProcedureForm.phase}
                      onChange={(e) => setPkgProcedureForm({ ...pkgProcedureForm, phase: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="PREREQUISITE">Prerequisite & Admission</option>
                      <option value="THEORY">Classroom Theory</option>
                      <option value="SIMULATOR">Simulator Practical</option>
                      <option value="ASSESSMENT">Competency Assessment</option>
                      <option value="CERTIFICATION">Certification & Debrief</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Allocated Hours *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      required
                      value={pkgProcedureForm.hours}
                      onChange={(e) => setPkgProcedureForm({ ...pkgProcedureForm, hours: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Step Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={pkgProcedureForm.title}
                    onChange={(e) => setPkgProcedureForm({ ...pkgProcedureForm, title: e.target.value })}
                    placeholder="e.g. Engine Room Simulator Operational Drills"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Detailed Procedural Description
                  </label>
                  <textarea
                    rows={3}
                    value={pkgProcedureForm.description}
                    onChange={(e) => setPkgProcedureForm({ ...pkgProcedureForm, description: e.target.value })}
                    placeholder="Describe what the trainee must undergo during this phase..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="pkgStepMandatory"
                    checked={pkgProcedureForm.mandatory}
                    onChange={(e) => setPkgProcedureForm({ ...pkgProcedureForm, mandatory: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <label htmlFor="pkgStepMandatory" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    Mandatory step (trainee cannot complete package without passing this phase)
                  </label>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isCurriculumSaving}
                    onClick={() => setPkgProcedureModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCurriculumSaving || !pkgProcedureForm.title.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isCurriculumSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Step</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* C. Add / Edit Package Assessment Modal */}
      <AnimatePresence>
        {pkgAssessmentModalOpen && viewPackage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isCurriculumSaving && setPkgAssessmentModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-20 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                      {editingPkgAssessmentIdx !== null ? 'Edit Assessment' : 'Add Package Assessment'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Competency check for {viewPackage.package_code}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !isCurriculumSaving && setPkgAssessmentModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSavePkgAssessment} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assessment Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={pkgAssessmentForm.title}
                    onChange={(e) => setPkgAssessmentForm({ ...pkgAssessmentForm, title: e.target.value })}
                    placeholder="e.g. Combined Radar & ECDIS Navigation Exam"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Assessment Type
                    </label>
                    <select
                      value={pkgAssessmentForm.assessmentType}
                      onChange={(e) => setPkgAssessmentForm({ ...pkgAssessmentForm, assessmentType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="WRITTEN">Written Exam (Theoretical)</option>
                      <option value="PRACTICAL">Practical Demonstration</option>
                      <option value="SIMULATOR">Simulator Performance Check</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Associated Course
                    </label>
                    <select
                      value={pkgAssessmentForm.courseCode}
                      onChange={(e) => setPkgAssessmentForm({ ...pkgAssessmentForm, courseCode: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="PACKAGE">Package Comprehensive</option>
                      {viewPackage.items?.map((it: any) => (
                        <option key={it.courses?.id || it.id} value={it.courses?.code || 'COURSE'}>
                          {it.courses?.code} - {it.courses?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Passing Score (%) *
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={100}
                      required
                      value={pkgAssessmentForm.passingScore}
                      onChange={(e) => setPkgAssessmentForm({ ...pkgAssessmentForm, passingScore: parseInt(e.target.value, 10) || 75 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Duration (Minutes) *
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={360}
                      required
                      value={pkgAssessmentForm.durationMinutes}
                      onChange={(e) => setPkgAssessmentForm({ ...pkgAssessmentForm, durationMinutes: parseInt(e.target.value, 10) || 60 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isCurriculumSaving}
                    onClick={() => setPkgAssessmentModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCurriculumSaving || !pkgAssessmentForm.title.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isCurriculumSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Assessment</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* D. View STCW Syllabus Outline Modal */}
      <AnimatePresence>
        {viewingSyllabusOutline && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setViewingSyllabusOutline(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-20 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-sky-600 text-white">
                        {viewingSyllabusOutline.sourceCourseCode}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                        STCW Course Syllabus Outline
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {viewingSyllabusOutline.sourceCourseTitle || 'Course Curriculum Specification'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingSyllabusOutline(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap font-sans">
                {viewingSyllabusOutline.description || 'No syllabus outline text specified.'}
              </div>

              <div className="flex items-center justify-between pt-2">
                {viewingSyllabusOutline.sourceCourseId ? (
                  <Link
                    href={`/admin/courses/${viewingSyllabusOutline.sourceCourseId}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline"
                  >
                    <span>Open in Course Editor</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                ) : <div />}
                <button
                  onClick={() => setViewingSyllabusOutline(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Create Course Modal */}
      <AnimatePresence>
        {createCourseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setCreateCourseModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* ================= ANIMATED UPLOADING & CREATION OVERLAY ================= */}
              <AnimatePresence>
                {isSubmittingCourse && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-white/95 dark:bg-[#0c1a2c] backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none"
                  >
                    {/* Animated Pulsing Waves & Floating Cloud */}
                    <div className="relative mb-6">
                      <motion.div
                        animate={{ scale: [1, 1.45, 1], opacity: [0.15, 0.5, 0.15] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -inset-4 rounded-full bg-purple-500/20 blur-xl"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.65, 0.25] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -inset-2 rounded-full border-2 border-purple-500/30"
                      />
                      <div className="w-24 h-24 rounded-full bg-sky-600 flex items-center justify-center text-white shadow-2xl shadow-purple-500/30 relative">
                        {uploadProgress === 100 ? (
                          <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', damping: 14 }}
                          >
                            <CheckCircle2 className="w-12 h-12 text-white" />
                          </motion.div>
                        ) : (
                          <motion.div
                            animate={{ y: [-4, 4, -4] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <CloudUpload className="w-11 h-11 text-white" />
                          </motion.div>
                        )}

                        {/* Floating upward particles */}
                        {uploadProgress < 100 && (
                          <>
                            <motion.div
                              animate={{ y: [4, -28], opacity: [0, 1, 0] }}
                              transition={{ duration: 1.1, repeat: Infinity, delay: 0.1 }}
                              className="absolute top-1 left-2 text-purple-200"
                            >
                              <ArrowUp className="w-4 h-4 stroke-[3]" />
                            </motion.div>
                            <motion.div
                              animate={{ y: [4, -30], opacity: [0, 1, 0] }}
                              transition={{ duration: 1.3, repeat: Infinity, delay: 0.5 }}
                              className="absolute top-2 right-2 text-indigo-200"
                            >
                              <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
                            </motion.div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress Phase Text */}
                    <div className="max-w-md space-y-1.5 px-4">
                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-heading">
                        {uploadProgress === 100 ? 'Course Registry Complete!' : 'Uploading & Publishing Course'}
                      </h3>
                      <motion.p
                        key={uploadPhaseText}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-purple-600 dark:text-purple-300 font-semibold"
                      >
                        {uploadPhaseText}
                      </motion.p>
                    </div>

                    {/* Animated Progress Meter */}
                    <div className="w-full max-w-sm mt-5 space-y-2 px-4">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-400 font-medium">
                          {courseForm.syllabusFiles.length > 0
                            ? `${courseForm.syllabusFiles.length} file${courseForm.syllabusFiles.length > 1 ? 's' : ''} (${formatFileSize(courseForm.syllabusFiles.reduce((acc, f) => acc + f.size, 0))})`
                            : 'Course Curriculum Assets'}
                        </span>
                        <span className="font-extrabold text-purple-600 dark:text-purple-400">
                          {uploadProgress}%
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
                        <motion.div
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ ease: 'easeOut', duration: 0.25 }}
                          className="h-full rounded-full bg-sky-500 relative overflow-hidden"
                        >
                          <motion.div
                            animate={{ x: ['-100%', '200%'] }}
                            transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12"
                          />
                        </motion.div>
                      </div>
                    </div>

                    {/* Step pills */}
                    <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-mono">
                      <span className={`px-2 py-0.5 rounded-full border transition-all ${
                        uploadProgress >= 25
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-transparent'
                      }`}>
                        1. Specs
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">→</span>
                      <span className={`px-2 py-0.5 rounded-full border transition-all ${
                        uploadProgress >= 65
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-transparent'
                      }`}>
                        2. Syllabus
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">→</span>
                      <span className={`px-2 py-0.5 rounded-full border transition-all ${
                        uploadProgress >= 85
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-transparent'
                      }`}>
                        3. Procedures
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">→</span>
                      <span className={`px-2 py-0.5 rounded-full border transition-all ${
                        uploadProgress >= 100
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-transparent'
                      }`}>
                        4. Assessment
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                      <Loader2 className={`w-3.5 h-3.5 ${uploadProgress === 100 ? 'hidden' : 'animate-spin text-purple-500'}`} />
                      <span>{uploadProgress === 100 ? 'Finalizing registry...' : 'Syncing assets with database & cloud...'}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-500" />
                    <span>Create New Maritime Course</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Specify STCW course profile, syllabus curriculum, training procedural roadmap, and final competency assessment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateCourseModal(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Wizard Step Tabs bar */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-2xl shrink-0 my-3">
                <button
                  type="button"
                  onClick={() => setCreateCourseTab('INFO')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    createCourseTab === 'INFO'
                      ? 'bg-white dark:bg-[#0c1a2c] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">1. Course Info</span>
                  {courseForm.code && courseForm.title && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 ml-auto" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setCreateCourseTab('SYLLABUS')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    createCourseTab === 'SYLLABUS'
                      ? 'bg-white dark:bg-[#0c1a2c] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="truncate">2. Syllabus</span>
                  {courseForm.syllabusFiles.length > 0 ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shrink-0 ml-auto">
                      {courseForm.syllabusFiles.length}
                    </span>
                  ) : courseForm.syllabusOutline.trim() ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 ml-auto" />
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setCreateCourseTab('PROCEDURES')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    createCourseTab === 'PROCEDURES'
                      ? 'bg-white dark:bg-[#0c1a2c] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">3. Procedures</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 ml-auto">
                    {courseForm.procedureSteps.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateCourseTab('ASSESSMENT')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    createCourseTab === 'ASSESSMENT'
                      ? 'bg-white dark:bg-[#0c1a2c] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">4. Assessment</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0 ml-auto">
                    {courseForm.assessmentPassingScore}%
                  </span>
                </button>
              </div>

              <form onSubmit={handleCreateCourse} className="flex-1 flex flex-col min-h-0">
                {/* Scrollable Form Body */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                  {/* ================= TAB 1: BASIC COURSE INFO ================= */}
                  {createCourseTab === 'INFO' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Course Code</label>
                          <input
                            required
                            type="text"
                            placeholder="e.g. BST-01"
                            value={courseForm.code}
                            onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Category</label>
                          <select
                            value={courseForm.category}
                            onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                          >
                            <option value="Safety and Other STCW Courses">Safety and Other STCW Courses (Modular + Practical)</option>
                            <option value="In-House Courses">In-House Courses (Full Modular-Based)</option>
                          </select>
                          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {String(courseForm.category || '').toLowerCase().includes('in-house')
                              ? 'Full Modular-Based: 100% modular lessons & written assessments (no practical simulator required).'
                              : 'Modular + Practical: Modular lessons first, followed by the course-specific practical assessment.'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Course Title</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. Basic Safety Training"
                          value={courseForm.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCourseForm((prev) => ({
                              ...prev,
                              title: val,
                              assessmentTitle:
                                !prev.assessmentTitle || prev.assessmentTitle.endsWith('Comprehensive Assessment')
                                  ? val ? `${val} Comprehensive Assessment` : ''
                                  : prev.assessmentTitle,
                            }));
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Description</label>
                        <textarea
                          required
                          placeholder="Provide curriculum overview, target maritime trainees, and competencies..."
                          value={courseForm.description}
                          onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none min-h-[80px] text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Duration (Hrs)</label>
                          <input
                            required
                            type="number"
                            min="1"
                            value={courseForm.durationHours}
                            onChange={(e) => setCourseForm({ ...courseForm, durationHours: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                          />
                          <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">
                            {Math.ceil(parseInt(courseForm.durationHours || '40') / 8)} Days
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Max Capacity</label>
                          <input
                            required
                            type="number"
                            min="1"
                            max="24"
                            value={courseForm.capacity}
                            onChange={(e) => setCourseForm({ ...courseForm, capacity: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                          />
                          <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">Max 24 per STCW</span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Fee (₱)</label>
                          <input
                            required
                            type="number"
                            min="0"
                            value={courseForm.fee}
                            onChange={(e) => setCourseForm({ ...courseForm, fee: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                          />
                          <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">PHP Currency</span>
                        </div>
                      </div>

                      {/* STCW Regulation Note */}
                      <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/30 flex items-start gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                          <span className="font-bold">STCW Maritime Regulation:</span> Courses enforce a maximum of 24 trainees per class batch and include integrated syllabus content, procedural pipeline, and competency assessments.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ================= TAB 2: SYLLABUS & DOCUMENTS ================= */}
                  {createCourseTab === 'SYLLABUS' && (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3">
                        <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            Course Syllabus Curriculum & Document Attachment
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            Define the modular syllabus outline, learning outcomes, and optionally attach the official syllabus file (PDF, PPT, DOCX).
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                            Syllabus Modules & Key Learning Objectives
                          </label>
                          <span className="text-[10px] font-mono text-slate-400">Curriculum Structure</span>
                        </div>
                        <textarea
                          rows={5}
                          placeholder="e.g.&#10;Module 1: Maritime Safety Guidelines & STCW Table A-VI/1-1&#10;Module 2: Survival Craft, Rescue Boats & Operational Protocols&#10;Module 3: Fire Prevention & Engine-Room Fire Fighting Drills&#10;Module 4: Elementary First Aid & Emergency Medical Response&#10;Module 5: Personal Safety and Social Responsibilities (PSSR)"
                          value={courseForm.syllabusOutline}
                          onChange={(e) => setCourseForm({ ...courseForm, syllabusOutline: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none text-xs font-sans leading-relaxed"
                        />
                        <span className="text-[10px] text-slate-400 block mt-1">
                          This outline will be indexed into the course curriculum and made available to enrolled trainees.
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-mono text-slate-500 uppercase font-semibold flex items-center gap-1.5">
                            <FileUp className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>Attach Syllabus Files (Drag & Drop or Ctrl+V)</span>
                          </label>
                          <span className="text-[10px] font-mono text-slate-400">
                            Max Combined: 50 MB
                          </span>
                        </div>

                        {/* Hidden Multi-file input */}
                        <input
                          ref={syllabusFileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.xls,.xlsx"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleAddSyllabusFiles(Array.from(e.target.files));
                              e.target.value = '';
                            }
                          }}
                        />

                        {/* Interactive Drag & Drop / Paste Holder */}
                        <motion.div
                          tabIndex={0}
                          animate={{
                            scale: isDraggingSyllabus ? 1.02 : 1,
                          }}
                          transition={{ duration: 0.2 }}
                          onPaste={handlePasteSyllabus}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingSyllabus(true);
                          }}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingSyllabus(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingSyllabus(false);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingSyllabus(false);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              handleAddSyllabusFiles(Array.from(e.dataTransfer.files));
                            }
                          }}
                          onClick={() => syllabusFileInputRef.current?.click()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              syllabusFileInputRef.current?.click();
                            }
                          }}
                          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 select-none outline-none focus:ring-2 focus:ring-purple-500/50 overflow-hidden ${
                            isDraggingSyllabus
                              ? 'border-purple-500 bg-purple-500/15 shadow-xl shadow-purple-500/15'
                              : 'border-slate-300 dark:border-slate-800 bg-slate-50/60 dark:bg-black/40 hover:border-purple-500/60 hover:bg-purple-500/5'
                          }`}
                        >
                          {/* Radiating drag-active aura */}
                          {isDraggingSyllabus && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0.15, 0.35, 0.15] }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                              className="absolute inset-0 bg-purple-500/20 blur-md pointer-events-none"
                            />
                          )}

                          <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                            <motion.div
                              animate={isDraggingSyllabus ? { y: [-6, 4, -6], scale: 1.15 } : { y: 0, scale: 1 }}
                              transition={{ duration: 0.9, repeat: isDraggingSyllabus ? Infinity : 0, ease: 'easeInOut' }}
                              className={`p-3 rounded-2xl transition-colors ${
                                isDraggingSyllabus
                                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              }`}
                            >
                              <CloudUpload className="w-6 h-6" />
                            </motion.div>
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {isDraggingSyllabus
                                  ? 'Release files to attach & verify'
                                  : 'Drag & drop files here, paste from clipboard (Ctrl+V), or click to browse'}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                Supports multiple PDF, PPT, PPTX, DOC, DOCX, TXT files • Max combined 50 MB
                              </p>
                              <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-purple-600 text-white text-[11px] font-semibold shadow-sm hover:bg-purple-700 transition-colors">
                                <Upload className="w-3.5 h-3.5" />
                                <span>Browse Files</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>

                        {/* Error Alert Banner */}
                        {syllabusUploadError && (
                          <div className="mt-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-start justify-between gap-2 text-xs">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <span>{syllabusUploadError}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSyllabusUploadError(null)}
                              className="text-rose-400 hover:text-rose-600 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* 50 MB Cumulative Capacity Meter */}
                        {(() => {
                          const totalBytes = courseForm.syllabusFiles.reduce((acc, f) => acc + f.size, 0);
                          const remainingBytes = Math.max(0, MAX_SYLLABUS_TOTAL_BYTES - totalBytes);
                          const percentUsed = Math.min(100, Math.round((totalBytes / MAX_SYLLABUS_TOTAL_BYTES) * 100));
                          const isNearLimit = percentUsed >= 70;
                          const isHighLimit = percentUsed >= 90;

                          return (
                            <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-slate-500">
                                  Storage Capacity ({courseForm.syllabusFiles.length} file{courseForm.syllabusFiles.length === 1 ? '' : 's'})
                                </span>
                                <span className={`font-bold ${
                                  isHighLimit
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : isNearLimit
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-purple-600 dark:text-purple-400'
                                }`}>
                                  {formatFileSize(totalBytes)} / 50.0 MB
                                  <span className="text-slate-400 font-normal ml-1">
                                    ({formatFileSize(remainingBytes)} remaining)
                                  </span>
                                </span>
                              </div>

                              <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                                <motion.div
                                  initial={{ width: '0%' }}
                                  animate={{ width: `${percentUsed}%` }}
                                  transition={{ duration: 0.45, ease: 'easeOut' }}
                                  className={`h-full rounded-full ${
                                    isHighLimit
                                      ? 'bg-rose-500'
                                      : isNearLimit
                                      ? 'bg-amber-500'
                                      : 'bg-sky-600'
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Staged Files List */}
                        {courseForm.syllabusFiles.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                Attached Documents ({courseForm.syllabusFiles.length})
                              </span>
                              <button
                                type="button"
                                onClick={clearAllSyllabusFiles}
                                className="text-[10px] text-rose-500 hover:underline font-bold"
                              >
                                Clear All
                              </button>
                            </div>

                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              <AnimatePresence>
                                {courseForm.syllabusFiles.map((file, idx) => {
                                  const extInfo = getFileExtInfo(file.name);
                                  return (
                                    <motion.div
                                      key={`${file.name}-${file.size}-${idx}`}
                                      layout
                                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, x: -20, scale: 0.95 }}
                                      transition={{ duration: 0.22, ease: 'easeOut' }}
                                      className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex flex-col gap-1.5 overflow-hidden"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${extInfo.color} shrink-0`}>
                                            {extInfo.label}
                                          </span>
                                          <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                              {file.name}
                                            </div>
                                            <div className="text-[10px] font-mono text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                                              <span>{formatFileSize(file.size)}</span>
                                              <span>•</span>
                                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span>Ready</span>
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => removeSyllabusFile(idx)}
                                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                                          title="Remove File"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>

                                      {/* Animated Staging Verification Shimmer Bar */}
                                      <div className="w-full bg-purple-500/20 rounded-full h-1 overflow-hidden">
                                        <motion.div
                                          initial={{ width: '0%' }}
                                          animate={{ width: '100%' }}
                                          transition={{ duration: 0.4, ease: 'easeOut' }}
                                          className="h-full bg-sky-500 rounded-full"
                                        />
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </AnimatePresence>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ================= TAB 3: PROCEDURES WORKFLOW ================= */}
                  {createCourseTab === 'PROCEDURES' && (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Compass className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              Procedural Roadmap: What Trainee Must Undergo
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                              Define sequential phases, simulator exercises, assessments, and mandatory requirements for course progression.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={resetToDefaultProcedures}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 shrink-0 transition-colors"
                        >
                          Reset Standard STCW
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">
                          Training Procedures Workflow Overview
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Trainees must undergo initial SRN and PEME credential verification, classroom lectures with syllabus review, full-mission simulator exercises, practical evaluation, and audit review."
                          value={courseForm.procedureOverview}
                          onChange={(e) => setCourseForm({ ...courseForm, procedureOverview: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none text-xs"
                        />
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                            Sequential Procedural Steps ({courseForm.procedureSteps.length})
                          </label>
                          <button
                            type="button"
                            onClick={addProcedureStep}
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Custom Step</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {courseForm.procedureSteps.map((step, idx) => (
                            <div
                              key={step.id}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-extrabold text-[10px] flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <select
                                  value={step.phase}
                                  onChange={(e) => updateProcedureStep(idx, { phase: e.target.value as any })}
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200 outline-none"
                                >
                                  <option value="PREREQUISITE">PREREQUISITE</option>
                                  <option value="THEORY">THEORY</option>
                                  <option value="SIMULATOR">SIMULATOR</option>
                                  <option value="ASSESSMENT">ASSESSMENT</option>
                                  <option value="CERTIFICATION">CERTIFICATION</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="Step title..."
                                  value={step.title}
                                  onChange={(e) => updateProcedureStep(idx, { title: e.target.value })}
                                  className="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none font-semibold"
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  <input
                                    type="number"
                                    min="1"
                                    value={step.hours}
                                    onChange={(e) => updateProcedureStep(idx, { hours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                    className="w-14 px-2 py-1 rounded-lg bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-[10px] font-mono text-center outline-none"
                                  />
                                  <span className="text-[10px] font-mono text-slate-400">hrs</span>
                                </div>
                                <label className="flex items-center gap-1 text-[10px] font-mono text-slate-500 cursor-pointer shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={step.mandatory}
                                    onChange={(e) => updateProcedureStep(idx, { mandatory: e.target.checked })}
                                    className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                                  />
                                  <span className="hidden sm:inline">Mandatory</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => removeProcedureStep(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                                  title="Remove Step"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <input
                                type="text"
                                placeholder="Step description / requirements for trainee..."
                                value={step.description}
                                onChange={(e) => updateProcedureStep(idx, { description: e.target.value })}
                                className="w-full px-2.5 py-1 rounded-lg bg-white dark:bg-black/40 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 outline-none"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-500">Cumulative Procedural Duration:</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {courseForm.procedureSteps.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0)} Hours / {courseForm.durationHours || 40} Course Hours
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ================= TAB 4: ASSESSMENT SETUP ================= */}
                  {createCourseTab === 'ASSESSMENT' && (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                        <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            Initial Course Competency Assessment
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            Configure the formal competency examination and passing standards. An assessment record will be automatically linked to this course.
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">
                          Assessment Title
                        </label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. BST-01 Final Comprehensive Assessment"
                          value={courseForm.assessmentTitle}
                          onChange={(e) => setCourseForm({ ...courseForm, assessmentTitle: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none text-xs font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Assessment Type</label>
                          <select
                            value={courseForm.assessmentType}
                            onChange={(e) => setCourseForm({ ...courseForm, assessmentType: e.target.value })}
                            className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                          >
                            <option value="WRITTEN">Written Examination</option>
                            <option value="PRACTICAL">Practical Demonstration</option>
                            <option value="SIMULATOR">Simulator Scenario</option>
                            <option value="ORAL">Oral Examination</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Passing Score (%)</label>
                          <input
                            required
                            type="number"
                            min="1"
                            max="100"
                            value={courseForm.assessmentPassingScore}
                            onChange={(e) => setCourseForm({ ...courseForm, assessmentPassingScore: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                          />
                          <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">STCW Benchmark: 75%</span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Duration (Mins)</label>
                          <input
                            required
                            type="number"
                            min="5"
                            max="360"
                            value={courseForm.assessmentDurationMinutes}
                            onChange={(e) => setCourseForm({ ...courseForm, assessmentDurationMinutes: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                          />
                          <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">Examination Time</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">
                          Assessment Guidelines & Instructions
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Provide instructions for trainees (e.g. Minimum 75% score required to pass. 1 attempt allowed. Questions cover safety procedures, navigation rules, and equipment protocols)."
                          value={courseForm.assessmentDescription}
                          onChange={(e) => setCourseForm({ ...courseForm, assessmentDescription: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none text-xs"
                        />
                      </div>

                      {/* Assessment Preview Card */}
                      <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4" />
                            <span>Assessment Preview</span>
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Auto-Published
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {courseForm.assessmentTitle || `${courseForm.title || 'Course'} Comprehensive Assessment`}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                          <span>Type: <strong className="text-slate-800 dark:text-slate-200">{courseForm.assessmentType}</strong></span>
                          <span>•</span>
                          <span>Passing Mark: <strong className="text-emerald-600">{courseForm.assessmentPassingScore}%</strong></span>
                          <span>•</span>
                          <span>Duration: <strong className="text-slate-800 dark:text-slate-200">{courseForm.assessmentDurationMinutes} mins</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer Controls */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCreateCourseModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2">
                    {createCourseTab !== 'INFO' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (createCourseTab === 'ASSESSMENT') setCreateCourseTab('PROCEDURES');
                          else if (createCourseTab === 'PROCEDURES') setCreateCourseTab('SYLLABUS');
                          else if (createCourseTab === 'SYLLABUS') setCreateCourseTab('INFO');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
                      >
                        ← Previous
                      </button>
                    )}

                    {createCourseTab !== 'ASSESSMENT' ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (createCourseTab === 'INFO') setCreateCourseTab('SYLLABUS');
                          else if (createCourseTab === 'SYLLABUS') setCreateCourseTab('PROCEDURES');
                          else if (createCourseTab === 'PROCEDURES') setCreateCourseTab('ASSESSMENT');
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <span>Next: {createCourseTab === 'INFO' ? 'Syllabus' : createCourseTab === 'SYLLABUS' ? 'Procedures' : 'Assessment'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isSubmittingCourse}
                      className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-all"
                    >
                      {isSubmittingCourse ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating Course...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Course</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Edit Course Modal */}
      <AnimatePresence>
        {editCourseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditCourseModal(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                  Edit Course
                </h3>
                <button onClick={() => setEditCourseModal(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditCourse} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Course Code</label>
                    <input
                      required
                      type="text"
                      value={courseForm.code}
                      onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Category</label>
                    <select
                      value={courseForm.category}
                      onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                    >
                      <option value="Safety and Other STCW Courses">Safety and Other STCW Courses (Modular + Practical)</option>
                      <option value="In-House Courses">In-House Courses (Full Modular-Based)</option>
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {String(courseForm.category || '').toLowerCase().includes('in-house')
                        ? 'Full Modular-Based: 100% modular lessons & written assessments (no practical simulator required).'
                        : 'Modular + Practical: Modular lessons first, followed by the course-specific practical assessment.'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Course Title</label>
                  <input
                    required
                    type="text"
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Description</label>
                  <textarea
                    required
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none min-h-[80px] text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Duration (Hrs)</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={courseForm.durationHours}
                      onChange={(e) => setCourseForm({ ...courseForm, durationHours: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                    />
                    <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">
                      {Math.ceil(parseInt(courseForm.durationHours || '40') / 8)} Days
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Max Capacity</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="24"
                      value={courseForm.capacity}
                      onChange={(e) => setCourseForm({ ...courseForm, capacity: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                    />
                    <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">Max 24 per STCW</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-semibold">Fee (₱)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={courseForm.fee}
                      onChange={(e) => setCourseForm({ ...courseForm, fee: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs"
                    />
                    <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">PHP Currency</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditCourseModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
