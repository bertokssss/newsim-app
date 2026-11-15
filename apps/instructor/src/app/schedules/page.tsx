import React from 'react';
import { Metadata } from 'next';
import SchedulesClient from './SchedulesClient';

export const metadata: Metadata = {
  title: 'Teaching Schedule | NEWSIM Instructor',
  description: 'View assigned training sessions, bridge simulator slots, and lecture timetable.',
};

export default function SchedulesPage() {
  return <SchedulesClient />;
}
