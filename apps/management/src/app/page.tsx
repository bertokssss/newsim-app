import { redirect } from 'next/navigation';

export default async function ManagementRootPage(props: {
  searchParams?: Promise<{ [key: string]: string | undefined }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  if (searchParams?.code) {
    const traineePort = process.env.NEXT_PUBLIC_TRAINEE_PORT || '3002';
    const targetBase = process.env.NEXT_PUBLIC_TRAINEE_URL || `http://localhost:${traineePort}`;
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    redirect(`${targetBase}/auth/callback?${params.toString()}`);
  }

  redirect('/login');
}
