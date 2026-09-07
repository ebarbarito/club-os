import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Badge } from '@/components/badge';
import { MEMBER_STATUS } from '@/lib/status-meta';
import { fmtDate, fmtDateTime, money } from '@/lib/format';
import { setMemberStatus } from '../actions';

const REPR_LABEL: Record<string, string> = {
  vigente: 'REPROCANN vigente',
  tramite: 'REPROCANN en trámite',
  no: 'Sin REPROCANN',
};
const MOD_LABEL: Record<string, string> = {
  propio: 'Cultivo propio',
  solidario: 'Cultivo solidario',
  ong: 'ONG',
};
const REPR_TYPE_LABEL: Record<string, string> = {
  autocultivador: 'Autocultivador',
  paciente: 'Paciente',
};
const CATEGORIA_LABEL: Record<string, string> = {
  activo: 'Socio Activo',
  autocultivador: 'Socio Autocultivador',
  adherente_menor: 'Socio Adherente — Menor de edad',
  adherente: 'Socio Adherente',
};

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: member } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
  if (!member) notFound();

  const [{ data: documents }, { data: cuotaSocialRows }, { data: creditRows }] = await Promise.all([
    supabase.from('member_documents').select('id, label, storage_path').eq('member_id', id),
    supabase
      .from('dispensas')
      .select('id, number, amount, created_at, acreditado_at, voided_at')
      .eq('member_id', id)
      .eq('es_cuota_social', true)
      .order('created_at', { ascending: false }),
    supabase.from('member_credits').select('amount').eq('member_id', id).eq('kind', 'cuota_social'),
  ]);
  const saldoCuotaSocial = (creditRows ?? []).reduce((s, r) => s + r.amount, 0);

  // Bucket privado — la URL firmada es la única forma de verlo, y vence
  // a los pocos minutos (no queda un link público dando vueltas).
  const admin = createAdminClient();
  const documentsWithUrl = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data } = await admin.storage.from('documentos').createSignedUrl(doc.storage_path, 300);
      return { ...doc, url: data?.signedUrl ?? null };
    }),
  );

  const meta = MEMBER_STATUS[member.status as keyof typeof MEMBER_STATUS];

  async function validate() {
    'use server';
    await setMemberStatus(id, 'valid');
  }
  async function reject() {
    'use server';
    await setMemberStatus(id, 'rejected');
  }

  return (
    <div className="max-w-2xl">
      <Link href="/panel/socios" className="text-sm text-text-soft hover:text-accent">
        ← Socios
      </Link>

      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">{member.name}</h1>
          <p className="text-text-soft">DNI {member.dni} · Alta {fmtDate(member.alta_date)}</p>
        </div>
        <Badge label={meta.label} color={meta.color} />
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 mb-4">
        <p className="text-xs font-semibold text-text-mute uppercase mb-3">Datos personales</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-text-mute">Teléfono</dt><dd>{member.phone ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Email</dt><dd>{member.email ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Nacimiento</dt><dd>{fmtDate(member.birth)}</dd></div>
          <div><dt className="text-text-mute">Nacionalidad</dt><dd>{member.nacionalidad ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Estado civil</dt><dd>{member.estado_civil ?? '—'}</dd></div>
          <div><dt className="text-text-mute">CUIL/CUIT</dt><dd>{member.cuil_cuit ?? '—'}</dd></div>
          <div className="col-span-2"><dt className="text-text-mute">Domicilio</dt><dd>{member.address ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Localidad</dt><dd>{member.localidad ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Provincia</dt><dd>{member.provincia ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Código postal</dt><dd>{member.codigo_postal ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Zona</dt><dd>{member.zona ?? '—'}</dd></div>
        </dl>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 mb-4">
        <p className="text-xs font-semibold text-text-mute uppercase mb-3">Categoría de socio</p>
        <p className="text-sm">{member.categoria_socio ? CATEGORIA_LABEL[member.categoria_socio] : 'Sin especificar'}</p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 mb-4">
        <p className="text-xs font-semibold text-text-mute uppercase mb-3">Salud / REPROCANN</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-text-mute">Tipo</dt><dd>{member.reprocann_type ? REPR_TYPE_LABEL[member.reprocann_type] : '—'}</dd></div>
          <div><dt className="text-text-mute">Estado</dt><dd>{REPR_LABEL[member.reprocann]}</dd></div>
          <div><dt className="text-text-mute">Modalidad</dt><dd>{member.modalidad ? MOD_LABEL[member.modalidad] : '—'}</dd></div>
          <div><dt className="text-text-mute">N° registro</dt><dd>{member.repr_num ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Vencimiento</dt><dd>{fmtDate(member.repr_exp)}</dd></div>
          <div><dt className="text-text-mute">Médico</dt><dd>{member.doctor ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Especialidad/Institución</dt><dd>{member.especialidad_institucion ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Matrícula</dt><dd>{member.matricula ?? '—'}</dd></div>
          <div className="col-span-2"><dt className="text-text-mute">Patología</dt><dd>{member.patologia ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Producto prescripto</dt><dd>{member.producto_prescripto ?? '—'}</dd></div>
          <div>
            <dt className="text-text-mute">Dosis mensual indicada</dt>
            <dd>{member.dosis_mensual != null ? `${member.dosis_mensual} ${member.dosis_unidad ?? ''}` : '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-text-mute uppercase">Servicio pactado</p>
          <Link href={`/panel/ctacorriente?member=${id}`} className="text-accent text-xs font-semibold hover:underline">
            Ver en Cuenta Corriente →
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <dt className="text-text-mute">Tipo</dt>
            <dd>{member.servicio_pactado_tipo === 'M2 cultivo' ? 'M² de cultivo' : (member.servicio_pactado_tipo ?? '—')}</dd>
          </div>
          <div><dt className="text-text-mute">Cantidad</dt><dd>{member.servicio_pactado_cantidad ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Cuota social</dt><dd>{member.cuota_social != null ? money(member.cuota_social) : '—'}</dd></div>
          <div><dt className="text-text-mute">Factura automática</dt><dd>{member.factura_automatica ? 'Sí' : 'No'}</dd></div>
        </dl>
        {saldoCuotaSocial > 0.01 && (
          <div className="rounded-lg bg-amber-bg px-3 py-2 text-sm text-amber-tx font-medium mb-3">
            Crédito cuota social disponible: {money(saldoCuotaSocial)}
          </div>
        )}
        {(cuotaSocialRows ?? []).length > 0 && (
          <div className="border-t border-line pt-3 space-y-1.5">
            {(cuotaSocialRows ?? []).map((c) => (
              <div key={c.id} className="flex justify-between items-center text-sm">
                <span className="text-text-soft">
                  {fmtDateTime(c.created_at)} · N° {c.number}
                  {c.voided_at ? ' · anulada' : c.acreditado_at ? ' · acreditada' : ' · pendiente'}
                </span>
                <span className="font-medium text-text">{money(c.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 mb-4">
        <p className="text-xs font-semibold text-text-mute uppercase mb-3">Documentación</p>
        {documentsWithUrl.length === 0 ? (
          <p className="text-text-mute text-sm">Sin documentos adjuntos.</p>
        ) : (
          <div className="flex gap-3 flex-wrap">
            {documentsWithUrl.map((doc) => (
              <a
                key={doc.id}
                href={doc.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-line-2 px-3 py-2 text-xs font-semibold text-text-soft hover:border-accent hover:text-accent"
              >
                {doc.label ?? 'Documento'} ↗
              </a>
            ))}
          </div>
        )}
      </div>

      {(member.status === 'pending' || member.status === 'draft') && (
        <div className="flex gap-2">
          <form action={reject}>
            <button className="rounded-lg border border-red text-red font-semibold text-sm px-4 py-2">
              Rechazar
            </button>
          </form>
          <form action={validate}>
            <button className="rounded-lg bg-accent text-white font-semibold text-sm px-4 py-2">
              Validar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
