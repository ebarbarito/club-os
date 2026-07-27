import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Badge } from '@/components/badge';
import { MEMBER_STATUS } from '@/lib/status-meta';
import { fmtDate } from '@/lib/format';
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

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: member } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
  if (!member) notFound();

  const { data: documents } = await supabase
    .from('member_documents')
    .select('id, label, storage_path')
    .eq('member_id', id);

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
          <div><dt className="text-text-mute">Zona</dt><dd>{member.zona ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Nacimiento</dt><dd>{fmtDate(member.birth)}</dd></div>
        </dl>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 mb-4">
        <p className="text-xs font-semibold text-text-mute uppercase mb-3">Salud / REPROCANN</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-text-mute">Estado</dt><dd>{REPR_LABEL[member.reprocann]}</dd></div>
          <div><dt className="text-text-mute">Modalidad</dt><dd>{member.modalidad ? MOD_LABEL[member.modalidad] : '—'}</dd></div>
          <div><dt className="text-text-mute">N° registro</dt><dd>{member.repr_num ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Vencimiento</dt><dd>{fmtDate(member.repr_exp)}</dd></div>
          <div><dt className="text-text-mute">Médico</dt><dd>{member.doctor ?? '—'}</dd></div>
          <div><dt className="text-text-mute">Matrícula</dt><dd>{member.matricula ?? '—'}</dd></div>
          <div className="col-span-2"><dt className="text-text-mute">Patología</dt><dd>{member.patologia ?? '—'}</dd></div>
        </dl>
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
