import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { documentosParaSocio } from '@/lib/alta/documentos';
import { parseMedicoClub } from '@/lib/alta/medico';
import { parseDatosMensajes } from '@/lib/alta/mensajes';
import { TRAMITES_REPROCANN } from '@/lib/alta/opciones';
import { AltaWizard } from './alta-wizard';

export const metadata = { title: 'Alta en sede' };

export default async function SedePage() {
  const profile = await getSessionProfile();
  if (!profile) return null;

  const admin = createAdminClient();
  const [{ data: tenant }, { data: equipo }] = await Promise.all([
    admin
      .from('tenants')
      .select('name, documentos_adhesion, medico_por_defecto, datos_mensajes')
      .eq('id', profile.tenantId)
      .single(),
    // El equipo que puede asistir un alta (no la propia cuenta de la tablet).
    admin.from('profiles').select('name, role').eq('tenant_id', profile.tenantId).neq('role', 'sede').order('name'),
  ]);
  if (!tenant) return null;

  const nombres = Array.from(new Set<string>((equipo ?? []).map((p) => String(p.name ?? '').trim()).filter((n) => n !== '')));
  const clinicann = TRAMITES_REPROCANN.find((t) => t.value === 'acompanado');

  return (
    <AltaWizard
      tenantName={tenant.name}
      equipo={nombres}
      docsPaciente={documentosParaSocio(tenant.documentos_adhesion, false)}
      docsAutocultivador={documentosParaSocio(tenant.documentos_adhesion, true)}
      medico={parseMedicoClub(tenant.medico_por_defecto)}
      infoClinicann={clinicann ? [...clinicann.info] : []}
      contactoClinicann={parseDatosMensajes(tenant.datos_mensajes).contacto_clinicann ?? null}
    />
  );
}
