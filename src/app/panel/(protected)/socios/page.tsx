import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/badge';
import { ModalTrigger } from '@/components/modal-trigger';
import { MEMBER_STATUS } from '@/lib/status-meta';
import { fmtDate } from '@/lib/format';
import { CreateMemberForm } from './create-member-form';

const TABS = [
  { key: 'todos', label: 'Todos' },
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
  const { status } = await searchParams;
  const activeTab = status ?? 'todos';

  const supabase = await createClient();
  let query = supabase.from('members').select('*').order('alta_date', { ascending: false });
  if (activeTab !== 'todos') query = query.eq('status', activeTab);
  const { data: members } = await query;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Socios</h1>
          <p className="text-text-soft">Altas, validaciones y padrón</p>
        </div>
        <ModalTrigger label="+ Nueva alta" title="Alta de socio">
          <CreateMemberForm />
        </ModalTrigger>
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

      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Socio</th>
              <th className="px-4 py-2.5 font-medium">Zona</th>
              <th className="px-4 py-2.5 font-medium">REPROCANN</th>
              <th className="px-4 py-2.5 font-medium">Alta</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id} className="border-t border-line hover:bg-surface-2">
                <td className="px-4 py-2.5">
                  <Link href={`/panel/socios/${m.id}`} className="font-medium text-text hover:text-accent">
                    {m.name}
                  </Link>
                  <div className="text-text-mute text-xs">DNI {m.dni}</div>
                </td>
                <td className="px-4 py-2.5 text-text-soft">{m.zona ?? '—'}</td>
                <td className="px-4 py-2.5 text-text-soft capitalize">{m.reprocann}</td>
                <td className="px-4 py-2.5 text-text-soft">{fmtDate(m.alta_date)}</td>
                <td className="px-4 py-2.5">
                  <Badge label={MEMBER_STATUS[m.status as keyof typeof MEMBER_STATUS].label} color={MEMBER_STATUS[m.status as keyof typeof MEMBER_STATUS].color} />
                </td>
              </tr>
            ))}
            {(members ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text-mute">
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
