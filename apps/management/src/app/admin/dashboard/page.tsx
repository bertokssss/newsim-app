import React from 'react';
import { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
  title: 'Operations Command Center | NEWSIM Admin',
  description: 'Maritime training operations, trainee cohorts, simulator schedules, and payment verification.',
};

export default function AdminDashboardPage() {
  return <DashboardClient />;
}
