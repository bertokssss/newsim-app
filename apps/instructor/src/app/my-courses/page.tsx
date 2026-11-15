import React from 'react';
import { Metadata } from 'next';
import MyCoursesClient from './MyCoursesClient';

export const metadata: Metadata = {
  title: 'Assigned Courses | NEWSIM Instructor',
  description: 'View assigned maritime training courses, syllabus materials, and enrolled seafarer cohorts.',
};

export default function MyCoursesPage() {
  return <MyCoursesClient />;
}
