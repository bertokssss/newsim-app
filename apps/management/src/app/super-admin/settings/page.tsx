import React from 'react';
import { Metadata } from 'next';
import SettingsClient from './SettingsClient';

export const metadata: Metadata = {
  title: 'System Settings & Security Policies | NEWSIM Super Admin',
  description: 'Manage application configuration, authentication policies, session timeouts, and Super Admin credentials.',
};

export default function SuperAdminSettingsPage() {
  return <SettingsClient />;
}
