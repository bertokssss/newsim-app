import ProfileClient from '../profile/ProfileClient';

export const metadata = {
  title: 'Seafarer Settings | NEWSIM Maritime LMS',
  description: 'Manage Seafarer Registration Number (SRN), maritime credentials, and account settings.',
};

export default function SettingsPage() {
  return <ProfileClient />;
}
