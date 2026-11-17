import React from 'react';
import { Metadata } from 'next';
import CoursesClient from '@/app/admin/courses/CoursesClient';

export const metadata: Metadata = {
  title: 'Course Management | NEWSIM Super Admin',
  description: 'Manage maritime training courses, syllabus duration, pricing, and simulator prerequisites.',
};

export default function SuperAdminCoursesPage() {
  return <CoursesClient />;
}
