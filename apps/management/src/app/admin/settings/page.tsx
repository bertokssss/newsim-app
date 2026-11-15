import React from 'react';
import { Metadata } from 'next';
import SettingsClient from './SettingsClient';

export const metadata: Metadata = {
  title: 'Admin Settings | NEWSIM Admin',
  description: 'Manage personal administrator profile, credentials, MFA authentication, and operational preferences.',
};

export default function SettingsPage() {
  return <SettingsClient />;
}
