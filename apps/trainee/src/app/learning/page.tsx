import React, { Suspense } from 'react';
import LearningClient from './LearningClient';

export const metadata = {
  title: 'Learning Player | NEWSIM Trainee Portal',
  description: 'Interactive maritime learning player, STCW modules, and curriculum lessons.',
};

export default function LearningPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-slate-400">Loading learning workspace...</div>}>
      <LearningClient />
    </Suspense>
  );
}
