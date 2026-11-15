import React from 'react';
import { Metadata } from 'next';
import TraineesClient from './TraineesClient';

export const metadata: Metadata = {
  title: 'Assigned Trainees | NEWSIM Instructor',
  description: 'View seafarers enrolled in your courses, training progress milestones, and attendance ratings.',
};

export default function TraineesPage() {
  return <TraineesClient />;
}
