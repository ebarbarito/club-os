import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';
import { ROLES } from '@/lib/roles';
import { Marca } from '@/components/public/marca';
import { CabeceraSede } from './cabecera-sede';

// Tablet de la sede: pantalla completa, sin el menú del panel. Entra el
// usuario general "sede" (y un admin, para probar o asistir).
export default async function SedeLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'sede' && profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;
  if (!tenant || tenant.id !== profile.tenantId) redirect('/panel/login');

  // Con los colores, tipografías y texturas del manual de marca del club.
  return (
    <Marca tenant={tenant}>
      <div className="flex min-h-screen flex-1 flex-col bg-bg font-sans">
        <CabeceraSede nombre={tenant.name} logoUrl={tenant.logo_url} esAdmin={profile.role === 'admin'} />
        <main className="flex-1">{children}</main>
      </div>
    </Marca>
  );
}
