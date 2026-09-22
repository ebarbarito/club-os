import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { money, fmtDate } from '@/lib/format';
import { ConfigTabs } from '@/components/config-tabs';

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type ArticuloRow = {
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

type PagoRow = {
  id: string;
  date: string;
  memberName: string;
  memberNumber: number | null;
  accountName: string;
  amount: number;
};

type SearchParams = { tab?: string; member?: string; from?: string; to?: string; account?: string; strain?: string };

export default async function HistorialPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const { tab, member, from, to, account, strain } = await searchParams;
  const activeTab = tab === 'pago' ? 'pago' : 'articulo';
  const supabase = await createClient();

  const [{ data: members }, { data: accounts }] = await Promise.all([
    supabase.from('members').select('id, name, member_number').order('member_number'),
    supabase.from('payment_accounts').select('id, name').order('name'),
  ]);

  const TABS = [
    { key: 'articulo', label: 'Por artículo' },
    { key: 'pago', label: 'Por forma de pago' },
  ] as const;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Historial</h1>
      <p className="text-text-soft mb-4">Dispensas por socio, fecha, forma de pago y artículo</p>
      <ConfigTabs active="historial" />

      <div className="flex gap-1 mb-4 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'articulo' ? '/panel/historial' : '/panel/historial?tab=pago'}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              activeTab === t.key ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-soft hover:text-text'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === 'articulo' ? (
        <ArticuloTab member={member} from={from} to={to} account={account} strain={strain} members={members ?? []} accounts={accounts ?? []} />
      ) : (
        <PagoTab member={member} from={from} to={to} account={account} members={members ?? []} accounts={accounts ?? []} />
      )}
    </div>
  );
}

async function ArticuloTab({
  member,
  from,
  to,
  account,
  strain,
  members,
  accounts,
}: {
  member?: string;
  from?: string;
  to?: string;
  account?: string;
  strain?: string;
  members: { id: string; name: string; member_number: number | null }[];
  accounts: { id: string; name: string }[];
}) {
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

  const [{ data: dispensas }, { data: strains }] = await Promise.all([query, supabase.from('strains').select('id, name').order('name')]);

  const rows: ArticuloRow[] = [];
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
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="articulo" />
        <div>
          <label className="block text-xs font-medium text-text-soft mb-1">Socio</label>
          <select
            name="member"
            defaultValue={member ?? ''}
            className="rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent max-w-[14rem]"
          >
            <option value="">Todos</option>
            {members.map((m) => (
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
            {accounts.map((a) => (
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

async function PagoTab({
  member,
  from,
  to,
  account,
  members,
  accounts,
}: {
  member?: string;
  from?: string;
  to?: string;
  account?: string;
  members: { id: string; name: string; member_number: number | null }[];
  accounts: { id: string; name: string }[];
}) {
  const supabase = await createClient();

  let query = supabase
    .from('dispensa_payments')
    .select(
      'id, amount, account:payment_accounts(name), dispensa:dispensas!inner(number, created_at, member_id, voided_at, member:members(name, member_number))',
    )
    .is('dispensa.voided_at', null)
    .limit(1000);
  if (member) query = query.eq('dispensa.member_id', member);
  if (from) query = query.gte('dispensa.created_at', `${from}T00:00:00`);
  if (to) query = query.lte('dispensa.created_at', `${to}T23:59:59`);
  if (account) query = query.eq('account_id', account);

  const { data: payments } = await query;

  const rows: PagoRow[] = ((payments ?? []) as unknown as {
    id: string;
    amount: number;
    account: { name: string } | { name: string }[] | null;
    dispensa:
      | { created_at: string; member: { name: string; member_number: number | null } | { name: string; member_number: number | null }[] | null }
      | { created_at: string; member: { name: string; member_number: number | null } | { name: string; member_number: number | null }[] | null }[]
      | null;
  }[]).map((p) => {
    const dispensa = one(p.dispensa);
    const memberRow = dispensa ? one(dispensa.member) : null;
    const acc = one(p.account);
    return {
      id: p.id,
      date: dispensa?.created_at ?? '',
      memberName: memberRow?.name ?? '—',
      memberNumber: memberRow?.member_number ?? null,
      accountName: acc?.name ?? '—',
      amount: p.amount,
    };
  });
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalImporte = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="pago" />
        <div>
          <label className="block text-xs font-medium text-text-soft mb-1">Socio</label>
          <select
            name="member"
            defaultValue={member ?? ''}
            className="rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent max-w-[14rem]"
          >
            <option value="">Todos</option>
            {members.map((m) => (
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
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2">
          Filtrar
        </button>
        <Link href="/panel/historial?tab=pago" className="text-text-mute text-sm hover:text-text px-1 py-2">
          Limpiar
        </Link>
      </form>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Fecha</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Socio</th>
              <th className="px-4 py-2.5 font-medium">Forma de pago</th>
              <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Monto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{fmtDate(r.date)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-text">
                  {r.memberNumber != null ? `N° ${r.memberNumber} — ` : ''}
                  {r.memberName}
                </td>
                <td className="px-4 py-2.5 text-text-soft">{r.accountName}</td>
                <td className="px-4 py-2.5 text-right font-medium text-text whitespace-nowrap">{money(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-text-mute">
                  Sin resultados para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-line flex justify-between font-semibold text-text bg-surface-2">
            <span>Total: {rows.length} línea(s)</span>
            <span>{money(totalImporte)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
