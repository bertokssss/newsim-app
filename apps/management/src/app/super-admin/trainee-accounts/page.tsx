import React from 'react';
import { Metadata } from 'next';
import TraineesClient from './TraineesClient';

export const metadata: Metadata = {
  title: 'Trainee Management | NEWSIM Admin',
  description: 'Manage seafarer trainees, verify eligibility, inspect attendance, and track STCW certifications.',
};

export default function TraineesPage() {
  return <TraineesClient />;
}
