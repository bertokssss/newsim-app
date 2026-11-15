import React from 'react';
import { Metadata } from 'next';
import AttendanceClient from './AttendanceClient';

export const metadata: Metadata = {
  title: 'Attendance Roll-Call | NEWSIM Instructor',
  description: 'Conduct classroom and simulator attendance roll calls, quorum validation, and attendance logs.',
};

export default function AttendancePage() {
  return <AttendanceClient />;
}
