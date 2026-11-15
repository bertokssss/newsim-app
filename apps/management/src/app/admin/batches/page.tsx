import React from 'react';
import { Metadata } from 'next';
import BatchesClient from './BatchesClient';

export const metadata: Metadata = {
  title: 'Batch Capacity & Scheduling | NEWSIM Admin',
  description: 'Manage maritime training course batches, schedules, seat capacity, and overbooking prevention.',
};

export default function BatchesPage() {
  return <BatchesClient />;
}
