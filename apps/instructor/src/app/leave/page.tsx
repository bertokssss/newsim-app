import React from 'react';
import LeaveClient from './LeaveClient';

export const metadata = {
  title: 'Leave Requests | Maritime Instructor Portal',
  description: 'Submit and track instructor official leaves, sick days, and vacation requests.',
};

export default function LeavePage() {
  return <LeaveClient />;
}
