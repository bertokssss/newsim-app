import CertificatesClient from './CertificatesClient';

export const metadata = {
  title: 'Certificates & Credentials | NEWSIM Trainee Portal',
  description: 'View earned IMO/STCW maritime training certificates, verification codes, and PDF credentials.',
};

export default function CertificatesPage() {
  return <CertificatesClient />;
}
