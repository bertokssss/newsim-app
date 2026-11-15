import React from 'react';
import { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
  title: 'Super Admin Command Center | NEWSIM Maritime',
  description: 'Executive system governance, security monitoring, and global training analytics for NEWSIM.',
};

export default function SuperAdminDashboardPage() {
  return <DashboardClient />;
}
