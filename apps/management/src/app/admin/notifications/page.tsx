import React from 'react';
import { Metadata } from 'next';
import NotificationsClient from './NotificationsClient';

export const metadata: Metadata = {
  title: 'Operational Notifications | NEWSIM Admin',
  description: 'Real-time notifications for seafarer enrollments, payment clearances, and certificate events.',
};

export default function NotificationsPage() {
  return <NotificationsClient />;
}
