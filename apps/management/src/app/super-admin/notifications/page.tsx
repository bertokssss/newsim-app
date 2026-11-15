import React from 'react';
import { Metadata } from 'next';
import NotificationsClient from './NotificationsClient';

export const metadata: Metadata = {
  title: 'System Notifications & Alerts | NEWSIM Super Admin',
  description: 'Security incident notifications, infrastructure events, and system administration alerts.',
};

export default function SuperAdminNotificationsPage() {
  return <NotificationsClient />;
}
