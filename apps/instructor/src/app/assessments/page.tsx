import React from 'react';
import { Metadata } from 'next';
import AssessmentsClient from './AssessmentsClient';

export const metadata: Metadata = {
  title: 'Assessments & Practicals | NEWSIM Instructor',
  description: 'Manage simulator evaluations, practical test score sheets, and written exam submissions.',
};

export default function AssessmentsPage() {
  return <AssessmentsClient />;
}
