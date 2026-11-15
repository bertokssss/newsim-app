import React from 'react';
import { Metadata } from 'next';
import LearningMaterialsClient from './LearningMaterialsClient';

export const metadata: Metadata = {
  title: 'Learning Materials | NEWSIM Instructor',
  description: 'Manage course training materials, simulator scenario configurations, PDF manuals, and presentations.',
};

export default function LearningMaterialsPage() {
  return <LearningMaterialsClient />;
}
