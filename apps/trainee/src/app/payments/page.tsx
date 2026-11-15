import PaymentsClient from './PaymentsClient';

export const metadata = {
  title: 'Payments & Tuition Receipts | NEWSIM Trainee Portal',
  description: 'View payment receipts, checkout with QR Ph, and track financial transactions.',
};

export default function PaymentsPage() {
  return <PaymentsClient />;
}
