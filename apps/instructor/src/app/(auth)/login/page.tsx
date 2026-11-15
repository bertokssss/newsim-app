import React, { Suspense } from 'react';
import { Metadata } from 'next';
import InstructorLoginClient from './InstructorLoginClient';

export const metadata: Metadata = {
  title: 'Instructor Portal | NEWSIM',
  description: 'Secure access point for NEWSIM instructors.',
};

export default function InstructorLoginPage() {
  return (
    <main className="min-h-screen bg-[#E8F6FF]">
      <Suspense fallback={null}>
        <InstructorLoginClient />
      </Suspense>
    </main>
  );
}
