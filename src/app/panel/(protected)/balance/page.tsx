import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { money, monthLabel, monthRange, shiftMonth, fmtDate } from '@/lib/format';

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const { month } = await searchParams;
  const activeMonth = month ?? currentMonthKey();

  const supabase = await createClient();
  const { start, end } = monthRange(activeMonth);

  const { data: movements } = await supabase
    .from('ledger')
    .select('*')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false });

  const rows = movements ?? [];
  const ingresos = rows.filter((r) => r.type === 'ingreso').reduce((s, r) => s + r.amount, 0);
  const egresos = rows.filter((r) => r.type === 'egreso').reduce((s, r) => s + r.amount, 0);

  const byCategory = new Map<string, number>();
  for (const r of rows) {
    const signed = r.type === 'ingreso' ? r.amount : -r.amount;
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + signed);
  }

  const last3Months = [shiftMonth(currentMonthKey(), -2), shiftMonth(currentMonthKey(), -1), currentMonthKey()];
  const chartData = await Promise.all(
    last3Months.map(async (key) => {
      const range = monthRange(key);
      const { data } = await supabase
        .from('ledger')
        .select('type, amount')
        .gte('created_at', range.start)
        .lt('created_at', range.end);
      const ing = (data ?? []).filter((r) => r.type === 'ingreso').reduce((s, r) => s + r.amount, 0);
      const eg = (data ?? []).filter((r) => r.type === 'egreso').reduce((s, r) => s + r.amount, 0);
      return { key, ing, eg };
    }),
  );
  const maxValue = Math.max(1, ...chartData.flatMap((d) => [d.ing, d.eg]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Balance</h1>
          <p className="text-text-soft">Ingresos y egresos del club</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/panel/balance?month=${shiftMonth(activeMonth, -1)}`} className="rounded-lg border border-line-2 px-2 py-1">
            ←
          </Link>
          <span className="font-semibold text-text w-24 text-center">{monthLabel(activeMonth)}</span>
          <Link href={`/panel/balance?month=${shiftMonth(activeMonth, 1)}`} className="rounded-lg border border-line-2 px-2 py-1">
            →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-text-mute text-xs mb-1">Ingresos</p>
          <p className="font-display text-xl font-bold text-accent">{money(ingresos)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-text-mute text-xs mb-1">Egresos</p>
          <p className="font-display text-xl font-bold text-red">{money(egresos)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-text-mute text-xs mb-1">Balance</p>
          <p className="font-display text-xl font-bold text-text">{money(ingresos - egresos)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold text-text-mute uppercase mb-3">Desglose por rubro</p>
          <div className="space-y-2">
            {[...byCategory.entries()].map(([cat, amount]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-text-soft">{cat}</span>
                <span className={amount >= 0 ? 'text-accent' : 'text-red'}>{money(amount)}</span>
              </div>
            ))}
            {byCategory.size === 0 && <p className="text-text-mute text-sm">Sin movimientos este mes.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold text-text-mute uppercase mb-3">Últimos 3 meses</p>
          <svg viewBox="0 0 240 120" className="w-full h-32">
            {chartData.map((d, i) => {
              const x = i * 80 + 15;
              const ingH = (d.ing / maxValue) * 90;
              const egH = (d.eg / maxValue) * 90;
              return (
                <g key={d.key}>
                  <rect x={x} y={100 - ingH} width="20" height={ingH} className="fill-accent" />
                  <rect x={x + 24} y={100 - egH} width="20" height={egH} className="fill-red" />
                  <text x={x + 22} y="114" fontSize="9" textAnchor="middle" className="fill-current text-text-mute">
                    {monthLabel(d.key).split(' ')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="flex gap-4 text-xs text-text-mute mt-1">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-accent inline-block" /> Ingresos
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red inline-block" /> Egresos
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Fecha</th>
              <th className="px-4 py-2.5 font-medium">Rubro</th>
              <th className="px-4 py-2.5 font-medium">Concepto</th>
              <th className="px-4 py-2.5 font-medium">Medio</th>
              <th className="px-4 py-2.5 font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2.5 text-text-soft">{fmtDate(r.created_at)}</td>
                <td className="px-4 py-2.5 text-text-soft">{r.category}</td>
                <td className="px-4 py-2.5 text-text">{r.concept}</td>
                <td className="px-4 py-2.5 text-text-soft capitalize">{r.method}</td>
                <td className={`px-4 py-2.5 font-medium ${r.type === 'ingreso' ? 'text-accent' : 'text-red'}`}>
                  {r.type === 'ingreso' ? '+' : '-'}
                  {money(r.amount)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text-mute">
                  Sin movimientos este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
