import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveSiblingPortalOrigin } from '@newsim/auth';
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
    const reqHeaders = await headers();
    const targetBase = resolveSiblingPortalOrigin({ headers: reqHeaders }, 'trainee');
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
