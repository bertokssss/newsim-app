import React, { Suspense } from 'react';
import { Metadata } from 'next';
import ReportsClient from './ReportsClient';

export const metadata: Metadata = {
  title: 'System Reports & Audit Export | NEWSIM Super Admin',
  description: 'Enterprise report generation, compliance summaries, and verified dataset exports.',
};

export default function SuperAdminReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 rounded-full border-2 border-sky-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <ReportsClient />
    </Suspense>
  );
}
