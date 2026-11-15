import React, { Suspense } from 'react';
import SetupPasswordClient from './SetupPasswordClient';

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SetupPasswordClient />
    </Suspense>
  );
}
