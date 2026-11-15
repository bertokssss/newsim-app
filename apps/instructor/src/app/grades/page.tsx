import React from 'react';
import { Metadata } from 'next';
import GradesClient from './GradesClient';

export const metadata: Metadata = {
  title: 'Course Gradebook | NEWSIM Instructor',
  description: 'Course-level gradebook matrix, assessment scoring, and audited score modifications.',
};

export default function GradesPage() {
  return <GradesClient />;
}
