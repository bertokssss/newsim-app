import React from 'react';
import { Metadata } from 'next';
import InstructorsClient from '@/app/admin/instructors/InstructorsClient';

export const metadata: Metadata = {
  title: 'Instructor Operations | NEWSIM Super Admin',
  description: 'Manage instructor course assignments, session load, and simulator availability.',
};

export default function SuperAdminInstructorsPage() {
  return <InstructorsClient />;
}
