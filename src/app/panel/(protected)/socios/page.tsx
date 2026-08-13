import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/badge';
import { ModalTrigger } from '@/components/modal-trigger';
import { MEMBER_STATUS } from '@/lib/status-meta';
import { fmtDate } from '@/lib/format';
import { CreateMemberForm } from './create-member-form';
import { EditMemberForm } from './edit-member-form';
import { DeleteMemberForm } from './delete-member-form';

const TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pending', label: 'En evaluación' },
  { key: 'valid', label: 'Válidos' },
  { key: 'draft', label: 'Borradores' },
  { key: 'rejected', label: 'Rechazados' },
] as const;

const REPROCANN_LABEL: Record<string, string> = { vigente: 'Vigente', tramite: 'En trámite', no: 'Sin REPROCANN' };
const REPROCANN_TYPE_LABEL: Record<string, string> = { autocultivador: 'Autocultivador', paciente: 'Paciente' };

function reprocannCell(reprocann: string, type: string | null): string {
  const status = REPROCANN_LABEL[reprocann] ?? reprocann;
  if (!type) return status;
  return `${REPROCANN_TYPE_LABEL[type] ?? type} · ${status}`;
}

export default async function SociosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeTab = status ?? 'todos';

  const supabase = await createClient();
  let query = supabase.from('members').select('*').is('deleted_at', null).order('member_number', { ascending: true, nullsFirst: false });
  if (activeTab !== 'todos') query = query.eq('status', activeTab);
  const { data: members } = await query;

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

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Código</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Nombre</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">DNI</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Domicilio</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">REPROCANN</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Alta</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Estado</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id} className="border-t border-line hover:bg-surface-2">
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{m.member_number ?? '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link href={`/panel/socios/${m.id}`} className="font-medium text-text hover:text-accent">
                    {m.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{m.dni}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft max-w-[220px] truncate" title={m.address ?? m.zona ?? ''}>
                  {m.address ?? m.zona ?? '—'}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{reprocannCell(m.reprocann, m.reprocann_type)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{fmtDate(m.alta_date)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Badge label={MEMBER_STATUS[m.status as keyof typeof MEMBER_STATUS].label} color={MEMBER_STATUS[m.status as keyof typeof MEMBER_STATUS].color} />
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <div className="flex gap-2 justify-end">
                    <ModalTrigger
                      label="Editar"
                      className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                      title={`Editar socio · ${m.name}`}
                      size="xl"
                    >
                      <EditMemberForm member={m} />
                    </ModalTrigger>
                    <ModalTrigger
                      label="Eliminar"
                      className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-red hover:text-red"
                      title="Eliminar socio"
                    >
                      <DeleteMemberForm memberId={m.id} memberName={m.name} />
                    </ModalTrigger>
                  </div>
                </td>
              </tr>
            ))}
            {(members ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-mute">
                  Sin socios en esta vista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
