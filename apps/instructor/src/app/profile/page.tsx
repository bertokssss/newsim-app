import React from 'react';
import { Metadata } from 'next';
import ProfileClient from './ProfileClient';

export const metadata: Metadata = {
  title: 'Instructor Profile | NEWSIM',
  description: 'Manage instructor maritime certifications, credentials, password security, and MFA.',
};

export default function ProfilePage() {
  return <ProfileClient />;
}
