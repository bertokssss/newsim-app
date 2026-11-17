import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveSiblingPortalOrigin } from '@newsim/auth';

export default async function ManagementRootPage(props: {
  searchParams?: Promise<{ [key: string]: string | undefined }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  if (searchParams?.code) {
    const reqHeaders = await headers();
    const targetBase = resolveSiblingPortalOrigin({ headers: reqHeaders }, 'trainee');
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    redirect(`${targetBase}/auth/callback?${params.toString()}`);
  }

  redirect('/login');
}
