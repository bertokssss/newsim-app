import React from 'react';
import { Metadata } from 'next';
import VerifyEmailClient from './VerifyEmailClient';

export const metadata: Metadata = {
  title: 'Verify Your Email | NEWSIM',
  description: 'Verify your email to activate your NEWSIM trainee account.',
};

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
