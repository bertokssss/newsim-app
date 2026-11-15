import { Suspense } from 'react';
import AssessmentsClient from './AssessmentsClient';

export const metadata = {
  title: 'Assessments & Practical Exams | NEWSIM Trainee Portal',
  description: 'Complete assigned STCW simulator practicals, quizzes, and written assessments.',
};

export default function AssessmentsPage() {
  // AssessmentsClient reads ?assessmentId / ?courseId via useSearchParams, which needs a Suspense boundary
  return (
    <Suspense fallback={<div className="py-16 text-center text-xs font-mono text-slate-400">Loading assessments...</div>}>
      <AssessmentsClient />
    </Suspense>
  );
}
