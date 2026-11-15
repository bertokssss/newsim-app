import path from 'path';
import {
  extractStorageObjectPath,
  readStorageJson,
  resolveMaterialAccessUrl,
  sanitizeMaterialUrl,
  supabaseAdmin,
  writeStorageJson,
} from '@newsim/database';

export interface CourseMaterialItem {
  id: string;
  courseId: string;
  sourceCourseId?: string;
  sourceCourseCode?: string;
  sourceCourseTitle?: string;
  title: string;
  description: string;
  materialType: 'SYLLABUS' | 'PRESENTATION' | 'DOCUMENT' | 'VIDEO';
  fileName: string;
  fileSize: number;
  fileUrl: string;
  externalUrl?: string;
  uploadedBy?: string;
  createdAt?: string;
  isSyllabusOutline?: boolean;
  isPackageLevel?: boolean;
}

export interface ProcedureStep {
  id: string;
  stepNumber: number;
  phase: 'PREREQUISITE' | 'THEORY' | 'SIMULATOR' | 'ASSESSMENT' | 'CERTIFICATION';
  title: string;
  description: string;
  hours: number;
  mandatory: boolean;
  sourceCourseCode?: string;
  sourceCourseTitle?: string;
}

export function getMaterialsStoragePath(courseId: string) {
  return `courses/${courseId}/materials.json`;
}

export function getProceduresStoragePath(courseId: string) {
  return `courses/${courseId}/procedures.json`;
}

export async function resolveMaterialUrlsForResponse<T extends { fileUrl?: string; externalUrl?: string }>(
  items: T[]
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      const rawUrl = item.fileUrl || item.externalUrl || '';
      const resolvedUrl = rawUrl ? await resolveMaterialAccessUrl(rawUrl) : '';
      return {
        ...item,
        fileUrl: resolvedUrl,
        ...(item.externalUrl
          ? { externalUrl: await resolveMaterialAccessUrl(item.externalUrl) }
          : {}),
      };
    })
  );
}

export async function resolveModuleLessonUrls(modules: any[]): Promise<any[]> {
  return Promise.all(
    (modules || []).map(async (mod) => {
      const materials = Array.isArray(mod.learning_materials) ? mod.learning_materials : [];
      const resolvedMaterials = await Promise.all(
        materials.map(async (lm: any) => {
          const rawUrl = lm.external_url || lm.file_url || '';
          const signedUrl = rawUrl ? await resolveMaterialAccessUrl(rawUrl) : '';
          return {
            ...lm,
            external_url: signedUrl || lm.external_url,
            file_url: signedUrl || lm.file_url,
          };
        })
      );
      return {
        ...mod,
        learning_materials: resolvedMaterials,
      };
    })
  );
}

