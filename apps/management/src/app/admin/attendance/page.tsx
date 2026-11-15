import React from 'react';
import { Metadata } from 'next';
import AttendanceClient from './AttendanceClient';

export const metadata: Metadata = {
  title: 'Attendance Management | NEWSIM Admin',
  description: 'Track daily seafarer attendance, quorum requirements, and audited punctuality adjustments.',
};

export default function AttendancePage() {
  return <AttendanceClient />;
}
