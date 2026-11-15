import React from 'react';
import { Metadata } from 'next';
import CoursesClient from './CoursesClient';

export const metadata: Metadata = {
  title: 'Course Management | NEWSIM Admin',
  description: 'Manage maritime training courses, syllabus duration, pricing, and simulator prerequisites.',
};

export default function CoursesPage() {
  return <CoursesClient />;
}
