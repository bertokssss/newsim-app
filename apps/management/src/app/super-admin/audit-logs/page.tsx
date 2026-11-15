import React from 'react';
import { Metadata } from 'next';
import AuditLogsClient from './AuditLogsClient';

export const metadata: Metadata = {
  title: 'Master Audit Logs Ledger | NEWSIM Super Admin',
  description: 'Enterprise immutable security and administrative audit log viewer.',
};

export default function SuperAdminAuditLogsPage() {
  return <AuditLogsClient />;
}
