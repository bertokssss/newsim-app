import React from 'react';
import { Metadata } from 'next';
import GradingPoliciesClient from './GradingPoliciesClient';

export const metadata: Metadata = {
  title: 'Grading Policies & Standards | NEWSIM Management',
  description: 'Configure course-level grading formulas, assessment weights, and STCW mandatory compliance thresholds.',
};

export default function GradingPoliciesPage() {
  return <GradingPoliciesClient />;
}
