import React from 'react';
import { Metadata } from 'next';
import ReportsClient from './ReportsClient';

export const metadata: Metadata = {
  title: 'Operational Reports | NEWSIM Admin',
  description: 'Generate and export training operation reports, trainee rosters, payments, and attendance CSV datasets.',
};

export default function ReportsPage() {
  return <ReportsClient />;
}
