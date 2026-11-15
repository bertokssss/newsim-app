import { PrivacyPolicyView } from '@newsim/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | NEWSIM Trainee Portal',
  description: 'NEWSIM Maritime Training Management System Privacy Policy and Philippine Data Privacy Act (RA 10173) notice.',
};

export default function TraineePrivacyPage() {
  return (
    <PrivacyPolicyView
      portalName="NEWSIM Trainee Portal"
      backHref="/login"
      backLabel="Back to Trainee Portal"
      termsHref="/terms"
    />
  );
}
