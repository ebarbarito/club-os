import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';
import { ROLES } from '@/lib/roles';
import { Sidebar } from './sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');

  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;

  // Defensa en profundidad: un usuario logueado en el subdominio de otro
  // club no debería entrar acá aunque RLS ya le bloquee los datos.
  if (!tenant || tenant.id !== profile.tenantId) redirect('/panel/login');

  const role = ROLES[profile.role];

  return (
    <div className="flex flex-1 min-h-screen bg-bg font-sans">
      <Sidebar tenantName={tenant.name} logoUrl={tenant.logo_url} profile={profile} nav={role.nav} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
