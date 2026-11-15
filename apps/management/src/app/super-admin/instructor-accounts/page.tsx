import { Metadata } from 'next';
import InstructorsClient from './InstructorsClient';

export const metadata: Metadata = {
  title: 'Instructor Accounts | NEWSIM',
  description: 'Manage instructor accounts and permissions.',
};

export default function InstructorAccountsPage() {
  return <InstructorsClient />;
}
