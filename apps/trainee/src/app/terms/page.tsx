import { TermsConditionsView } from '@newsim/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions | NEWSIM Trainee Portal',
  description: 'NEWSIM Maritime Training Management System Terms and Conditions for trainees and LMS users.',
};

export default function TraineeTermsPage() {
  return (
    <TermsConditionsView
      portalName="NEWSIM Trainee Portal"
      backHref="/login"
      backLabel="Back to Trainee Portal"
      privacyHref="/privacy"
    />
  );
}
