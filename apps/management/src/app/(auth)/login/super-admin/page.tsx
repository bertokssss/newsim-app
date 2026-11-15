import React, { Suspense } from 'react';
import { Metadata } from 'next';
import AdminLoginClient from '../AdminLoginClient';

export const metadata: Metadata = {
  title: 'Secure Super Admin Access | NEWSIM',
  description: 'Authorized Super Admin personnel login for NEWSIM system.',
};

export default function SuperAdminLoginPage() {
  return (
    <main className="min-h-screen bg-[var(--color-navy-950)]">
      <Suspense fallback={<div>Loading...</div>}>
        <AdminLoginClient initialRole="SUPER_ADMIN" />
      </Suspense>
    </main>
  );
}
