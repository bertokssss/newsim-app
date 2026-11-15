import React, { Suspense } from 'react';
import { Metadata } from 'next';
import TraineeLoginClient from './TraineeLoginClient';

export const metadata: Metadata = {
  title: 'Trainee Sign In | NEWSIM',
  description: 'Sign in to access your NEWSIM trainee portal and courses.',
};

export default function TraineeLoginPage() {
  return (
    <Suspense fallback={null}>
      <TraineeLoginClient />
    </Suspense>
  );
}
