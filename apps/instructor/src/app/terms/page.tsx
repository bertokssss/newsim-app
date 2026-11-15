import { TermsConditionsView } from '@newsim/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions | NEWSIM Instructor Portal',
  description: 'NEWSIM Maritime Training Management System Terms and Conditions for instructors and assessors.',
};

export default function InstructorTermsPage() {
  return (
    <TermsConditionsView
      portalName="NEWSIM Instructor Portal"
      backHref="/login"
      backLabel="Back to Instructor Portal"
      privacyHref="/privacy"
    />
  );
}
