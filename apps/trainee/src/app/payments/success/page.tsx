'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || searchParams.get('sessionId') || '';
  const enrollmentId = searchParams.get('enrollment_id') || searchParams.get('enrollmentId') || '';

  useEffect(() => {
    let active = true;

    async function verifyAndRedirect() {
      try {
        const query = new URLSearchParams();
        if (sessionId && !sessionId.includes('{') && !sessionId.includes('CHECKOUT_SESSION_ID')) {
          query.set('sessionId', sessionId);
        }
        if (enrollmentId) {
          query.set('enrollmentId', enrollmentId);
        }

        if (query.toString()) {
          const url = `/api/trainee/payments/verify?${query.toString()}`;
          const res = await fetch(url, { cache: 'no-store' });
          const json = await res.json().catch(() => null);
          if (active && json?.success && !json.isPaid) {
            await new Promise((resolve) => setTimeout(resolve, 800));
            await fetch(url, { cache: 'no-store' });
          }
        }
      } catch (err) {
        console.error('Payment verification notice:', err);
      } finally {
        if (active) {
          router.replace('/payments');
        }
      }
    }

    verifyAndRedirect();

    return () => {
      active = false;
    };
  }, [sessionId, enrollmentId, router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-4 text-center">
      <Loader2 className="w-7 h-7 text-sky-500 animate-spin" />
      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
        Confirming payment and returning to Payments...
      </p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-xs font-mono text-slate-400">
          Confirming payment...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
