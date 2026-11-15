import { PrivacyPolicyView } from '@newsim/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | NEWSIM Management Portal',
  description: 'NEWSIM Maritime Training Management System Privacy Policy and Data Privacy Act (RA 10173) compliance notice.',
};

export default function ManagementPrivacyPage() {
  return (
    <PrivacyPolicyView
      portalName="NEWSIM Management Portal"
      backHref="/login"
      backLabel="Back to Management Portal"
      termsHref="/terms"
    />
  );
}
