'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Layers,
  CheckCircle2,
  FileText,
  PlayCircle,
  Plus,
  X,
  Clock,
  Users,
  DollarSign,
  ShieldCheck,
  Ban,
  Trash2,
  Download,
  Upload,
  Presentation,
  FileUp,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Edit3,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Compass,
  GraduationCap,
  Save,
  Link2,
  Globe,
  ExternalLink,
  Loader2,
  HelpCircle,
  ListChecks,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface MaterialItem {
  id: string;
  courseId: string;
  title: string;
  description: string;
  materialType: 'SYLLABUS' | 'PRESENTATION' | 'DOCUMENT' | 'VIDEO';
  fileName: string;
  fileSize: number;
  fileUrl: string;
  externalUrl?: string;
  uploadedBy: string;
  createdAt: string;
}

interface ProcedureStep {
  id: string;
  stepNumber: number;
  phase: 'PREREQUISITE' | 'THEORY' | 'SIMULATOR' | 'ASSESSMENT' | 'CERTIFICATION';
  title: string;
  description: string;
  hours: number;
  mandatory: boolean;
}

interface AssessmentItem {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: string;
  moduleId?: string | null;
  moduleTitle?: string | null;
  moduleSortOrder?: number | null;
  passingScore: number;
  durationMinutes: number;
  totalPoints?: number;
  status: string;
  submissionsCount?: number;
  passedCount?: number;
  questionsCount?: number;
}

interface AssessmentChoiceItem {
  id?: string;
  choice_text: string;
  is_correct: boolean;
  sort_order?: number;
}

interface AssessmentQuestionItem {
  id: string;
  assessment_id: string;
  question_text: string;
  question_type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'IDENTIFICATION';
  points: number;
  sort_order: number;
  created_at?: string;
  assessment_choices: AssessmentChoiceItem[];
}

interface FileDropzoneProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  accept?: string;
  helperText?: string;
  accentColor?: 'emerald' | 'blue';
  placeholderTitle?: string;
}

