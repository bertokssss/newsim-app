import React from 'react';
import { Metadata } from 'next';
import ResetPasswordClient from './ResetPasswordClient';

export const metadata: Metadata = {
  title: 'Reset Password | NEWSIM',
  description: 'Create a new password for your NEWSIM account.',
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
