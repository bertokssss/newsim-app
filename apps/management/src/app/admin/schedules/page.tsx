import React from 'react';
import { Metadata } from 'next';
import SchedulesClient from './SchedulesClient';

export const metadata: Metadata = {
  title: 'Training Schedules | NEWSIM Admin',
  description: 'Manage classroom and simulator sessions, conflict detection, and timetable allocations.',
};

export default function SchedulesPage() {
  return <SchedulesClient />;
}
