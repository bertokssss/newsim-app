import React from 'react';
import { Metadata } from 'next';
import TraineesClient from '@/app/super-admin/trainee-accounts/TraineesClient';

export const metadata: Metadata = {
  title: 'Trainee Accounts & Records | NEWSIM Super Admin',
  description: 'Manage seafarer accounts, enrollments, certification history, and system statuses.',
};

export default function SuperAdminTraineesPage() {
  return <TraineesClient />;
}
