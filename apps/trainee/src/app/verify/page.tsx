import React, { Suspense } from 'react';
import { VerifyClient } from './VerifyClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Official Certificate Verification | NEWSIM Maritime Training',
  description: 'Public real-time authenticity and validity verification for MARINA STCW maritime training credentials.',
};

export default function CertificateVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-white font-mono text-sm animate-pulse">
          Verifying maritime certificate authenticity...
        </div>
      </div>
    }>
      <VerifyClient />
    </Suspense>
  );
}
