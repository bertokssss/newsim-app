import React from 'react';
import { Metadata } from 'next';
import ForgotPasswordClient from './ForgotPasswordClient';

export const metadata: Metadata = {
  title: 'Forgot Password | NEWSIM',
  description: 'Recover your NEWSIM account password.',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
