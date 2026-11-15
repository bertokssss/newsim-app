import React from 'react';
import { Metadata } from 'next';
import AdminsClient from './AdminsClient';

export const metadata: Metadata = {
  title: 'Administrator Accounts Management | NEWSIM Super Admin',
  description: 'Privileged provisioning and governance for NEWSIM operational administrator accounts.',
};

export default function SuperAdminAdminsPage() {
  return <AdminsClient />;
}
