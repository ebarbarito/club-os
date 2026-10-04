import { headers } from 'next/headers';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;
  return <LoginForm tenantName={tenant?.name ?? null} logoUrl={tenant?.logo_url ?? null} />;
}
