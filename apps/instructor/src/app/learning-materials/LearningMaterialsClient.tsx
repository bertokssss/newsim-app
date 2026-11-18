'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  Search,
  Plus,
  FileText,
  Video,
  Presentation,
  FileCode,
  Link2,
  Trash2,
  X,
  Download,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function LearningMaterialsClient() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('ALL');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    courseId: '',
    moduleName: '',
    title: '',
    description: '',
    fileType: 'PDF',
    fileSize: '5.2 MB',
  });

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/instructor/my-courses');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCourses(json.data);
          if (json.data.length > 0 && !formData.courseId) {
            setFormData((prev) => ({ ...prev, courseId: json.data[0].id }));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCourses();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (courseId !== 'ALL') query.set('courseId', courseId);

      const res = await fetch(`/api/instructor/learning-materials?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setMaterials(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [search, courseId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/instructor/learning-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setUploadModalOpen(false);
        setFormData({
          courseId: courses[0]?.id || '',
          moduleName: '',
          title: '',
          description: '',
          fileType: 'PDF',
          fileSize: '5.2 MB',
        });
        fetchMaterials();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to archive this learning material?')) return;
    try {
      await fetch(`/api/instructor/learning-materials/${id}`, { method: 'DELETE' });
      fetchMaterials();
    } catch (err) {
      console.error(err);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return FileText;
      case 'VIDEO':
        return Video;
      case 'PRESENTATION':
        return Presentation;
      case 'SIMULATOR_CONFIG':
        return FileCode;
      default:
        return FileText;
    }
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
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                Syllabus Repository
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
              Learning Materials & Simulator Scenarios
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#CBD5E1] max-w-xl leading-relaxed font-sans">
              Upload IMO training manuals, slide presentations, ECDIS radar route configurations, and simulation recordings for your cohorts.
            </p>
          </div>

          <button
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-md shadow-sky-500/20 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Material</span>
          </button>
        </div>
      </motion.div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search material title, module, course..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Courses' },
            ...courses.map((c: any) => ({ id: c.id, label: c.code || c.title || c.name })),
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setCourseId(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold uppercase whitespace-nowrap transition-all ${
                courseId === c.id
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-slate-400 font-mono text-xs">
            Loading learning materials repository...
          </div>
        ) : materials.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-slate-400 font-mono text-xs">
            No materials found.
          </div>
        ) : (
          materials.map((m, idx) => {
            const Icon = getFileIcon(m.fileType);

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, ease: easeCurve, delay: idx * 0.04 }}
                whileHover={{ y: -2 }}
                className="p-5 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-sky-500/20 transition-all flex flex-col justify-between relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      {m.courseCode}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#CBD5E1]">
                      {m.fileType}
                    </span>
                  </div>

                  <div className="flex items-start gap-3 mt-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading line-clamp-2">
                        {m.title}
                      </h3>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {m.moduleName}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-[#CBD5E1] mt-2 line-clamp-2">
                    {m.description || 'Standard training module handbook for seafarer certification.'}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">{m.fileSize}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Archive material"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] inline-flex items-center gap-1 shadow-sm"
                    >
                      <Download className="w-3 h-3" /> Get
                    </a>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Upload Material Modal */}
      <AnimatePresence>
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUploadModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-y-auto overscroll-contain bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl z-10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">Upload Teaching Material</h3>
                <button onClick={() => setUploadModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Course Assignment</label>
                    <select
                      value={formData.courseId}
                      onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                    >
                      {courses.length === 0 ? (
                        <option value="">No courses assigned</option>
                      ) : (
                        courses.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.code ? `${c.code}: ` : ''}{c.title || c.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">File Format</label>
                    <select
                      value={formData.fileType}
                      onChange={(e) => setFormData({ ...formData, fileType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                    >
                      <option value="PDF">PDF Manual</option>
                      <option value="PRESENTATION">Slide Deck (.pptx)</option>
                      <option value="VIDEO">Instructional Video (.mp4)</option>
                      <option value="SIMULATOR_CONFIG">Simulator Config (.xml)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Module / Topic Heading</label>
                  <input
                    type="text"
                    required
                    value={formData.moduleName}
                    onChange={(e) => setFormData({ ...formData, moduleName: e.target.value })}
                    placeholder="e.g. Module 2: Emergency Response & SCBA Drills"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Material Document Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. IMO Model Course 1.20 SCBA Operational Guide.pdf"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">Description & Training Objectives</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of training material..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[#CBD5E1] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-sky-600 text-white font-semibold shadow-md shadow-sky-500/20"
                  >
                    Upload Document
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

