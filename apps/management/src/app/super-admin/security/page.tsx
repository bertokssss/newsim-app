import React from 'react';
import { Metadata } from 'next';
import SecurityClient from './SecurityClient';

export const metadata: Metadata = {
  title: 'Enterprise Security Center | NEWSIM Super Admin',
  description: 'Threat mitigation, session monitoring, emergency revocation, and multi-factor compliance.',
};

export default function SuperAdminSecurityPage() {
  return <SecurityClient />;
}
