import React from 'react';
import { Metadata } from 'next';
import CertificatesClient from './CertificatesClient';

export const metadata: Metadata = {
  title: 'Certificate Management | NEWSIM Admin',
  description: 'Validate graduation eligibility, issue QR-encoded STCW certificates, and manage reissuance.',
};

export default function CertificatesPage() {
  return <CertificatesClient />;
}
