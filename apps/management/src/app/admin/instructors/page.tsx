import React from 'react';
import { Metadata } from 'next';
import InstructorsClient from './InstructorsClient';

export const metadata: Metadata = {
  title: 'Instructor Operations | NEWSIM Admin',
  description: 'Manage instructor course assignments, session load, and simulator availability.',
};

export default function InstructorsPage() {
  return <InstructorsClient />;
}
