import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AdminLoginClient from './AdminLoginClient';

export const metadata: Metadata = {
  title: 'Secure Administrative Access | NEWSIM',
  description: 'Authorized administrative personnel login for NEWSIM system.',
};

export default async function SuperAdminLoginPage(props: {
  searchParams?: Promise<{ [key: string]: string | undefined }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  if (searchParams?.code) {
    const traineePort = process.env.NEXT_PUBLIC_TRAINEE_PORT || '3002';
    const targetBase = process.env.NEXT_PUBLIC_TRAINEE_URL || `http://localhost:${traineePort}`;
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    redirect(`${targetBase}/auth/callback?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-[#E8F6FF]">
      <Suspense>
        <AdminLoginClient />
      </Suspense>
    </main>
  );
}
