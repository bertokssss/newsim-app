import React from 'react';
import { Metadata } from 'next';
import AnalyticsClient from './AnalyticsClient';

export const metadata: Metadata = {
  title: 'Global System Analytics | NEWSIM Super Admin',
  description: 'Enterprise macro-analytics for maritime trainees, completions, system throughput, and campus performance.',
};

export default function SuperAdminAnalyticsPage() {
  return <AnalyticsClient />;
}
