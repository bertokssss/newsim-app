import React from 'react';
import { Metadata } from 'next';
import TraineesClient from '@/app/super-admin/trainee-accounts/TraineesClient';

export const metadata: Metadata = {
  title: 'Trainees Directory | NEWSIM Admin',
  description: 'Manage seafarer accounts, enrollments, certification history, and system statuses.',
};

export default function AdminTraineesPage() {
  return <TraineesClient />;
}
