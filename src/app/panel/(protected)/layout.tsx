import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';
import { ROLES } from '@/lib/roles';
import { Sidebar } from './sidebar';
import { PwaGuard } from './pwa-guard';
import { createClient } from '@/lib/supabase/server';
import { contarPendientesAlta } from '@/lib/alta/pendientes-server';
import { contarPedidosPendientes } from '@/lib/pedidos/pendientes-server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');

  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;

  // Defensa en profundidad: un usuario logueado en el subdominio de otro
  // club no debería entrar acá aunque RLS ya le bloquee los datos.
  if (!tenant || tenant.id !== profile.tenantId) redirect('/panel/login');

  // La tablet de la sede (usuario general) no entra al sistema de gestión:
  // solo ve su inicio con Alta de socios y Pedidos.
  if (profile.role === 'sede') redirect('/panel/sede');

  const role = ROLES[profile.role];

  // Punto de color en "Socios" cuando hay algo pendiente del lado del club
  // en el alta (mandar 2ª parte, validar, mandar bienvenida).
  // Lo mismo en "Dispensa" cuando hay pedidos (tablet o sitio) para atender.
  const alertas: Partial<Record<string, number>> = {};
  if (role.nav.includes('socios') || role.nav.includes('dispensas')) {
    const supabase = await createClient();
    const [altas, pedidos] = await Promise.all([
      role.nav.includes('socios') ? contarPendientesAlta(supabase).then((r) => r.total) : Promise.resolve(0),
      role.nav.includes('dispensas') ? contarPedidosPendientes(supabase) : Promise.resolve(0),
    ]);
    if (altas) alertas.socios = altas;
    if (pedidos) alertas.dispensas = pedidos;
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