function FileDropzone({
  file,
  onFileSelect,
  onClear,
  accept = '.pdf,.ppt,.pptx,.doc,.docx,.mp4',
  helperText = 'Supports PDF, PPT, PPTX, DOC, DOCX, MP4 (Max 50MB)',
  accentColor = 'emerald',
  placeholderTitle = 'Drag and drop file here, or browse',
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      onFileSelect(e.clipboardData.files[0]);
      return;
    }
    if (e.clipboardData.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.kind === 'file') {
          const pasted = item.getAsFile();
          if (pasted) {
            e.preventDefault();
            onFileSelect(pasted);
            return;
          }
        }
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getExtensionInfo = (filename: string) => {
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
    if (['MP4', 'MOV', 'WEBM'].includes(ext)) {
      return { label: ext, color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' };
    }
    return { label: ext, color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30' };
  };

  const isEmerald = accentColor === 'emerald';

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFileSelect(e.target.files[0]);
          }
        }}
      />

      {!file ? (
        <motion.div
          tabIndex={0}
          animate={{
            scale: isDragging ? 1.02 : 1,
          }}
          transition={{ duration: 0.2 }}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 select-none outline-none focus:ring-2 focus:ring-emerald-500/50 overflow-hidden ${
            isDragging
              ? isEmerald
                ? 'border-emerald-500 bg-emerald-500/15 shadow-lg shadow-emerald-500/10'
                : 'border-blue-500 bg-blue-500/15 shadow-lg shadow-blue-500/10'
              : 'border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 hover:bg-emerald-50/10'
          }`}
        >
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="absolute inset-0 bg-emerald-500/15 blur-md pointer-events-none"
            />
          )}

          <div className="relative z-10 flex flex-col items-center justify-center gap-2">
            <motion.div
              animate={isDragging ? { y: [-6, 4, -6], scale: 1.15 } : { y: 0, scale: 1 }}
              transition={{ duration: 0.9, repeat: isDragging ? Infinity : 0, ease: 'easeInOut' }}
              className={`p-3 rounded-2xl transition-colors ${
                isDragging
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : isEmerald
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}
            >
              <FileUp className="w-6 h-6" />
            </motion.div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isDragging ? 'Drop file to attach & verify' : placeholderTitle}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {helperText}
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-4 transition-all duration-200 overflow-hidden ${
            isDragging
              ? isEmerald
                ? 'border-emerald-500 bg-emerald-500/15'
                : 'border-blue-500 bg-blue-500/15'
              : 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase border ${
                  getExtensionInfo(file.name).color
                }`}
              >
                {getExtensionInfo(file.name).label}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {file.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>{formatSize(file.size)}</span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle className="w-3 h-3" /> Ready
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors"
              >
                Change
              </button>
              <button
                type="button"
                onClick={onClear}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Staging verification animation bar */}
          <div className="w-full bg-emerald-500/20 rounded-full h-1 overflow-hidden mt-3">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
            />
          </div>

          {isDragging && (
            <p className="text-[10px] text-center text-emerald-600 dark:text-emerald-400 font-bold mt-2">
              Drop to replace current file
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default function CourseDetailsClient({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Active Tab: 'SYLLABUS' | 'PROCEDURAL' | 'ASSESSMENTS' | 'MODULES'
  const [activeTab, setActiveTab] = useState<'SYLLABUS' | 'PROCEDURAL' | 'ASSESSMENTS' | 'MODULES'>('SYLLABUS');

  // Materials & Syllabus states
  interface ActiveUploadItem {
    id: string;
    fileName: string;
    fileSizeFormatted: string;
    materialType: 'SYLLABUS' | 'PRESENTATION' | 'DOCUMENT' | 'VIDEO';
    progress: number;
    status: 'uploading' | 'completed' | 'error';
    errorMessage?: string;
  }

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const syllabusFileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploads, setActiveUploads] = useState<ActiveUploadItem[]>([]);

  // Procedural Workflow states
  const [procedures, setProcedures] = useState<ProcedureStep[]>([]);
  const [procedureModalOpen, setProcedureModalOpen] = useState(false);
  const [editingProcedureId, setEditingProcedureId] = useState<string | null>(null);
  const [procedureForm, setProcedureForm] = useState({
    phase: 'THEORY' as ProcedureStep['phase'],
    title: '',
    description: '',
    hours: 8,
    mandatory: true,
  });
  const [isSavingProcedures, setIsSavingProcedures] = useState(false);

  // Assessments states
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [assessmentForm, setAssessmentForm] = useState({
    title: '',
    type: 'WRITTEN',
    moduleId: '',
    passingScore: 75,
    durationMinutes: 60,
    description: '',
  });
  const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);

  // Assessment Questions states
  const [questionsModalOpen, setQuestionsModalOpen] = useState(false);
  const [selectedAssessmentForQuestions, setSelectedAssessmentForQuestions] = useState<AssessmentItem | null>(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestionItem[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);

  // Question Form state
  const [questionForm, setQuestionForm] = useState<{
    questionText: string;
    questionType: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'IDENTIFICATION';
    points: number;
    choices: Array<{ text: string; isCorrect: boolean }>;
  }>({
    questionText: '',
    questionType: 'MULTIPLE_CHOICE',
    points: 1,
    choices: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
  });

  // Modules & Lessons states
  const [modules, setModules] = useState<any[]>([]);
  const [moduleModal, setModuleModal] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [lessonModal, setLessonModal] = useState<{ open: boolean; moduleId: string | null }>({ open: false, moduleId: null });
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    material_type: 'DOCUMENT',
    external_url: '',
    file: null as File | null,
  });
  const [isUploadingLesson, setIsUploadingLesson] = useState(false);
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [isDraggingTab, setIsDraggingTab] = useState(false);

  // Schedule Partition state (Theory Days vs Practical Days)
  const [isEditingPartition, setIsEditingPartition] = useState(false);
  const [customTheoryDays, setCustomTheoryDays] = useState<number>(2);
  const [customPracticalDays, setCustomPracticalDays] = useState<number>(3);
  const [isSavingPartition, setIsSavingPartition] = useState(false);
  const [partitionSaveSuccess, setPartitionSaveSuccess] = useState(false);

  const handleUploadFilesDirectly = async (files: File[]) => {
    if (!files || files.length === 0) return;

    const formatBytes = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // Prepare upload queue items for all selected files
    const newItems: ActiveUploadItem[] = files.map((file, idx) => {
      const name = file.name;
      const ext = name.split('.').pop()?.toLowerCase() || '';
      let detectedType: 'SYLLABUS' | 'PRESENTATION' | 'DOCUMENT' | 'VIDEO' = 'SYLLABUS';
      if (['ppt', 'pptx', 'key'].includes(ext)) {
        detectedType = 'PRESENTATION';
      } else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
        detectedType = 'VIDEO';
      } else if (['doc', 'docx', 'odt', 'txt', 'rtf'].includes(ext)) {
        detectedType = 'DOCUMENT';
      } else if (['pdf'].includes(ext)) {
        detectedType = 'SYLLABUS';
      }

      return {
        id: `upload_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        fileName: file.name,
        fileSizeFormatted: formatBytes(file.size),
        materialType: detectedType,
        progress: 10,
        status: 'uploading' as const,
      };
    });

    setActiveUploads((prev) => [...prev, ...newItems]);

    // Upload single file with progress tracking
    const uploadSingle = async (file: File, item: ActiveUploadItem) => {
      const name = file.name;
      const baseName = name.substring(0, name.lastIndexOf('.')) || name;
      const cleanTitle = baseName
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      try {
        const formData = new FormData();
        formData.append('title', cleanTitle || file.name);
        formData.append('description', `Automatically attached ${item.materialType.toLowerCase()} file`);
        formData.append('material_type', item.materialType);
        formData.append('file', file);

        const json = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/admin/courses/${courseId}/materials`);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.min(95, Math.round((event.loaded / event.total) * 100));
              setActiveUploads((prev) =>
                prev.map((u) => (u.id === item.id ? { ...u, progress: Math.max(15, percent) } : u))
              );
            }
          };

          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                setActiveUploads((prev) =>
                  prev.map((u) => (u.id === item.id ? { ...u, progress: 100, status: 'completed' } : u))
                );
                resolve(data);
              } else {
                const errMsg = data.error || `Upload failed (HTTP ${xhr.status})`;
                setActiveUploads((prev) =>
                  prev.map((u) => (u.id === item.id ? { ...u, status: 'error', errorMessage: errMsg } : u))
                );
                reject(new Error(errMsg));
              }
            } catch {
              const errMsg = `Failed to parse response (HTTP ${xhr.status})`;
              setActiveUploads((prev) =>
                prev.map((u) => (u.id === item.id ? { ...u, status: 'error', errorMessage: errMsg } : u))
              );
              reject(new Error(errMsg));
            }
          };

          xhr.onerror = () => {
            setActiveUploads((prev) =>
              prev.map((u) => (u.id === item.id ? { ...u, status: 'error', errorMessage: 'Network error' } : u))
            );
            reject(new Error('Network error during file upload'));
          };

          xhr.send(formData);
        });

        if (json?.material) {
          setMaterials((prev) => [json.material, ...prev]);
        }
      } catch (err: any) {
        console.error(`Error uploading ${file.name}:`, err);
      }
    };

    // Execute all uploads concurrently
    await Promise.all(files.map((file, idx) => uploadSingle(file, newItems[idx])));

    // Clear completed uploads after a short completion delay
    setTimeout(() => {
      setActiveUploads((prev) => prev.filter((u) => u.status === 'error'));
    }, 1500);

    if (syllabusFileInputRef.current) {
      syllabusFileInputRef.current.value = '';
    }
  };

  const handleUploadFileDirectly = (file: File) => handleUploadFilesDirectly([file]);

  const handleLessonStagedFile = (file: File) => {
    const name = file.name;
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const baseName = name.substring(0, name.lastIndexOf('.')) || name;
    const cleanTitle = baseName
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let detectedType = 'DOCUMENT';
    if (['ppt', 'pptx'].includes(ext)) detectedType = 'PRESENTATION';
    else if (['mp4', 'mov', 'webm'].includes(ext)) detectedType = 'VIDEO';

    setLessonForm((prev) => ({
      ...prev,
      file,
      title: prev.title.trim() ? prev.title : cleanTitle,
      material_type: detectedType,
    }));
  };

  // State & handler for pasting links directly in the placeholder
  const [pastedLink, setPastedLink] = useState('');
  const [pastedLinkTitle, setPastedLinkTitle] = useState('');
  const [isSavingLink, setIsSavingLink] = useState(false);

  const handleSavePastedLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const url = pastedLink.trim();
    if (!url) return;

    setIsSavingLink(true);
    try {
      let derivedTitle = pastedLinkTitle.trim();
      if (!derivedTitle) {
        try {
          const parsed = new URL(url);
          derivedTitle = `Resource (${parsed.hostname})`;
        } catch {
          derivedTitle = 'External Resource Link';
        }
      }

      const formData = new FormData();
      formData.append('title', derivedTitle);
      formData.append('description', 'External resource or cloud presentation link');
      formData.append('material_type', 'SYLLABUS');
      formData.append('external_url', url);

      const res = await fetch(`/api/admin/courses/${courseId}/materials`, {
        method: 'POST',
        body: formData,
      });
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        setMaterials((prev) => [json.material, ...prev]);
        setPastedLink('');
        setPastedLinkTitle('');
      } else {
        alert(json?.error || 'Failed to save resource link');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error saving external link');
    } finally {
      setIsSavingLink(false);
    }
  };

  const safeParseResponse = async (res: Response): Promise<{ ok: boolean; status: number; data: any }> => {
    try {
      const text = await res.text();
      const parsed = JSON.parse(text);
      return { ok: res.ok, status: res.status, data: parsed };
    } catch {
      return {
        ok: false,
        status: res.status,
        data: { success: false, error: `Server error (HTTP ${res.status})` }
      };
    }
  };

  const loadData = async () => {
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`);
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        setData(json);
        setMaterials(json.materials || []);
        setProcedures(json.procedures || []);
        setAssessments(json.assessments || []);
        setModules(json.modules || []);
      } else {
        setData({ error: true, details: json?.details || json?.error || `Failed to load course details (HTTP ${res.status})` });
      }
    } catch (err: any) {
      console.error(err);
      setData({ error: true, details: 'Network Error: ' + (err.message || err.toString()) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [courseId]);

  useEffect(() => {
    if (data?.course) {
      const c = data.course;
      const totalDays = Math.ceil((c.duration_hours || 40) / 8) || 1;
      const t = c.theory_days ?? c.theoryDays ?? (totalDays <= 1 ? 1 : Math.max(1, Math.round(totalDays * 0.4)));
      const p = c.practical_days ?? c.practicalDays ?? Math.max(0, totalDays - t);
      setCustomTheoryDays(t);
      setCustomPracticalDays(p);
    }
  }, [data?.course?.id, data?.course?.theory_days, data?.course?.practical_days, data?.course?.duration_hours]);

  const handleSaveSchedulePartition = async (tDays: number, pDays: number) => {
    setIsSavingPartition(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theoryDays: tDays, practicalDays: pDays }),
      });
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        setData((prev: any) => ({
          ...prev,
          course: {
            ...prev.course,
            theory_days: tDays,
            practical_days: pDays,
            theoryDays: tDays,
            practicalDays: pDays,
          },
        }));
        setPartitionSaveSuccess(true);
        setIsEditingPartition(false);
        setTimeout(() => setPartitionSaveSuccess(false), 3000);
      } else {
        alert(json?.error || 'Failed to update schedule partition');
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Error updating schedule partition');
    } finally {
      setIsSavingPartition(false);
    }
  };

  // Toggle Course Status (Disable/Enable)
  const handleToggleCourseStatus = async () => {
    if (!data?.course) return;
    const currentStatus = data.course.status || 'PUBLISHED';
    const isCurrentlyDisabled = ['SUSPENDED', 'DISABLED', 'INACTIVE'].includes(currentStatus.toUpperCase());
    const newStatus = isCurrentlyDisabled ? 'PUBLISHED' : 'SUSPENDED';

    const confirmMsg = isCurrentlyDisabled
      ? 'Enable this course? It will be marked as published and open for trainee registrations.'
      : 'Disable this course? It will be suspended and hidden from active trainee registrations.';

    if (!confirm(confirmMsg)) return;

    setIsUpdatingStatus(true);
    try {
      setData((prev: any) => ({
        ...prev,
        course: { ...prev.course, status: newStatus },
      }));
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        const finalStatus = json.course?.status || json.data?.status || newStatus;
        setData((prev: any) => ({
          ...prev,
          course: { ...prev.course, status: finalStatus },
        }));
      } else {
        setData((prev: any) => ({
          ...prev,
          course: { ...prev.course, status: currentStatus },
        }));
        alert(json?.error || 'Failed to update course status');
      }
    } catch (err: any) {
      console.error(err);
      setData((prev: any) => ({
        ...prev,
        course: { ...prev.course, status: currentStatus },
      }));
      alert(err?.message || 'Error updating course status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 1. MATERIAL / SYLLABUS / PPT HANDLERS
  const handleDeleteMaterial = async (materialId: string, title: string) => {
    if (!confirm(`Are you sure you want to remove "${title}"?`)) return;
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/materials/${materialId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMaterials((prev) => prev.filter((m) => m.id !== materialId));
      } else {
        alert('Failed to delete material');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting material');
    }
  };

  // 2. PROCEDURAL WORKFLOW HANDLERS
  const handleSaveProceduresToServer = async (stepsToSave: ProcedureStep[]) => {
    setIsSavingProcedures(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/procedures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: stepsToSave }),
      });
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        setProcedures(json.data);
      } else {
        alert(json?.error || 'Failed to save procedural steps');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving procedural roadmap');
    } finally {
      setIsSavingProcedures(false);
    }
  };

  const handleOpenAddProcedureModal = () => {
    setEditingProcedureId(null);
    setProcedureForm({
      phase: 'THEORY',
      title: '',
      description: '',
      hours: 8,
      mandatory: true,
    });
    setProcedureModalOpen(true);
  };

  const handleOpenEditProcedureModal = (step: ProcedureStep) => {
    setEditingProcedureId(step.id);
    setProcedureForm({
      phase: step.phase,
      title: step.title,
      description: step.description,
      hours: step.hours,
      mandatory: step.mandatory,
    });
    setProcedureModalOpen(true);
  };

  const handleSubmitProcedureForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procedureForm.title) return;

    let updated: ProcedureStep[];
    if (editingProcedureId) {
      updated = procedures.map((p) =>
        p.id === editingProcedureId
          ? {
              ...p,
              phase: procedureForm.phase,
              title: procedureForm.title.trim(),
              description: procedureForm.description.trim(),
              hours: Number(procedureForm.hours) || 1,
              mandatory: procedureForm.mandatory,
            }
          : p
      );
    } else {
      const newStep: ProcedureStep = {
        id: `step-${Date.now()}`,
        stepNumber: procedures.length + 1,
        phase: procedureForm.phase,
        title: procedureForm.title.trim(),
        description: procedureForm.description.trim(),
        hours: Number(procedureForm.hours) || 1,
        mandatory: procedureForm.mandatory,
      };
      updated = [...procedures, newStep];
    }

    setProcedures(updated);
    setProcedureModalOpen(false);
    await handleSaveProceduresToServer(updated);
  };

  const handleDeleteProcedure = async (stepId: string) => {
    if (!confirm('Remove this procedural step?')) return;
    const updated = procedures.filter((p) => p.id !== stepId).map((p, idx) => ({ ...p, stepNumber: idx + 1 }));
    setProcedures(updated);
    await handleSaveProceduresToServer(updated);
  };

  const handleMoveProcedure = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= procedures.length) return;
    const copy = [...procedures];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    const updated = copy.map((p, idx) => ({ ...p, stepNumber: idx + 1 }));
    setProcedures(updated);
    await handleSaveProceduresToServer(updated);
  };

  // 3. COURSE ASSESSMENTS HANDLERS
  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentForm.title) return;
    setIsCreatingAssessment(true);
    try {
      let res;
      if (editingAssessmentId) {
        res = await fetch(`/api/admin/courses/${courseId}/assessments/${editingAssessmentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assessmentForm),
        });
      } else {
        res = await fetch(`/api/admin/courses/${courseId}/assessments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assessmentForm),
        });
      }
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        if (editingAssessmentId) {
          setAssessments((prev) =>
            prev.map((a) => (a.id === editingAssessmentId ? { ...a, ...json.assessment } : a))
          );
          if (selectedAssessmentForQuestions?.id === editingAssessmentId) {
            setSelectedAssessmentForQuestions((prev) => (prev ? { ...prev, ...json.assessment } : null));
          }
          setAssessmentModalOpen(false);
          setEditingAssessmentId(null);
        } else {
          const createdAsm = { ...json.assessment, questionsCount: 0 };
          setAssessments((prev) => [createdAsm, ...prev]);
          setAssessmentModalOpen(false);
          // Immediately open Question Builder so admin can manually add questions!
          handleOpenQuestionsModal(createdAsm);
        }
        setAssessmentForm({
          title: '',
          type: 'WRITTEN',
          moduleId: '',
          passingScore: 75,
          durationMinutes: 60,
          description: '',
        });
      } else {
        alert(json?.error || 'Failed to save assessment');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error saving assessment');
    } finally {
      setIsCreatingAssessment(false);
    }
  };

  const handleDeleteAssessment = async (assessmentId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete assessment "${title}"?`)) return;
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/assessments/${assessmentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAssessments((prev) => prev.filter((a) => a.id !== assessmentId));
      } else {
        alert('Failed to delete assessment');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting assessment');
    }
  };

  // 3.1. ASSESSMENT QUESTIONS MANAGEMENT HANDLERS
  const handleOpenQuestionsModal = (asm: AssessmentItem) => {
    setSelectedAssessmentForQuestions(asm);
    setEditingQuestionId(null);
    setShowQuestionForm(false);
    resetQuestionForm('MULTIPLE_CHOICE');
    setQuestionsModalOpen(true);
    loadQuestions(asm.id);
  };

  const loadQuestions = async (assessmentId: string) => {
    setIsLoadingQuestions(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/assessments/${assessmentId}/questions`);
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        const loadedQuestions: AssessmentQuestionItem[] = json.questions || [];
        setAssessmentQuestions(loadedQuestions);
        setAssessments((prev) =>
          prev.map((a) => (a.id === assessmentId ? { ...a, questionsCount: loadedQuestions.length } : a))
        );
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const resetQuestionForm = (type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'IDENTIFICATION' = 'MULTIPLE_CHOICE') => {
    setEditingQuestionId(null);
    if (type === 'MULTIPLE_CHOICE') {
      setQuestionForm({
        questionText: '',
        questionType: 'MULTIPLE_CHOICE',
        points: 1,
        choices: [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
        ],
      });
    } else if (type === 'TRUE_FALSE') {
      setQuestionForm({
        questionText: '',
        questionType: 'TRUE_FALSE',
        points: 1,
        choices: [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false },
        ],
      });
    } else {
      setQuestionForm({
        questionText: '',
        questionType: 'IDENTIFICATION',
        points: 1,
        choices: [{ text: '', isCorrect: true }],
      });
    }
  };

  const handleQuestionTypeChange = (newType: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'IDENTIFICATION') => {
    if (newType === 'MULTIPLE_CHOICE') {
      setQuestionForm((prev) => ({
        ...prev,
        questionType: newType,
        choices: [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
        ],
      }));
    } else if (newType === 'TRUE_FALSE') {
      setQuestionForm((prev) => ({
        ...prev,
        questionType: newType,
        choices: [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false },
        ],
      }));
    } else {
      setQuestionForm((prev) => ({
        ...prev,
        questionType: newType,
        choices: [{ text: '', isCorrect: true }],
      }));
    }
  };

  const handleChoiceTextChange = (idx: number, text: string) => {
    setQuestionForm((prev) => {
      const copy = [...prev.choices];
      copy[idx] = { ...copy[idx], text };
      return { ...prev, choices: copy };
    });
  };

  const handleChoiceCorrectChange = (idx: number) => {
    setQuestionForm((prev) => ({
      ...prev,
      choices: prev.choices.map((c, i) => ({ ...c, isCorrect: i === idx })),
    }));
  };

  const handleAddChoice = () => {
    if (questionForm.choices.length >= 8) return;
    setQuestionForm((prev) => ({
      ...prev,
      choices: [...prev.choices, { text: '', isCorrect: false }],
    }));
  };

  const handleRemoveChoice = (idx: number) => {
    if (questionForm.choices.length <= 2) return;
    setQuestionForm((prev) => {
      const filtered = prev.choices.filter((_, i) => i !== idx);
      if (!filtered.some((c) => c.isCorrect)) {
        filtered[0].isCorrect = true;
      }
      return { ...prev, choices: filtered };
    });
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssessmentForQuestions) return;
    if (!questionForm.questionText.trim()) {
      alert('Please enter the question prompt / text.');
      return;
    }

    if (questionForm.questionType === 'MULTIPLE_CHOICE') {
      const hasEmptyChoice = questionForm.choices.some((c) => !c.text.trim());
      if (hasEmptyChoice) {
        alert('Please fill in text for all options, or remove extra ones.');
        return;
      }
      const hasCorrect = questionForm.choices.some((c) => c.isCorrect);
      if (!hasCorrect) {
        alert('Please select which option is the correct answer.');
        return;
      }
    } else if (questionForm.questionType === 'IDENTIFICATION') {
      if (!questionForm.choices[0]?.text.trim()) {
        alert('Please specify the expected correct answer / keyword.');
        return;
      }
    }

    setIsSavingQuestion(true);
    try {
      const payload = {
        questionText: questionForm.questionText.trim(),
        questionType: questionForm.questionType,
        points: Number(questionForm.points) || 1,
        choices: questionForm.choices.map((c, i) => ({
          choice_text: c.text.trim(),
          is_correct: c.isCorrect,
          sort_order: i + 1,
        })),
      };

      const url = editingQuestionId
        ? `/api/admin/courses/${courseId}/assessments/${selectedAssessmentForQuestions.id}/questions/${editingQuestionId}`
        : `/api/admin/courses/${courseId}/assessments/${selectedAssessmentForQuestions.id}/questions`;

      const res = await fetch(url, {
        method: editingQuestionId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success && json.question) {
        if (editingQuestionId) {
          setAssessmentQuestions((prev) =>
            prev.map((q) => (q.id === editingQuestionId ? json.question : q))
          );
        } else {
          setAssessmentQuestions((prev) => [...prev, json.question]);
          setAssessments((prev) =>
            prev.map((a) =>
              a.id === selectedAssessmentForQuestions.id
                ? { ...a, questionsCount: (a.questionsCount || 0) + 1 }
                : a
            )
          );
        }

        // Reset form for next question
        resetQuestionForm(questionForm.questionType);
        if (editingQuestionId) {
          setShowQuestionForm(false);
        }
      } else {
        alert(json?.error || 'Failed to save question');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error saving question: ' + (err.message || err.toString()));
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleEditQuestion = (q: AssessmentQuestionItem) => {
    setEditingQuestionId(q.id);
    const mappedChoices = (q.assessment_choices || []).map((c) => ({
      text: c.choice_text || '',
      isCorrect: Boolean(c.is_correct),
    }));

    setQuestionForm({
      questionText: q.question_text || '',
      questionType: q.question_type || 'MULTIPLE_CHOICE',
      points: Number(q.points) || 1,
      choices: mappedChoices.length > 0 ? mappedChoices : [{ text: '', isCorrect: true }, { text: '', isCorrect: false }],
    });
    setShowQuestionForm(true);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!selectedAssessmentForQuestions) return;
    if (!confirm('Are you sure you want to delete this question?')) return;

    setDeletingQuestionId(questionId);
    try {
      const res = await fetch(
        `/api/admin/courses/${courseId}/assessments/${selectedAssessmentForQuestions.id}/questions/${questionId}`,
        { method: 'DELETE' }
      );
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        setAssessmentQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setAssessments((prev) =>
          prev.map((a) =>
            a.id === selectedAssessmentForQuestions.id
              ? { ...a, questionsCount: Math.max(0, (a.questionsCount || 1) - 1) }
              : a
          )
        );
        if (editingQuestionId === questionId) {
          resetQuestionForm();
          setShowQuestionForm(false);
        }
      } else {
        alert(json?.error || 'Failed to delete question');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error deleting question');
    } finally {
      setDeletingQuestionId(null);
    }
  };

  // 4. MODULES & LESSONS HANDLERS
  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let res;
      if (editingModuleId) {
        res = await fetch(`/api/admin/courses/${courseId}/modules/${editingModuleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(moduleForm),
        });
      } else {
        res = await fetch(`/api/admin/courses/${courseId}/modules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(moduleForm),
        });
      }
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        setModuleModal(false);
        setEditingModuleId(null);
        setModuleForm({ title: '', description: '' });
        loadData();
      } else {
        alert(json?.error || 'Failed to save module');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonModal.moduleId) return;
    setIsUploadingLesson(true);
    try {
      const formData = new FormData();
      formData.append('title', lessonForm.title);
      formData.append('description', lessonForm.description);
      formData.append('material_type', lessonForm.material_type);
      formData.append('external_url', lessonForm.external_url);
      if (lessonForm.file) {
        formData.append('file', lessonForm.file);
      }

      const res = await fetch(`/api/admin/courses/${courseId}/modules/${lessonModal.moduleId}/lessons`, {
        method: 'POST',
        body: formData,
      });
      const { ok, data: json } = await safeParseResponse(res);

      if (ok) {
        setLessonModal({ open: false, moduleId: null });
        setLessonForm({ title: '', description: '', material_type: 'DOCUMENT', external_url: '', file: null });
        loadData();
      } else {
        alert(json?.error || 'Failed to upload lesson');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during upload.');
    } finally {
      setIsUploadingLesson(false);
    }
  };

  const handleDeleteModule = async (moduleId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete module "${title}" and all its lessons?`)) return;

    setDeletingModuleId(moduleId);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/modules/${moduleId}`, {
        method: 'DELETE',
      });
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        setModules((prev) => prev.filter((m: any) => m.id !== moduleId));
      } else {
        alert(json?.error || 'Failed to delete module');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error deleting module: ' + (err.message || err.toString()));
    } finally {
      setDeletingModuleId(null);
    }
  };

  const handleDeleteLesson = async (moduleId: string, lessonId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete lesson "${title}"?`)) return;

    setDeletingLessonId(lessonId);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/modules/${moduleId}/lessons?lessonId=${lessonId}`, {
        method: 'DELETE',
      });
      const { ok, data: json } = await safeParseResponse(res);
      if (ok && json?.success) {
        setModules((prev) =>
          prev.map((mod: any) => {
            if (mod.id === moduleId) {
              return {
                ...mod,
                learning_materials: (mod.learning_materials || []).filter((l: any) => l.id !== lessonId),
              };
            }
            return mod;
          })
        );
      } else {
        alert(json?.error || 'Failed to delete lesson');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error deleting lesson: ' + (err.message || err.toString()));
    } finally {
      setDeletingLessonId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-full" />
          <div className="h-8 w-80 max-w-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-2/3 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-3 w-36 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className="h-14 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.course) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-rose-500/20 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Unable to Load Course Curriculum</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          {data?.details || 'Course record could not be retrieved from the server.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            Retry
          </button>
          <Link
            href="/admin/courses"
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors"
          >
            Back to Courses
          </Link>
        </div>
      </div>
    );
  }

  const { course } = data;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Header with Course Meta & Status Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/courses"
            className="p-2 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-emerald-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
              {course.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {course.code}
              </span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                ['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((course.status || '').toUpperCase())
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
              }`}>
                {['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((course.status || '').toUpperCase()) ? 'DISABLED' : 'PUBLISHED'}
              </span>
              <span className="text-xs text-slate-500 font-mono uppercase">{course.category || 'Safety and Other STCW Courses'}</span>
              {String(course.category || '').toLowerCase().includes('in-house') ? (
                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Full Modular-Based Course (100% Modular)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  Modular Lessons + Course Practical ({course.code})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Status Toggle */}
          <button
            type="button"
            onClick={handleToggleCourseStatus}
            disabled={isUpdatingStatus}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer ${
              ['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((course.status || '').toUpperCase())
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
            }`}
          >
            {isUpdatingStatus ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : ['SUSPENDED', 'DISABLED', 'INACTIVE'].includes((course.status || '').toUpperCase()) ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Enable Course</span>
              </>
            ) : (
              <>
                <Ban className="w-3.5 h-3.5" />
                <span>Disable Course</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Professional Course Overview Specs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono mb-1">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Duration</span>
          </div>
          <div className="font-extrabold text-sm text-slate-900 dark:text-white">
            {course.duration_hours ? `${Math.ceil(course.duration_hours / 8)} Days` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {course.duration_hours || 40} Training Hours
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono mb-1">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span>Class Capacity</span>
          </div>
          <div className="font-extrabold text-sm text-slate-900 dark:text-white">
            <span className={(course.enrolledCount ?? 0) >= (course.capacity ?? 24) ? 'text-rose-600' : 'text-blue-600'}>
              {course.enrolledCount ?? 0}
            </span>
            <span className="text-slate-400 font-normal"> / {course.capacity ?? 24}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {(course.capacity ?? 24) - (course.enrolledCount ?? 0)} seats left (Max 24)
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span>Tuition Rate</span>
          </div>
          <div className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
            ₱{Number(course.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">Standard Course Fee</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Status</span>
          </div>
          <div className={`font-bold font-mono text-xs ${
            course.status === 'SUSPENDED' ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {course.status || 'PUBLISHED'}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">Accredited STCW</div>
        </div>
      </div>

      {/* Course Schedule Partition & Training Roadmap */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-heading">
                  Course Schedule Partition &amp; Training Roadmap
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {Math.ceil((course.duration_hours || 40) / 8)} Days Total
                </span>
                {partitionSaveSuccess && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500 text-white animate-in fade-in">
                    Saved ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Allot specific days for self-paced module study (theory) vs instructor-led simulator sessions (practical).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditingPartition ? (
              <button
                type="button"
                onClick={() => setIsEditingPartition(true)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                <span>Configure Partition</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const total = Math.ceil((course.duration_hours || 40) / 8) || 1;
                    setCustomTheoryDays(course.theory_days ?? course.theoryDays ?? Math.max(1, Math.round(total * 0.4)));
                    setCustomPracticalDays(course.practical_days ?? course.practicalDays ?? Math.max(0, total - (course.theory_days ?? 1)));
                    setIsEditingPartition(false);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingPartition}
                  onClick={() => handleSaveSchedulePartition(customTheoryDays, customPracticalDays)}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingPartition ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Partition</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Partition Details & Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Theory Phase Card */}
          <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Phase 1: Theory &amp; Modules
              </span>
              <span className="text-xs font-mono font-extrabold text-blue-700 dark:text-blue-300">
                {Math.round((customTheoryDays / (Math.ceil((course.duration_hours || 40) / 8) || 1)) * 100)}% of Course
              </span>
            </div>

            {isEditingPartition ? (
              <div className="flex items-center gap-2 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Days to accomplish:</label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, (Math.ceil((course.duration_hours || 40) / 8) || 1) - (customPracticalDays > 0 ? 1 : 0))}
                  value={customTheoryDays}
                  onChange={(e) => {
                    const total = Math.ceil((course.duration_hours || 40) / 8) || 1;
                    const val = Math.max(1, Math.min(total, parseInt(e.target.value, 10) || 1));
                    setCustomTheoryDays(val);
                    setCustomPracticalDays(Math.max(0, total - val));
                  }}
                  className="w-16 px-2.5 py-1 rounded-lg border border-blue-300 dark:border-blue-500/30 bg-white dark:bg-slate-900/60 text-center font-mono font-bold text-xs"
                />
                <span className="text-xs text-slate-500 font-mono">Day(s)</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-blue-900 dark:text-blue-200 font-heading">
                  {course.theory_days ?? course.theoryDays ?? customTheoryDays}
                </span>
                <span className="text-xs font-mono text-slate-500">Day(s) Allotted</span>
              </div>
            )}
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Covers reading syllabus modules, interactive lessons, module pre-tests, and the comprehensive post-test.
            </p>
          </div>

          {/* Practical Phase Card */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Phase 2: Practical Sessions
              </span>
              <span className="text-xs font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                {Math.round((customPracticalDays / (Math.ceil((course.duration_hours || 40) / 8) || 1)) * 100)}% of Course
              </span>
            </div>

            {isEditingPartition ? (
              <div className="flex items-center gap-2 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Days for practical:</label>
                <input
                  type="number"
                  min={0}
                  max={Math.ceil((course.duration_hours || 40) / 8) || 1}
                  value={customPracticalDays}
                  onChange={(e) => {
                    const total = Math.ceil((course.duration_hours || 40) / 8) || 1;
                    const val = Math.max(0, Math.min(total, parseInt(e.target.value, 10) || 0));
                    setCustomPracticalDays(val);
                    setCustomTheoryDays(Math.max(1, total - val));
                  }}
                  className="w-16 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-slate-900/60 text-center font-mono font-bold text-xs"
                />
                <span className="text-xs text-slate-500 font-mono">Day(s)</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200 font-heading">
                  {course.practical_days ?? course.practicalDays ?? customPracticalDays}
                </span>
                <span className="text-xs font-mono text-slate-500">Day(s) Allotted</span>
              </div>
            )}
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Instructor-led simulator drills, hands-on scenarios, and attendance tracking in the physical training facility.
            </p>
          </div>

          {/* Presets and Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block mb-1">
                Quick Partition Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const total = Math.ceil((course.duration_hours || 40) / 8) || 1;
                    const t = Math.max(1, Math.round(total * 0.4));
                    setCustomTheoryDays(t);
                    setCustomPracticalDays(Math.max(0, total - t));
                    setIsEditingPartition(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-[10px] font-mono font-bold hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  40/60 Split
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const total = Math.ceil((course.duration_hours || 40) / 8) || 1;
                    const modCount = modules.length || 1;
                    const t = Math.max(1, Math.min(total > 1 ? total - 1 : 1, modCount));
                    setCustomTheoryDays(t);
                    setCustomPracticalDays(Math.max(0, total - t));
                    setIsEditingPartition(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-[10px] font-mono font-bold hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  Match Modules
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const total = Math.ceil((course.duration_hours || 40) / 8) || 1;
                    const t = Math.max(1, Math.floor(total / 2));
                    setCustomTheoryDays(t);
                    setCustomPracticalDays(Math.max(0, total - t));
                    setIsEditingPartition(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-[10px] font-mono font-bold hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  50/50 Split
                </button>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500">
              Partition: <strong>{customTheoryDays} Theory + {customPracticalDays} Practical = {customTheoryDays + customPracticalDays} Days</strong> ({course.duration_hours || 40} Hours)
            </div>
          </div>
        </div>

        {/* Visual Day-by-Day Partition Strip */}
        <div className="pt-2">
          <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
            Schedule Timeline Visualization (Trainee Completion Pathway)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Array.from({ length: Math.ceil((course.duration_hours || 40) / 8) || 1 }).map((_, dIdx) => {
              const dayNum = dIdx + 1;
              const isTheory = dayNum <= (course.theory_days ?? course.theoryDays ?? customTheoryDays);
              return (
                <div
                  key={dayNum}
                  className={`p-2.5 rounded-xl border text-center space-y-1 transition-all ${
                    isTheory
                      ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-500/30 text-blue-900 dark:text-blue-200'
                      : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                  }`}
                >
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider">
                    Day {dayNum}
                  </div>
                  <div className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase inline-block ${
                    isTheory ? 'bg-blue-200/60 dark:bg-blue-500/30 text-blue-800 dark:text-blue-300' : 'bg-emerald-200/60 dark:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  }`}>
                    {isTheory ? 'Theory Phase' : 'Practical Phase'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans line-clamp-1">
                    {isTheory
                      ? (dayNum === (course.theory_days ?? course.theoryDays ?? customTheoryDays) ? 'Post-Test & Clear' : `Module Study`)
                      : 'Simulator Session'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Curriculum Section Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('SYLLABUS')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'SYLLABUS'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Presentation className="w-4 h-4" />
          <span>Syllabus & Lecture PPTs</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            {materials.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PROCEDURAL')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'PROCEDURAL'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Procedural Workflow (Trainee Roadmap)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            {procedures.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ASSESSMENTS')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'ASSESSMENTS'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Course Assessments</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            {assessments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('MODULES')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'MODULES'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Curriculum Modules</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            {modules.length}
          </span>
        </button>
      </div>

      {/* ================= TAB 1: SYLLABUS & PRESENTATIONS (PPT / PDF) ================= */}
      {activeTab === 'SYLLABUS' && (
        <div className="space-y-4">
          {/* Hidden Native File Input for Direct File Explorer */}
          <input
            ref={syllabusFileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.mp4,.mov,.webm"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleUploadFileDirectly(e.target.files[0]);
              }
            }}
          />

          {/* Live Direct Upload Progress with Running Line and Percentage */}
          {activeUploads.length > 0 && activeUploads.map((upload) => (
            <div key={upload.id} className="p-4 rounded-2xl border-2 border-blue-500/40 bg-white dark:bg-[#0c1a2c] shadow-lg shadow-blue-500/10 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`p-3 rounded-xl shrink-0 ${
                      upload.materialType === 'PRESENTATION'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : upload.materialType === 'VIDEO'
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {upload.materialType === 'PRESENTATION' ? (
                      <Presentation className="w-5 h-5" />
                    ) : upload.materialType === 'VIDEO' ? (
                      <PlayCircle className="w-5 h-5" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          upload.materialType === 'PRESENTATION'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                            : upload.materialType === 'VIDEO'
                            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {upload.materialType === 'PRESENTATION'
                          ? 'Presentation Slides (PPT/PPTX)'
                          : upload.materialType === 'VIDEO'
                          ? 'Video Material'
                          : 'Course Syllabus (PDF/DOC)'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 truncate">
                        {upload.fileName} • {upload.fileSizeFormatted}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                      {upload.progress < 100
                        ? 'Uploading file data to server...'
                        : 'Finalizing & attaching to course syllabus...'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-mono font-extrabold px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    {upload.progress}%
                  </span>
                </div>
              </div>

              {/* Running Line Progress Track */}
              <div className="w-full bg-slate-100 dark:bg-slate-900/60 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-800 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-400 to-emerald-500 transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${Math.max(6, upload.progress)}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse" />
                </div>
              </div>
            </div>
          ))}

          {materials.length === 0 ? (
            <div className="p-8 md:p-12 text-center border-2 border-dashed rounded-3xl transition-all duration-200 select-none space-y-5 border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-[#0c1a2c]">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingTab(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingTab(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingTab(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingTab(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleUploadFileDirectly(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => syllabusFileInputRef.current?.click()}
                className={`p-6 rounded-2xl border border-dashed transition-all duration-200 cursor-pointer space-y-3 ${
                  isDraggingTab
                    ? 'border-emerald-500 bg-emerald-500/15 scale-[1.01] shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/20'
                    : 'border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 hover:border-emerald-500/60 hover:bg-emerald-50/10'
                }`}
              >
                <div
                  className={`p-3.5 rounded-2xl w-fit mx-auto transition-transform ${
                    isDraggingTab
                      ? 'bg-emerald-500 text-white scale-110 animate-bounce'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <FileUp className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {isDraggingTab
                      ? 'Drop File Here to Upload Immediately!'
                      : 'Drag & Drop Course Syllabus, PPT Decks, or Training Files Here'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Supports .pdf, .ppt, .pptx, .doc, .docx, and .mp4 (up to 50MB). Auto-detects material type on select.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      syllabusFileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Browse Files
                  </button>
                </div>
              </div>

              {/* Paste Link in Placeholder */}
              <div className="relative flex items-center justify-center my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative px-3 bg-white/50 dark:bg-[#0c1a2c] text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Or Paste External Link in Placeholder
                </div>
              </div>

              <form onSubmit={handleSavePastedLink} className="max-w-lg mx-auto w-full space-y-2 text-left">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="url"
                      placeholder="Paste cloud / LMS / web link (https://...)"
                      value={pastedLink}
                      onChange={(e) => setPastedLink(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Link Title (optional)"
                    value={pastedLinkTitle}
                    onChange={(e) => setPastedLinkTitle(e.target.value)}
                    className="sm:w-44 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!pastedLink.trim() || isSavingLink}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-md disabled:opacity-40 transition-all shrink-0 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSavingLink ? 'Adding...' : 'Add Link'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  Easily link Google Drive folders, OneDrive decks, online regulations, or YouTube/Vimeo maritime lectures.
                </p>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Quick Drop & Paste Link in Placeholder */}
              <div className="p-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white/40 dark:bg-[#0c1a2c] space-y-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingTab(true);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingTab(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingTab(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingTab(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleUploadFileDirectly(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => syllabusFileInputRef.current?.click()}
                  className={`p-3 rounded-xl border border-dashed transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                    isDraggingTab
                      ? 'border-emerald-500 bg-emerald-500/15 scale-[1.01] shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/60 hover:border-emerald-500/60 hover:bg-emerald-50/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl ${
                        isDraggingTab
                          ? 'bg-emerald-500 text-white animate-bounce'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <FileUp className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {isDraggingTab
                          ? 'Drop file to upload immediately'
                          : 'Drag & drop additional syllabus or presentation deck here'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Supports .pdf, .ppt, .pptx, .docx files up to 50MB (auto-categorized)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      syllabusFileInputRef.current?.click();
                    }}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-emerald-500/10 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Browse File
                  </button>
                </div>

                {/* Direct Paste Link Bar */}
                <form onSubmit={handleSavePastedLink} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="url"
                      placeholder="Paste resource / cloud link in placeholder (https://...)"
                      value={pastedLink}
                      onChange={(e) => setPastedLink(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Title (optional)"
                    value={pastedLinkTitle}
                    onChange={(e) => setPastedLinkTitle(e.target.value)}
                    className="sm:w-40 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!pastedLink.trim() || isSavingLink}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition-all shrink-0 inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSavingLink ? 'Adding...' : 'Add Link'}</span>
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {materials.map((mat) => (
                <div
                  key={mat.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3 hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-3 rounded-xl shrink-0 ${
                        mat.materialType === 'PRESENTATION'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : mat.materialType === 'SYLLABUS'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : mat.materialType === 'VIDEO'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {mat.materialType === 'PRESENTATION' ? (
                        <Presentation className="w-5 h-5" />
                      ) : mat.materialType === 'VIDEO' ? (
                        <PlayCircle className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            mat.materialType === 'PRESENTATION'
                              ? 'bg-amber-500/15 text-amber-600'
                              : mat.materialType === 'SYLLABUS'
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : 'bg-blue-500/15 text-blue-600'
                          }`}
                        >
                          {mat.materialType}
                        </span>
                        {mat.fileName && (
                          <span className="text-[10px] text-slate-400 font-mono truncate">
                            {mat.fileName}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                        {mat.title}
                      </h4>
                      {mat.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {mat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {mat.fileSize ? `${(mat.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'Attached'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {mat.fileUrl && (
                        <a
                          href={mat.fileUrl}
                          download={mat.fileName || true}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors"
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
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Open Link</span>
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteMaterial(mat.id, mat.title)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Delete material"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: PROCEDURAL WORKFLOW ("WHAT TRAINEE MUST UNDERGO") ================= */}
      {activeTab === 'PROCEDURAL' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/20">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-500" />
                Procedural Roadmap: What Trainee Must Undergo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Define the mandatory sequential training phases, simulator exercises, assessments, and qualification milestones trainees must complete.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenAddProcedureModal}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/25 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Step</span>
              </button>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="space-y-3">
            {procedures.map((step, idx) => (
              <div
                key={step.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs relative flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:border-blue-500/40 transition-colors"
              >
                <div className="flex items-start gap-3.5 flex-1">
                  {/* Step Number Circle */}
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {step.stepNumber}
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          step.phase === 'PREREQUISITE'
                            ? 'bg-purple-500/15 text-purple-600 border border-purple-500/30'
                            : step.phase === 'THEORY'
                            ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                            : step.phase === 'SIMULATOR'
                            ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                            : step.phase === 'ASSESSMENT'
                            ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                            : 'bg-teal-500/15 text-teal-600 border border-teal-500/30'
                        }`}
                      >
                        {step.phase}
                      </span>
                      {step.mandatory ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          Mandatory
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-white/5">
                          Elective
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {step.hours} Hours
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {step.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Step Action Controls */}
                <div className="flex items-center gap-1 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMoveProcedure(idx, 'UP')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    title="Move Step Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={idx === procedures.length - 1}
                    onClick={() => handleMoveProcedure(idx, 'DOWN')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    title="Move Step Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenEditProcedureModal(step)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                    title="Edit Step"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProcedure(step.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title="Delete Step"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: COURSE ASSESSMENTS ================= */}
      {activeTab === 'ASSESSMENTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-500" />
                Course Competency Assessments
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Set up formal written examinations, practical simulator demonstrations, and passing criteria for this course.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingAssessmentId(null);
                setAssessmentForm({
                  title: '',
                  type: 'WRITTEN',
                  moduleId: '',
                  passingScore: 75,
                  durationMinutes: 60,
                  description: '',
                });
                setAssessmentModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-md shadow-amber-500/25 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Assessment</span>
            </button>
          </div>

          {assessments.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-[#0c1a2c] space-y-3">
              <GraduationCap className="w-10 h-10 text-slate-400 mx-auto" />
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Assessments Created Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Create written examinations, practical simulator tests, or oral assessments to evaluate trainee competency.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingAssessmentId(null);
                  setAssessmentForm({
                    title: '',
                    type: 'WRITTEN',
                    moduleId: '',
                    passingScore: 75,
                    durationMinutes: 60,
                    description: '',
                  });
                  setAssessmentModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Course Assessment Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {assessments.map((asm) => (
                <div
                  key={asm.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3 hover:border-amber-500/40 transition-colors"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/15 text-amber-600 border border-amber-500/30">
                          {asm.type || 'WRITTEN'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                            asm.moduleId
                              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25'
                              : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                          }`}
                        >
                          {asm.moduleId ? `Module: ${asm.moduleTitle || 'Assigned Module'}` : 'Course Post-Test'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                        Passing: {asm.passingScore}%
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                      {asm.title}
                    </h4>
                    {asm.code && (
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        Code: {asm.code}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        <HelpCircle className="w-3 h-3 text-amber-500" />
                        {asm.questionsCount ?? 0} Questions
                      </span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {asm.durationMinutes} Minutes
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAssessmentId(asm.id);
                          setAssessmentForm({
                            title: asm.title,
                            type: asm.type || 'WRITTEN',
                            moduleId: asm.moduleId || '',
                            passingScore: asm.passingScore || 75,
                            durationMinutes: asm.durationMinutes || 60,
                            description: asm.description || '',
                          });
                          setAssessmentModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
                        title="Edit assessment"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenQuestionsModal(asm)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 text-amber-700 font-semibold text-[11px] transition-colors cursor-pointer border border-amber-500/20"
                        title="Manually create and manage questions"
                      >
                        <ListChecks className="w-3.5 h-3.5" />
                        <span>Questions ({asm.questionsCount ?? 0})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAssessment(asm.id, asm.title)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Delete assessment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: CURRICULUM MODULES & LESSONS ================= */}
      {activeTab === 'MODULES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-500" />
              Course Modules & Lessons
            </h2>
            <button
              onClick={() => {
                setEditingModuleId(null);
                setModuleForm({ title: '', description: '' });
                setModuleModal(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 text-emerald-700 font-semibold text-xs transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Module
            </button>
          </div>

          {modules.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-sm text-slate-500">
              No modules added yet. Start building your curriculum!
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((mod: any, idx: number) => (
                <div
                  key={mod.id}
                  className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">
                        Module {idx + 1}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {mod.title}
                      </h3>
                      {mod.description && (
                        <p className="text-sm text-slate-500 mt-1">{mod.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingModuleId(mod.id);
                          setModuleForm({ title: mod.title, description: mod.description || '' });
                          setModuleModal(true);
                        }}
                        className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                        title="Edit module"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLessonModal({ open: true, moduleId: mod.id })}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Lesson</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteModule(mod.id, mod.title)}
                        disabled={deletingModuleId === mod.id}
                        title="Delete module"
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 px-2.5 py-1.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {deletingModuleId === mod.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 pl-4 border-l-2 border-slate-100 dark:border-slate-800">
                    {mod.learning_materials && mod.learning_materials.length > 0 ? (
                      mod.learning_materials
                        .sort((a: any, b: any) => a.sort_order - b.sort_order)
                        .map((lesson: any) => (
                          <div
                            key={lesson.id}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {lesson.material_type === 'VIDEO' ? (
                                <PlayCircle className="w-5 h-5 text-indigo-500 shrink-0" />
                              ) : (
                                <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {lesson.title}
                                </div>
                                {lesson.external_url && (
                                  <a
                                    href={lesson.external_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-blue-500 hover:underline font-mono truncate max-w-[200px] block"
                                  >
                                    [Link] {lesson.external_url}
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                                {lesson.material_type}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(mod.id, lesson.id, lesson.title)}
                                disabled={deletingLessonId === lesson.id}
                                title="Delete Lesson"
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {deletingLessonId === lesson.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-xs text-slate-400 italic">No lessons in this module.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}



      {/* ================= MODAL: PROCEDURAL STEP ================= */}
      <AnimatePresence>
        {procedureModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setProcedureModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-blue-500" />
                  {editingProcedureId ? 'Edit Procedural Step' : 'Add Procedural Training Step'}
                </h3>
                <button onClick={() => setProcedureModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitProcedureForm} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-bold">
                    Procedural Phase
                  </label>
                  <select
                    value={procedureForm.phase}
                    onChange={(e) =>
                      setProcedureForm({
                        ...procedureForm,
                        phase: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-semibold"
                  >
                    <option value="PREREQUISITE">Pre-Requisite & Verification</option>
                    <option value="THEORY">Classroom Theory & Syllabus Orientation</option>
                    <option value="SIMULATOR">Simulator Exercises & Practical Drills</option>
                    <option value="ASSESSMENT">Formal Competency Assessment</option>
                    <option value="CERTIFICATION">Certification & Final Evaluation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-bold">
                    Step Title
                  </label>
                  <input
                    required
                    type="text"
                    value={procedureForm.title}
                    onChange={(e) => setProcedureForm({ ...procedureForm, title: e.target.value })}
                    placeholder="e.g. Bridge Simulator Emergency Maneuvers Drill..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-bold">
                    Detailed Procedural Instructions (What Trainee Must Undergo)
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={procedureForm.description}
                    onChange={(e) => setProcedureForm({ ...procedureForm, description: e.target.value })}
                    placeholder="Outline the specific tasks, procedures, or drills the trainee is required to execute..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-bold">
                      Estimated Duration (Hours)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={procedureForm.hours}
                      onChange={(e) => setProcedureForm({ ...procedureForm, hours: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="mandatory_check"
                      checked={procedureForm.mandatory}
                      onChange={(e) => setProcedureForm({ ...procedureForm, mandatory: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label htmlFor="mandatory_check" className="font-semibold text-slate-700 dark:text-slate-300">
                      Mandatory Step
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setProcedureModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProcedures}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md disabled:opacity-50"
                  >
                    {isSavingProcedures ? 'Saving...' : editingProcedureId ? 'Update Step' : 'Add Step to Roadmap'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: COURSE ASSESSMENT ================= */}
      <AnimatePresence>
        {assessmentModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setAssessmentModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-amber-500" />
                  {editingAssessmentId ? 'Edit Course Assessment' : 'Add Course Assessment'}
                </h3>
                <button onClick={() => setAssessmentModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAssessment} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-bold">
                    Assessment Title
                  </label>
                  <input
                    required
                    type="text"
                    value={assessmentForm.title}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, title: e.target.value })}
                    placeholder="e.g. Comprehensive Written Exam, Bridge Radar Simulation Drill..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-bold">
                    Assessment Type
                  </label>
                  <select
                    value={assessmentForm.type}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-semibold"
                  >
                    <option value="WRITTEN">Written Theoretical Examination</option>
                    <option value="PRACTICAL">Practical Hands-on Evaluation</option>
                    <option value="SIMULATOR">Simulator Scenario Assessment</option>
                    <option value="ORAL">Oral Examination / Interview</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-bold">
                    Curriculum Placement (Module or Course Post-Test)
                  </label>
                  <select
                    value={assessmentForm.moduleId}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, moduleId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-semibold"
                  >
                    <option value="">Course Post-Test (Unlocked after all modules)</option>
                    {modules.map((mod, idx) => (
                      <option key={mod.id} value={mod.id}>
                        Module {idx + 1}: {mod.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Assign to a specific module so it unlocks with that module&apos;s lesson, or leave as Course Post-Test.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-bold">
                      Passing Score (% Benchmark)
                    </label>
                    <input
                      required
                      type="number"
                      min={50}
                      max={100}
                      value={assessmentForm.passingScore}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, passingScore: parseInt(e.target.value, 10) || 75 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-bold">
                      Duration (Minutes)
                    </label>
                    <input
                      required
                      type="number"
                      min={10}
                      value={assessmentForm.durationMinutes}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, durationMinutes: parseInt(e.target.value, 10) || 60 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAssessmentModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingAssessment}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-md disabled:opacity-50"
                  >
                    {isCreatingAssessment ? 'Saving...' : editingAssessmentId ? 'Save Changes' : 'Create Assessment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: ADD MODULE ================= */}
      <AnimatePresence>
        {moduleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModuleModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingModuleId ? 'Edit Curriculum Module' : 'New Curriculum Module'}</h3>
                <button onClick={() => setModuleModal(false)} className="text-slate-400 hover:text-slate-900"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveModule} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1">Module Title</label>
                  <input required type="text" value={moduleForm.title} onChange={e => setModuleForm({...moduleForm, title: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 outline-none text-sm" placeholder="e.g. Module 1: Bridge Watchkeeping Standards" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1">Description</label>
                  <textarea value={moduleForm.description} onChange={e => setModuleForm({...moduleForm, description: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 outline-none text-sm" placeholder="Optional description" rows={3} />
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm">{editingModuleId ? 'Save Changes' : 'Create Module'}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: ADD LESSON ================= */}
      <AnimatePresence>
        {lessonModal.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setLessonModal({open: false, moduleId: null})} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Upload Module Lesson</h3>
                <button onClick={() => setLessonModal({open: false, moduleId: null})} className="text-slate-400 hover:text-slate-900"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleCreateLesson} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1">Lesson Title</label>
                  <input required type="text" value={lessonForm.title} onChange={e => setLessonForm({...lessonForm, title: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 outline-none text-sm" placeholder="e.g. Lesson 1.1: Rules of the Road..." />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1">Material Type</label>
                  <select value={lessonForm.material_type} onChange={e => setLessonForm({...lessonForm, material_type: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 outline-none text-sm">
                    <option value="DOCUMENT">Document (PDF/Doc)</option>
                    <option value="PRESENTATION">Presentation (PPT)</option>
                    <option value="VIDEO">Video</option>
                    <option value="LINK">External Link</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1 font-bold">
                    Lesson File (Drag & Drop or Click to Browse)
                  </label>
                  <FileDropzone
                    file={lessonForm.file}
                    onFileSelect={(selectedFile) => handleLessonStagedFile(selectedFile)}
                    onClear={() => setLessonForm({ ...lessonForm, file: null })}
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.mp4"
                    helperText="Supports PDF, PPT, DOC, MP4 (Max 50MB)"
                    accentColor="blue"
                    placeholderTitle="Drag and drop lesson file here"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1">External Link (Optional)</label>
                  <input type="text" value={lessonForm.external_url} onChange={e => setLessonForm({...lessonForm, external_url: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 outline-none text-sm font-mono" placeholder="https://..." />
                </div>
                <button
                  disabled={isUploadingLesson}
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                >
                  {isUploadingLesson ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Uploading Lesson File...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Save Lesson</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* ================= MODAL: ASSESSMENT QUESTIONS BUILDER ================= */}
      <AnimatePresence>
        {questionsModalOpen && selectedAssessmentForQuestions && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setQuestionsModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-10 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/15 text-amber-600 border border-amber-500/30">
                      {selectedAssessmentForQuestions.type}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                      Passing: {selectedAssessmentForQuestions.passingScore}%
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded">
                      {selectedAssessmentForQuestions.durationMinutes} mins
                    </span>
                    <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      {assessmentQuestions.length} Questions
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <span>{selectedAssessmentForQuestions.title} — Questions Bank</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manually create, edit, and organize exam questions and correct answer keys for this assessment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuestionsModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Action Bar / Toggle */}
                <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4 text-emerald-500" />
                    <span>Questions Configured ({assessmentQuestions.length})</span>
                  </div>
                  {!showQuestionForm && (
                    <button
                      type="button"
                      onClick={() => {
                        resetQuestionForm('MULTIPLE_CHOICE');
                        setShowQuestionForm(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Question Manually</span>
                    </button>
                  )}
                </div>

                {/* Question Creator Form */}
                {showQuestionForm && (
                  <form
                    onSubmit={handleSaveQuestion}
                    className="p-5 rounded-2xl bg-amber-500/5 border-2 border-amber-500/30 dark:border-amber-500/20 space-y-4 animate-in fade-in duration-200"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center">
                          {editingQuestionId ? '✎' : '+'}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {editingQuestionId ? 'Edit Question' : 'Create Question Manually'}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          resetQuestionForm();
                          setShowQuestionForm(false);
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Question Type & Points */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold">
                          Question Format
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                          {(
                            [
                              { key: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
                              { key: 'TRUE_FALSE', label: 'True / False' },
                              { key: 'IDENTIFICATION', label: 'Direct Answer' },
                            ] as const
                          ).map((t) => (
                            <button
                              key={t.key}
                              type="button"
                              onClick={() => handleQuestionTypeChange(t.key)}
                              className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                questionForm.questionType === t.key
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold">
                          Points Worth
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={questionForm.points}
                          onChange={(e) => setQuestionForm({ ...questionForm, points: parseInt(e.target.value, 10) || 1 })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Question Text */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold">
                        Question Prompt / Problem Description
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={questionForm.questionText}
                        onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                        placeholder="e.g. According to SOLAS regulations, what is the mandatory testing interval for emergency fire pumps?"
                        className="w-full p-3 text-xs rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Choices Builder */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold">
                          {questionForm.questionType === 'MULTIPLE_CHOICE'
                            ? 'Options & Correct Answer (Select radio to set the correct answer)'
                            : questionForm.questionType === 'TRUE_FALSE'
                            ? 'Select Correct Answer'
                            : 'Expected Correct Answer Key'}
                        </label>
                        {questionForm.questionType === 'MULTIPLE_CHOICE' && questionForm.choices.length < 8 && (
                          <button
                            type="button"
                            onClick={handleAddChoice}
                            className="text-[11px] font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Add Option
                          </button>
                        )}
                      </div>

                      {questionForm.questionType === 'IDENTIFICATION' ? (
                        <input
                          type="text"
                          required
                          value={questionForm.choices[0]?.text || ''}
                          onChange={(e) => handleChoiceTextChange(0, e.target.value)}
                          placeholder="Type expected correct text / keyword (e.g. 'SOLAS' or 'Every 7 days')..."
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                        />
                      ) : (
                        <div className="space-y-2">
                          {questionForm.choices.map((choice, cIdx) => {
                            const optionLetter = String.fromCharCode(65 + cIdx);
                            return (
                              <div
                                key={cIdx}
                                className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-colors ${
                                  choice.isCorrect
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                                  <input
                                    type="radio"
                                    name="correct_choice_radio"
                                    checked={choice.isCorrect}
                                    onChange={() => handleChoiceCorrectChange(cIdx)}
                                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                  />
                                  <span className="font-mono font-bold text-xs w-5 text-center">
                                    {optionLetter}.
                                  </span>
                                </label>

                                {questionForm.questionType === 'TRUE_FALSE' ? (
                                  <span className="font-semibold text-xs flex-1">{choice.text}</span>
                                ) : (
                                  <input
                                    type="text"
                                    required
                                    value={choice.text}
                                    onChange={(e) => handleChoiceTextChange(cIdx, e.target.value)}
                                    placeholder={`Option ${optionLetter} description...`}
                                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none"
                                  />
                                )}

                                {choice.isCorrect ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
                                    ✓ Correct
                                  </span>
                                ) : (
                                  questionForm.questionType === 'MULTIPLE_CHOICE' &&
                                  questionForm.choices.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveChoice(cIdx)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-500 shrink-0 cursor-pointer"
                                      title="Remove option"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Submit Bar */}
                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          resetQuestionForm();
                          setShowQuestionForm(false);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingQuestion}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isSavingQuestion ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>{isSavingQuestion ? 'Saving Question...' : editingQuestionId ? 'Update Question' : 'Save Question'}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Questions List */}
                {isLoadingQuestions ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    <span className="font-mono text-xs">Loading questions bank...</span>
                  </div>
                ) : assessmentQuestions.length === 0 ? (
                  <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <HelpCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      No Questions Created Yet
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                      This assessment does not have any questions yet. Click below to manually create your first exam question.
                    </p>
                    {!showQuestionForm && (
                      <button
                        type="button"
                        onClick={() => {
                          resetQuestionForm('MULTIPLE_CHOICE');
                          setShowQuestionForm(true);
                        }}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create First Question</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assessmentQuestions.map((q, qIdx) => (
                      <div
                        key={q.id}
                        className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3 hover:border-amber-500/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1">
                            <span className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/20">
                              Q{qIdx + 1}
                            </span>
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                                  {(q.question_type || 'MULTIPLE_CHOICE').replace(/_/g, ' ')}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                  {q.points} {q.points === 1 ? 'Point' : 'Points'}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                                {q.question_text}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditQuestion(q)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                              title="Edit question"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q.id)}
                              disabled={deletingQuestionId === q.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer disabled:opacity-50"
                              title="Delete question"
                            >
                              {deletingQuestionId === q.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Question Choices Preview */}
                        {q.assessment_choices && q.assessment_choices.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pl-9">
                            {q.assessment_choices.map((choice, chIdx) => {
                              const letter = String.fromCharCode(65 + chIdx);
                              return (
                                <div
                                  key={choice.id || chIdx}
                                  className={`p-2 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                                    choice.is_correct
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold'
                                      : 'bg-white dark:bg-[#0c1a2c] border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="font-mono font-bold text-[11px] shrink-0 text-slate-400">
                                      {letter}.
                                    </span>
                                    <span className="truncate">{choice.choice_text}</span>
                                  </div>
                                  {choice.is_correct && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Correct
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 shrink-0">
                <span className="text-xs text-slate-500 font-mono">
                  Total Questions: <strong>{assessmentQuestions.length}</strong> | Total Marks:{' '}
                  <strong>{assessmentQuestions.reduce((acc, curr) => acc + (Number(curr.points) || 1), 0)} pts</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setQuestionsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
