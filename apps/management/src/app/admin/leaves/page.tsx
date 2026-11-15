import React from 'react';
import LeavesClient from './LeavesClient';

export const metadata = {
  title: 'Instructor Leave Requests | NEWSIM Admin',
  description: 'Review and approve instructor leave requests, lock schedules, and assign substitute instructors.',
};

export default function AdminLeavesPage() {
  return <LeavesClient />;
}
