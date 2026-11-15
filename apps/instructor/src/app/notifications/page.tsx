import React from 'react';
import { Metadata } from 'next';
import NotificationsClient from './NotificationsClient';

export const metadata: Metadata = {
  title: 'Teaching Notifications | NEWSIM Instructor',
  description: 'View training notices, evaluation submission alerts, and schedule changes.',
};

export default function NotificationsPage() {
  return <NotificationsClient />;
}
