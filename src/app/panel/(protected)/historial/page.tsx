import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { money, fmtDate } from '@/lib/format';

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type Row = {
  dispensaId: string;
  dispensaNumber: number;
  date: string;
  memberName: string;
  memberNumber: number | null;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  accounts: string;
};

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; from?: string; to?: string; account?: string; strain?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const { member, from, to, account, strain } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('dispensas')
    .select(
      'id, number, created_at, member_id, member:members(name, member_number), items:dispensa_items(description, quantity, unit_price, total, strain_id, strain:strains(name, item_type)), payments:dispensa_payments(account_id, account:payment_accounts(name))',
    )
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (member) query = query.eq('member_id', member);
  if (from) query = query.gte('created_at', `${from}T00:00:00`);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);

  const [{ data: dispensas }, { data: members }, { data: accounts }, { data: strains }] = await Promise.all([
    query,
    supabase.from('members').select('id, name, member_number').order('member_number'),
    supabase.from('payment_accounts').select('id, name').order('name'),
    supabase.from('strains').select('id, name').order('name'),
  ]);

  const rows: Row[] = [];
  for (const d of dispensas ?? []) {
    const memberRow = one(d.member);
    const payments = (d.payments ?? []) as { account_id: string | null; account: { name: string } | { name: string }[] | null }[];
    if (account && !payments.some((p) => p.account_id === account)) continue;
    const accountNames = [...new Set(payments.map((p) => one(p.account)?.name).filter((n): n is string => !!n))].join(', ') || '—';

    for (const it of (d.items ?? []) as {
      description: string;
      quantity: number;
      unit_price: number;
      total: number;
      strain_id: string | null;
      strain: { name: string; item_type: string } | { name: string; item_type: string }[] | null;
    }[]) {
      if (strain && it.strain_id !== strain) continue;
      const strainInfo = one(it.strain);
      rows.push({
        dispensaId: d.id,
        dispensaNumber: d.number,
        date: d.created_at,
        memberName: memberRow?.name ?? '—',
        memberNumber: memberRow?.member_number ?? null,
        description: it.description,
        unit: strainInfo?.item_type === 'accesorio' ? 'u.' : 'g',
        quantity: it.quantity,
        unitPrice: it.unit_price,
        total: it.total,
        accounts: accountNames,
      });
    }
  }

  const totalQuantity = rows.reduce((s, r) => s + r.quantity, 0);
  const totalImporte = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Historial</h1>
      <p className="text-text-soft mb-4">Dispensas por socio, fecha, forma de pago y artículo</p>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-text-soft mb-1">Socio</label>
          <select
            name="member"
            defaultValue={member ?? ''}
            className="rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent max-w-[14rem]"
          >
            <option value="">Todos</option>
            {(members ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.member_number != null ? `N° ${m.member_number} — ` : ''}
                {m.name}
              </option>
            ))}
          </select>
        </div>
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
          <label className="block text-xs font-medium text-text-soft mb-1">Forma de pago</label>
          <select
            name="account"
            defaultValue={account ?? ''}
            className="rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Todas</option>
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-soft mb-1">Artículo</label>
          <select
            name="strain"
            defaultValue={strain ?? ''}
            className="rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent max-w-[12rem]"
          >
            <option value="">Todos</option>
            {(strains ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2">
          Filtrar
        </button>
        <Link href="/panel/historial" className="text-text-mute text-sm hover:text-text px-1 py-2">
          Limpiar
        </Link>
      </form>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Fecha</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Socio</th>
              <th className="px-4 py-2.5 font-medium">Artículo</th>
              <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Cantidad</th>
              <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Precio unit.</th>
              <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Importe</th>
              <th className="px-4 py-2.5 font-medium">Forma de pago</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.dispensaId}-${i}`} className="border-t border-line">
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{fmtDate(r.date)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-text">
                  {r.memberNumber != null ? `N° ${r.memberNumber} — ` : ''}
                  {r.memberName}
                </td>
                <td className="px-4 py-2.5 text-text-soft">{r.description}</td>
                <td className="px-4 py-2.5 text-right text-text-soft whitespace-nowrap">
                  {r.quantity} {r.unit}
                </td>
                <td className="px-4 py-2.5 text-right text-text-soft whitespace-nowrap">{money(r.unitPrice)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-text whitespace-nowrap">{money(r.total)}</td>
                <td className="px-4 py-2.5 text-text-soft">{r.accounts}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-text-mute">
                  Sin resultados para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-line flex justify-between font-semibold text-text bg-surface-2">
            <span>Total: {rows.length} línea(s) · cantidad {totalQuantity}</span>
            <span>{money(totalImporte)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
