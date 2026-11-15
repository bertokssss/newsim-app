import React from 'react';
import { Metadata } from 'next';
import ProgressClient from './ProgressClient';

export const metadata: Metadata = {
  title: 'Trainee Progress | NEWSIM Instructor',
  description: 'Track seafarer module completion milestones, attendance rates, average grades, and at-risk alerts.',
};

export default function ProgressPage() {
  return <ProgressClient />;
}
