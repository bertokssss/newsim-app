import React, { Suspense } from 'react';
import { Metadata } from 'next';
import TraineeRegisterClient from './TraineeRegisterClient';

export const metadata: Metadata = {
  title: 'Create Trainee Account | NEWSIM',
  description: 'Start your maritime learning journey with NEWSIM. Register for a trainee account.',
};

export default function TraineeRegisterPage() {
  return (
    <Suspense fallback={null}>
      <TraineeRegisterClient />
    </Suspense>
  );
}
