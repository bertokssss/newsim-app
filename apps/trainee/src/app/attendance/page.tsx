import React from 'react';
import { Metadata } from 'next';
import AttendanceClient from './AttendanceClient';

export const metadata: Metadata = {
  title: 'Attendance History | NEWSIM Trainee Portal',
  description: 'View verified roll-call attendance logs, session details, and STCW contact-hour compliance.',
};

export default function AttendancePage() {
  return <AttendanceClient />;
}
