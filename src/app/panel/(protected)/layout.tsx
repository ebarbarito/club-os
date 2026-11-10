import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';
import { ROLES } from '@/lib/roles';
import { Sidebar } from './sidebar';
import { PwaGuard } from './pwa-guard';
import { createClient } from '@/lib/supabase/server';
import { contarPendientesAlta } from '@/lib/alta/pendientes-server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');

  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;

  // Defensa en profundidad: un usuario logueado en el subdominio de otro
  // club no debería entrar acá aunque RLS ya le bloquee los datos.
  if (!tenant || tenant.id !== profile.tenantId) redirect('/panel/login');

  const role = ROLES[profile.role];

  // Punto de color en "Socios" cuando hay algo pendiente del lado del club
  // en el alta (mandar 2ª parte, validar, mandar bienvenida).
  const alertas: Partial<Record<string, number>> = {};
  if (role.nav.includes('socios')) {
    const supabase = await createClient();
    alertas.socios = (await contarPendientesAlta(supabase)).total;
  }

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-screen bg-bg font-sans">
      <Sidebar tenantName={tenant.name} logoUrl={tenant.logo_url} profile={profile} nav={role.nav} alertas={alertas} />
      <PwaGuard>
        <main className="flex-1 p-4 sm:p-6 min-w-0">{children}</main>
      </PwaGuard>
    </div>
  );
}
