import React from 'react';
import { Metadata } from 'next';
import PaymentsClient from './PaymentsClient';

export const metadata: Metadata = {
  title: 'Payment Verification | NEWSIM Admin',
  description: 'Process and verify QR Ph, GCash, Maya, and bank payments for training courses.',
};

export default function PaymentsPage() {
  return <PaymentsClient />;
}
