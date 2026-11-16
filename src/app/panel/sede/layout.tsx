import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';
import { ROLES } from '@/lib/roles';
import { SalirSede } from './salir-sede';

// Tablet de la sede: pantalla completa, sin el menú del panel. Entra el
// usuario general "sede" (y un admin, para probar o asistir).
export default async function SedeLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'sede' && profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;
  if (!tenant || tenant.id !== profile.tenantId) redirect('/panel/login');

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-bg font-sans">
      <header className="flex items-center justify-between gap-4 bg-green-900 px-5 py-3 text-white">
        <div className="flex items-center gap-3">
          {tenant.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt="" className="h-10 w-auto object-contain" />
          )}
          <div>
            <p className="font-display text-lg font-bold leading-tight">{tenant.name}</p>
            <p className="text-xs text-white/70">Alta en sede</p>
          </div>
        </div>
        <SalirSede esAdmin={profile.role === 'admin'} />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
