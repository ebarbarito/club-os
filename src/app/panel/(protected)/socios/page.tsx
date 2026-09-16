import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { CreateMemberForm } from './create-member-form';
import { SociosTable } from './socios-table';

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
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

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

      <SociosTable members={members ?? []} />
    </div>
  );
}
