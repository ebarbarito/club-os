import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { fmtDateTime } from '@/lib/format';
import { PurgeAuditForm } from './purge-audit-form';

const CHANGE_TYPE_LABEL: Record<string, string> = { edicion: 'Edición', eliminacion: 'Eliminación' };

export default async function AsientosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; user?: string; type?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const { from, to, user, type } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('audit_log')
    .select('id, created_at, entity_type, change_type, description, reason, by:profiles(name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (from) query = query.gte('created_at', `${from}T00:00:00`);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);
  if (user) query = query.eq('user_id', user);
  if (type) query = query.eq('change_type', type);

  const [{ data: entries }, { data: profiles }] = await Promise.all([
    query,
    supabase.from('profiles').select('id, name').order('name'),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Asientos</h1>
          <p className="text-text-soft">Modificaciones y eliminaciones — solo administrador</p>
        </div>
        <PurgeAuditForm />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-text-soft mb-1">Desde</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ''}
            className="rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-soft mb-1">Hasta</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ''}
            className="rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-soft mb-1">Usuario</label>
          <select
            name="user"
            defaultValue={user ?? ''}
            className="rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-soft mb-1">Tipo</label>
          <select
            name="type"
            defaultValue={type ?? ''}
            className="rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            <option value="edicion">Edición</option>
            <option value="eliminacion">Eliminación</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2">
          Filtrar
        </button>
        <Link href="/panel/asientos" className="text-text-mute text-sm hover:text-text px-1 py-2">
          Limpiar
        </Link>
      </form>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Fecha</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Usuario</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Tipo</th>
              <th className="px-4 py-2.5 font-medium">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((e) => {
              const by = Array.isArray(e.by) ? e.by[0] : e.by;
              return (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{fmtDateTime(e.created_at)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{by?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`text-xs font-semibold ${e.change_type === 'eliminacion' ? 'text-red' : 'text-accent'}`}>
                      {CHANGE_TYPE_LABEL[e.change_type] ?? e.change_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-soft whitespace-pre-wrap">
                    {e.description}
                    {e.reason && <div className="mt-1 text-text-mute">Motivo: {e.reason}</div>}
                  </td>
                </tr>
              );
            })}
            {(entries ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-text-mute">
                  Sin modificaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
