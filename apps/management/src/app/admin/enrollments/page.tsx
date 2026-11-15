import React from 'react';
import { Metadata } from 'next';
import EnrollmentsClient from './EnrollmentsClient';

export const metadata: Metadata = {
  title: 'Enrollment Pipeline | NEWSIM Admin',
  description: 'Review seafarer training applications, process cohort admissions, and confirm payment requirements.',
};

export default function EnrollmentsPage() {
  return <EnrollmentsClient />;
}
