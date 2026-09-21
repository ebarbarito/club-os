import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { publicUrlForSlug } from '@/lib/tenant/resolve';
import { ConfigTabs } from '@/components/config-tabs';
import { PublicSiteToggle } from './public-site-toggle';
import { PlanDeCuentas } from './plan-de-cuentas';
import { GenerarCuotasForm } from './generar-cuotas-form';

export default async function ConfiguracionPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();
  const [{ data: tenant }, { data: conceptRows }, { count: memberCount }] = await Promise.all([
    supabase.from('tenants').select('slug, public_site_enabled').eq('id', profile.tenantId).single(),
    supabase.from('ledger_concepts').select('id, name, allows_ingreso, allows_egreso, active').order('sort_order'),
    supabase.from('members').select('id', { count: 'exact', head: true }).is('deleted_at', null),
  ]);

  const publicUrl = tenant ? publicUrlForSlug(tenant.slug) : null;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Configuración</h1>
      <p className="text-text-soft mb-4">Ajustes generales del club</p>
      <ConfigTabs active="configuracion" />

      <div className="max-w-xl rounded-xl border border-line bg-surface p-5 space-y-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-text-mute uppercase mb-2">Sitio público</p>
          <p className="text-text-soft text-sm mb-3">
            Catálogo, reservas y alta de socios sin login. Mientras esté oculto, solo lo pueden ver las cuentas del
            equipo logueadas en este panel — nadie de afuera puede acceder.
          </p>
          <PublicSiteToggle enabled={tenant?.public_site_enabled ?? false} />
        </div>

        {publicUrl && (
          <div className="border-t border-line pt-4">
            <p className="text-text-mute text-xs mb-1">Link del sitio público</p>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent text-sm font-medium hover:underline break-all"
            >
              {publicUrl} ↗
            </a>
            <p className="text-text-mute text-xs mt-1">
              Como estás logueado en el panel de este club, este link te va a mostrar el sitio aunque esté oculto para
              el público.
            </p>
          </div>
        )}
      </div>

      {/* Cuotas sociales */}
      <div className="max-w-2xl rounded-xl border border-line bg-surface p-5 mb-6">
        <p className="text-xs font-semibold text-text-mute uppercase mb-1">Cuotas sociales</p>
        <p className="text-text-soft text-sm mb-4">
          Generá los cargos mensuales de cuota social para todos los socios activos. Una vez generados,
          el aviso de cuota adeudada aparece automáticamente al registrar una dispensa del socio.
        </p>
        <GenerarCuotasForm memberCount={memberCount ?? 0} />
      </div>

      <div className="max-w-3xl">
        <PlanDeCuentas concepts={conceptRows ?? []} />
      </div>
    </div>
  );
}
