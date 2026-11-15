import { TermsConditionsView } from '@newsim/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions | NEWSIM Management Portal',
  description: 'NEWSIM Maritime Training Management System Terms and Conditions governing portal use and governance.',
};

export default function ManagementTermsPage() {
  return (
    <TermsConditionsView
      portalName="NEWSIM Management Portal"
      backHref="/login"
      backLabel="Back to Management Portal"
      privacyHref="/privacy"
    />
  );
}
