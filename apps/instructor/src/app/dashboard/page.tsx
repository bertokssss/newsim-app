import React from 'react';
import { Metadata } from 'next';
import InstructorDashboardClient from './DashboardClient';

export const metadata: Metadata = {
  title: 'Instructor Command Center | NEWSIM',
  description: 'Manage assigned courses, conduct simulator sessions, record attendance, and evaluate seafarer trainees.',
};

export default function InstructorDashboardPage() {
  return <InstructorDashboardClient />;
}
