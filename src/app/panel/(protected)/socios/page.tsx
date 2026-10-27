import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { CreateMemberForm } from './create-member-form';
import { SociosTable } from './socios-table';
import { headers } from 'next/headers';
import { publicUrlForSlug } from '@/lib/tenant/resolve';
import { parseDatosMensajes, plantilla, rellenar } from '@/lib/alta/mensajes';
import { fmtDateTime } from '@/lib/format';

const TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'preinscripto', label: 'Pre-inscriptos' },
  { key: 'pending', label: 'En evaluación' },
  { key: 'valid', label: 'Válidos' },
  { key: 'draft', label: 'Borradores' },
  { key: 'rejected', label: 'Rechazados' },
] as const;

export default async function SociosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const { status } = await searchParams;
  const activeTab = status ?? 'todos';

  const supabase = await createClient();
  let query = supabase.from('members').select('*').is('deleted_at', null).order('member_number', { ascending: true, nullsFirst: false });
  if (activeTab !== 'todos') query = query.eq('status', activeTab);
  const { data: members } = await query;

  // Mensaje de la segunda parte para el botón "Enviar 2ª parte" de cada
  // pre-inscripto. El link personal se genera recién al tocar el botón.
  const preinscriptos = (members ?? []).filter((m) => m.status === 'preinscripto');
  const segundaParte: Record<string, { texto: string; enviadaAt: string | null }> = {};
  if (preinscriptos.length > 0) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, slug, datos_mensajes')
      .eq('id', profile.tenantId)
      .single();
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
    const origin =
      (tenant && publicUrlForSlug(tenant.slug)) ??
      `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
    const datos = parseDatosMensajes(tenant?.datos_mensajes);
    for (const m of preinscriptos) {
      const p = plantilla('segunda-parte')!;
      segundaParte[m.id] = {
        texto: rellenar(p.texto, {
          club: tenant?.name ?? 'el club',
          operador: profile.name.trim().split(/\s+/)[0],
          datos,
          linkPreinscripcion: `${origin}/alta-socio`,
          socio: {
            nombre: m.nombre_pila ?? null,
            plan: m.plan_solicitado ?? null,
            adicionales: m.adicionales_solicitados ?? [],
            reprExp: m.repr_exp ?? null,
          },
        }),
        enviadaAt: m.etapa2_enviada_at ? fmtDateTime(m.etapa2_enviada_at) : null,
      };
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Socios</h1>
          <p className="text-text-soft">Altas, validaciones y padrón</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/panel/socios/export"
            className="rounded-lg border border-line-2 text-sm font-semibold px-4 py-2 hover:border-accent hover:text-accent"
          >
            Exportar CSV
          </Link>
          <ModalTrigger label="+ Nueva alta" title="Alta de socio">
            <CreateMemberForm />
          </ModalTrigger>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-line">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === 'todos' ? '/panel/socios' : `/panel/socios?status=${tab.key}`}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-text-soft hover:text-text'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <SociosTable members={members ?? []} segundaParte={segundaParte} />
    </div>
  );
}
