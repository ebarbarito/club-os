import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { publicUrlForSlug } from '@/lib/tenant/resolve';
import { ConfigTabs } from '@/components/config-tabs';
import { PublicSiteToggle } from './public-site-toggle';

export default async function ConfiguracionPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug, public_site_enabled')
    .eq('id', profile.tenantId)
    .single();

  const publicUrl = tenant ? publicUrlForSlug(tenant.slug) : null;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Configuración</h1>
      <p className="text-text-soft mb-4">Ajustes generales del club</p>
      <ConfigTabs active="configuracion" />

      <div className="max-w-xl rounded-xl border border-line bg-surface p-5 space-y-4">
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
    </div>
  );
}