export function getDefaultProcedures(): ProcedureStep[] {
  return [
    {
      id: 'step-1',
      stepNumber: 1,
      phase: 'PREREQUISITE',
      title: 'Enrollment & Pre-requisite Qualification Verification',
      description: 'Verification of Seafarer Registration Number (SRN), valid Pre-Employment Medical Examination (PEME), and prerequisite STCW certificates before class admission.',
      hours: 2,
      mandatory: true,
    },
    {
      id: 'step-2',
      stepNumber: 2,
      phase: 'THEORY',
      title: 'Classroom Theory, Syllabus Induction & Lecture Slides (PPT)',
      description: 'Undergo classroom instruction covering STCW modular theoretical standards, comprehensive syllabus review, and presentation slide deck modules.',
      hours: 16,
      mandatory: true,
    },
    {
      id: 'step-3',
      stepNumber: 3,
      phase: 'SIMULATOR',
      title: 'Simulator Practical Exercises & Scenario Drills',
      description: 'Hands-on bridge / engine-room simulation training, operational procedures, emergency scenario response, and maritime equipment watchkeeping drills.',
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
}

export async function readMaterials(courseId: string): Promise<CourseMaterialItem[]> {
  const materials: CourseMaterialItem[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  // 1. Read from canonical materials.json in private Supabase Storage
  try {
    const parsed = await readStorageJson<any[]>(getMaterialsStoragePath(courseId));
    if (Array.isArray(parsed)) {
      for (const m of parsed) {
        if (m && m.id && !seenIds.has(m.id)) {
          seenIds.add(m.id);
          if (m.fileUrl) seenUrls.add(m.fileUrl);
          materials.push({
            ...m,
            courseId: m.courseId || courseId,
            materialType: m.materialType || 'SYLLABUS',
          });
        }
      }
    }
  } catch {
    // materials.json doesn't exist yet
  }

  // 2. Query Supabase database (course_modules -> learning_materials)
  try {
    const { data: dbMods } = await supabaseAdmin
      .from('course_modules')
      .select('id, title, description, learning_materials(*)')
      .eq('course_id', courseId);

    if (dbMods && dbMods.length > 0) {
      for (const mod of dbMods) {
        const lms = (mod as any).learning_materials || [];
        for (const lm of lms) {
          const url = lm.external_url || lm.file_url || '';
          if (seenIds.has(lm.id) || (url && seenUrls.has(url))) continue;

          const safeUrl = url ? (extractStorageObjectPath(url) ? url : sanitizeMaterialUrl(url)) : '';
          const rawExt = safeUrl ? safeUrl.split('?')[0].split('.').pop()?.toUpperCase() : '';
          const matType = ['PPT', 'PPTX'].includes(rawExt || '')
            ? 'PRESENTATION'
            : ['MP4', 'MOV', 'WEBM'].includes(rawExt || '')
            ? 'VIDEO'
            : 'SYLLABUS';

          const item: CourseMaterialItem = {
            id: lm.id,
            courseId,
            title: lm.title || mod.title || 'Course Material',
            description: lm.description || mod.description || '',
            materialType: matType,
            fileName: safeUrl ? path.basename(safeUrl.split('?')[0]) : `${lm.title}.pdf`,
            fileSize: 0,
            fileUrl: safeUrl,
            externalUrl: safeUrl.startsWith('http') ? safeUrl : '',
            uploadedBy: 'Curriculum Department',
            createdAt: lm.created_at || new Date().toISOString(),
          };

          seenIds.add(lm.id);
          if (url) seenUrls.add(url);
          materials.push(item);
        }
      }
    }
  } catch (err) {
    console.warn(`Error reading DB materials for course ${courseId}:`, err);
  }

  return materials;
}

export async function writeMaterials(courseId: string, materials: any[]) {
  await writeStorageJson(getMaterialsStoragePath(courseId), materials);
}

export async function readProcedures(courseId: string): Promise<ProcedureStep[]> {
  try {
    const parsed = await readStorageJson<ProcedureStep[]>(getProceduresStoragePath(courseId));
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return getDefaultProcedures();
  } catch {
    return getDefaultProcedures();
  }
}

export async function writeProcedures(courseId: string, steps: ProcedureStep[]) {
  await writeStorageJson(getProceduresStoragePath(courseId), steps);
}

// ================= COURSE PACKAGE CURRICULUM HELPERS =================

export function getPackageMaterialsStoragePath(packageId: string) {
  return `packages/${packageId}/materials.json`;
}

export function getPackageProceduresStoragePath(packageId: string) {
  return `packages/${packageId}/procedures.json`;
}

export function getPackageAssessmentsStoragePath(packageId: string) {
  return `packages/${packageId}/assessments.json`;
}

export async function readPackageMaterials(packageId: string): Promise<any[]> {
  const parsed = await readStorageJson<any[]>(getPackageMaterialsStoragePath(packageId));
  return Array.isArray(parsed) ? parsed : [];
}

export async function writePackageMaterials(packageId: string, materials: any[]) {
  await writeStorageJson(getPackageMaterialsStoragePath(packageId), materials);
}

export async function readPackageProcedures(packageId: string): Promise<ProcedureStep[]> {
  const parsed = await readStorageJson<ProcedureStep[]>(getPackageProceduresStoragePath(packageId));
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
}

export async function writePackageProcedures(packageId: string, steps: ProcedureStep[]) {
  await writeStorageJson(getPackageProceduresStoragePath(packageId), steps);
}

export async function readPackageAssessments(packageId: string): Promise<any[]> {
  const parsed = await readStorageJson<any[]>(getPackageAssessmentsStoragePath(packageId));
  return Array.isArray(parsed) ? parsed : [];
}

export async function writePackageAssessments(packageId: string, assessments: any[]) {
  await writeStorageJson(getPackageAssessmentsStoragePath(packageId), assessments);
}

/**
 * Merges curriculum contents (materials, procedures, assessments) from multiple selected courses
 * into a single unified package curriculum.
 */
export async function mergeCourseCurricula(courseList: Array<{
  id: string;
  code?: string;
  title?: string;
  name?: string;
  description?: string;
  durationHours?: number;
  duration_hours?: number;
}>) {
  const mergedMaterials: CourseMaterialItem[] = [];
  const mergedProcedures: ProcedureStep[] = [];

  const allCodes = courseList.map(c => c.code || 'COURSE').join(', ');

  // Phase 1: Combined Prerequisite Verification
  mergedProcedures.push({
    id: `pkg-step-prereq`,
    stepNumber: 1,
    phase: 'PREREQUISITE',
    title: `Combined Enrollment & Pre-requisite Qualification Verification`,
    description: `Verification of Seafarer Registration Number (SRN), valid Pre-Employment Medical Examination (PEME), and prerequisite STCW certifications for bundled courses: ${allCodes}.`,
    hours: 2,
    mandatory: true,
    sourceCourseCode: 'PACKAGE',
    sourceCourseTitle: 'Package Prerequisite',
  });

  let stepCounter = 2;

  for (const course of courseList) {
    const cId = course.id;
    const cCode = course.code || 'COURSE';
    const cTitle = course.title || course.name || cCode;
    const cDesc = course.description || '';
    const totalHours = Number(course.durationHours || course.duration_hours || 40);
    const theoryHours = Math.max(4, Math.round(totalHours * 0.45));
    const simHours = Math.max(4, Math.round(totalHours * 0.45));

    // 1. Read & Merge Materials from this course (only real uploaded files)
    const courseMaterials = await readMaterials(cId);
    if (courseMaterials && courseMaterials.length > 0) {
      for (const mat of courseMaterials) {
        mergedMaterials.push({
          ...mat,
          id: `pkg_${mat.id || Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sourceCourseId: cId,
          sourceCourseCode: cCode,
          sourceCourseTitle: cTitle,
          isSyllabusOutline: false,
          isPackageLevel: false,
        });
      }
    }

    // 2. Read & Merge Procedures for this course
    const courseProcs = await readProcedures(cId);
    const procTheory = courseProcs.find(p => p.phase === 'THEORY');
    const procSim = courseProcs.find(p => p.phase === 'SIMULATOR');

    mergedProcedures.push({
      id: `pkg-step-theory-${cId}`,
      stepNumber: stepCounter++,
      phase: 'THEORY',
      title: `Classroom Theory & Core Competencies: ${cCode} - ${cTitle}`,
      description: procTheory?.description || `In-depth classroom instruction, technical lectures, and regulatory STCW standards for ${cTitle}.`,
      hours: procTheory?.hours || theoryHours,
      mandatory: true,
      sourceCourseCode: cCode,
      sourceCourseTitle: cTitle,
    });

    mergedProcedures.push({
      id: `pkg-step-sim-${cId}`,
      stepNumber: stepCounter++,
      phase: 'SIMULATOR',
      title: `Simulator Practical Exercises & Scenarios: ${cCode} - ${cTitle}`,
      description: procSim?.description || `Certified maritime simulator exercises, hands-on bridge/engine watchkeeping drills, and emergency scenarios for ${cTitle}.`,
      hours: procSim?.hours || simHours,
      mandatory: true,
      sourceCourseCode: cCode,
      sourceCourseTitle: cTitle,
    });
  }

  // Phase 4: Combined Assessment Phase
  mergedProcedures.push({
    id: `pkg-step-assessment`,
    stepNumber: stepCounter++,
    phase: 'ASSESSMENT',
    title: `Formal Competency Assessment & Multi-Course Examinations`,
    description: `Comprehensive theoretical examinations and practical simulator evaluations for all bundled courses (${allCodes}). Minimum passing mark >= 75% per course module.`,
    hours: Math.max(4, courseList.length * 2),
    mandatory: true,
    sourceCourseCode: 'PACKAGE',
    sourceCourseTitle: 'Package Assessment',
  });

  // Phase 5: Combined Certification Phase
  mergedProcedures.push({
    id: `pkg-step-certification`,
    stepNumber: stepCounter++,
    phase: 'CERTIFICATION',
    title: `Package Debriefing, Compliance Audit & Multi-Course Certificate Issuance`,
    description: `Instructor performance evaluation, MARINA compliance verification, and release of accredited STCW Certificates of Training Completion for each bundled course (${allCodes}).`,
    hours: 2,
    mandatory: true,
    sourceCourseCode: 'PACKAGE',
    sourceCourseTitle: 'Package Certification',
  });

  return {
    mergedMaterials,
    mergedProcedures,
    allCodes,
  };
}

/**
 * Dynamically resolves and aggregates live curriculum content (materials, procedures, assessments)
 * directly from all courses bundled inside a package, plus any package-level custom additions.
 * When an instructor or admin adds or updates curriculum in any course (e.g. AFF, BT, MARPOL),
 * this function automatically reflects the latest course data inside the package.
 */
export async function getLiveMergedPackageCurriculum(
  packageId: string,
  includedCourses: Array<{
    id: string;
    code?: string;
    name?: string;
    title?: string;
    description?: string;
    duration_hours?: number;
    durationHours?: number;
  }>
) {
  const allMaterials: CourseMaterialItem[] = [];
  const allProcedures: ProcedureStep[] = [];
  const allAssessments: any[] = [];

  const allCodes = includedCourses.map(c => c.code || 'COURSE').join(', ');

  // 1. Prerequisite Step
  let stepIndex = 1;
  allProcedures.push({
    id: `pkg-prereq-${packageId}`,
    stepNumber: stepIndex++,
    phase: 'PREREQUISITE',
    title: `Combined Enrollment & Pre-requisite Qualification Verification`,
    description: `Verification of Seafarer Registration Number (SRN), valid Pre-Employment Medical Examination (PEME), and prerequisite STCW certifications for bundled courses: ${allCodes}.`,
    hours: 2,
    mandatory: true,
    sourceCourseCode: 'PACKAGE',
    sourceCourseTitle: 'Package Prerequisite',
  });

  // 2. Load LIVE materials and procedures from each included course
  for (const course of includedCourses) {
    const cId = course.id;
    const cCode = course.code || 'COURSE';
    const cTitle = course.name || course.title || cCode;
    const cDesc = course.description || '';
    const totalHours = Number(course.duration_hours || course.durationHours || 40);

    // Read live course materials directly from this course (only real uploaded files)
    const courseMaterials = await readMaterials(cId);
    if (courseMaterials && courseMaterials.length > 0) {
      for (const mat of courseMaterials) {
        allMaterials.push({
          ...mat,
          id: mat.id || `mat_${cId}_${Math.random().toString(36).substring(2, 6)}`,
          sourceCourseId: cId,
          sourceCourseCode: cCode,
          sourceCourseTitle: cTitle,
          isSyllabusOutline: false,
          isPackageLevel: false,
        });
      }
    }

    // Read live course procedures with unique IDs to prevent React key collision
    const courseProcs = await readProcedures(cId);
    if (courseProcs && courseProcs.length > 0) {
      for (let pIdx = 0; pIdx < courseProcs.length; pIdx++) {
        const proc = courseProcs[pIdx];
        const rawId = proc.id || `step-${pIdx + 1}`;
        const uniqueId = `proc_${cCode}_${rawId}_${stepIndex}`;
        allProcedures.push({
          ...proc,
          id: uniqueId,
          stepNumber: stepIndex++,
          title: proc.title.startsWith(`[${cCode}]`) ? proc.title : `[${cCode}] ${proc.title}`,
          description: proc.description,
          sourceCourseCode: cCode,
          sourceCourseTitle: cTitle,
        });
      }
    } else {
      const theoryHours = Math.max(4, Math.round(totalHours * 0.45));
      const simHours = Math.max(4, Math.round(totalHours * 0.45));
      allProcedures.push({
        id: `step-theory-${cCode}-${cId}-${stepIndex}`,
        stepNumber: stepIndex++,
        phase: 'THEORY',
        title: `[${cCode}] Classroom Theory & Core Competencies: ${cTitle}`,
        description: `In-depth classroom instruction, technical lectures, and regulatory STCW standards for ${cTitle}.`,
        hours: theoryHours,
        mandatory: true,
        sourceCourseCode: cCode,
        sourceCourseTitle: cTitle,
      });
      allProcedures.push({
        id: `step-sim-${cCode}-${cId}-${stepIndex}`,
        stepNumber: stepIndex++,
        phase: 'SIMULATOR',
        title: `[${cCode}] Simulator Practical Exercises: ${cTitle}`,
        description: `Certified maritime simulator exercises, watchkeeping drills, and scenario response for ${cTitle}.`,
        hours: simHours,
        mandatory: true,
        sourceCourseCode: cCode,
        sourceCourseTitle: cTitle,
      });
    }

    // Assessment for this specific course with unique ID
    allAssessments.push({
      id: `assess_${cCode}_${cId}`,
      courseId: cId,
      courseCode: cCode,
      sourceCourseCode: cCode,
      courseTitle: cTitle,
      sourceCourseTitle: cTitle,
      title: `${cCode} Comprehensive Competency Exam`,
      assessmentType: 'WRITTEN',
      passingScore: 75,
      durationMinutes: 60,
    });
  }

  // 3. Combined Final Evaluation & Certification Steps
  allProcedures.push({
    id: `pkg-final-eval-${packageId}`,
    stepNumber: stepIndex++,
    phase: 'ASSESSMENT',
    title: `Formal Competency Assessment & Multi-Course Examinations`,
    description: `Comprehensive theoretical examinations and practical simulator evaluations for all bundled courses (${allCodes}). Minimum passing mark >= 75% per course module.`,
    hours: Math.max(4, includedCourses.length * 2),
    mandatory: true,
    sourceCourseCode: 'PACKAGE',
    sourceCourseTitle: 'Package Final Evaluation',
  });

  allProcedures.push({
    id: `pkg-final-cert-${packageId}`,
    stepNumber: stepIndex++,
    phase: 'CERTIFICATION',
    title: `Package Debriefing, Compliance Audit & Multi-Course Certificate Issuance`,
    description: `Instructor performance evaluation, MARINA compliance verification, and release of accredited STCW Certificates of Training Completion for each bundled course (${allCodes}).`,
    hours: 2,
    mandatory: true,
    sourceCourseCode: 'PACKAGE',
    sourceCourseTitle: 'Package Certification',
  });

  // 4. Also append custom package-level materials (only items uploaded specifically for this package)
  const customPackageMaterials = await readPackageMaterials(packageId);
  for (const cMat of customPackageMaterials) {
    const isBundledCourseCopy = includedCourses.some(
      c => c.id === cMat.sourceCourseId || (cMat.sourceCourseCode && cMat.sourceCourseCode !== 'PACKAGE' && c.code === cMat.sourceCourseCode)
    );
    if (!isBundledCourseCopy) {
      if (!allMaterials.some(m => m.id === cMat.id || (m.title === cMat.title && m.fileName === cMat.fileName))) {
        allMaterials.unshift({
          ...cMat,
          sourceCourseCode: 'PACKAGE',
          sourceCourseTitle: 'Package Level',
          isPackageLevel: true,
          isSyllabusOutline: false,
        });
      }
    }
  }

  const customPackageAssessments = await readPackageAssessments(packageId);
  for (const cAssess of customPackageAssessments) {
    if (!allAssessments.some(a => a.id === cAssess.id)) {
      allAssessments.push({
        ...cAssess,
        courseCode: cAssess.courseCode || 'PACKAGE',
        courseTitle: cAssess.courseTitle || 'Package Level',
      });
    }
  }

  return {
    materials: allMaterials,
    procedures: allProcedures,
    assessments: allAssessments,
    courses: includedCourses,
  };
}
