import { PrivacyPolicyView } from '@newsim/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | NEWSIM Instructor Portal',
  description: 'NEWSIM Maritime Training Management System Privacy Policy and Data Privacy Act (RA 10173) notice.',
};

export default function InstructorPrivacyPage() {
  return (
    <PrivacyPolicyView
      portalName="NEWSIM Instructor Portal"
      backHref="/login"
      backLabel="Back to Instructor Portal"
      termsHref="/terms"
    />
  );
}
