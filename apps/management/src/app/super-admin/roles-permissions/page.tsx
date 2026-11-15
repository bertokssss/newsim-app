import React from 'react';
import { Metadata } from 'next';
import RolesPermissionsClient from './RolesPermissionsClient';

export const metadata: Metadata = {
  title: 'Roles & Permissions Matrix | NEWSIM Super Admin',
  description: 'Role-based access control (RBAC), least-privilege policies, and protected Super Admin safeguards.',
};

export default function SuperAdminRolesPage() {
  return <RolesPermissionsClient />;
}
