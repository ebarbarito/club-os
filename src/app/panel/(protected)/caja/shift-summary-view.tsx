import { money, fmtDateTime } from '@/lib/format';
import { groupByReceipt, type GroupableLedgerRow } from './group-by-receipt';

export type SummaryMovement = GroupableLedgerRow & {
  category: string;
  concept: string;
  account: { name: string } | { name: string }[] | null;
};

export type SummaryShift = {
  kind: string;
  opened_at: string;
  opening_cash: number;
  opening_usd: number | null;
  counted_cash: number | null;
  counted_usd: number | null;
  difference: number | null;
  difference_usd: number | null;
  opened_by_profile?: { name: string } | { name: string }[] | null;
};

// Presentacional puro (sin fetch propio) para poder usarse tanto desde un
// Server Component (shift-summary.tsx, con los datos ya cargados) como
// desde un flujo client-side (el "¿desea imprimir el arqueo?" al cerrar
// una caja, que trae los datos via Server Action en vez de props).
export function ShiftSummaryView({ shift, movements }: { shift: SummaryShift; movements: SummaryMovement[] }) {
  const openedBy = Array.isArray(shift.opened_by_profile) ? shift.opened_by_profile[0] : shift.opened_by_profile;
  const total = movements.reduce((s, m) => s + (m.type === 'ingreso' ? m.amount_local : -m.amount_local), 0);
  const groups = groupByReceipt(movements);
  const accountNames = new Map(movements.map((m) => [m.id, Array.isArray(m.account) ? m.account[0]?.name : m.account?.name]));

  return (
    <div className="print-area space-y-4">
      <div>
        <p className="font-display font-bold text-text">
          Caja {shift.kind === 'diaria' ? 'diaria' : 'general'} — {fmtDateTime(shift.opened_at)}
        </p>
        <p className="text-text-mute text-xs">Abrió {openedBy?.name ?? '—'}</p>
      </div>

      <div className="rounded-lg bg-surface-2 p-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-text-mute text-xs">Apertura</p>
          <p className="font-semibold text-text">{money(shift.opening_cash)}</p>
        </div>
        <div>
          <p className="text-text-mute text-xs">Contado</p>
          <p className="font-semibold text-text">{shift.counted_cash != null ? money(shift.counted_cash) : '—'}</p>
        </div>
        <div>
          <p className="text-text-mute text-xs">Diferencia</p>
          <p className={`font-semibold ${!shift.difference ? 'text-accent' : 'text-red'}`}>
            {shift.difference == null ? '—' : shift.difference === 0 ? 'Exacto' : money(shift.difference)}
          </p>
        </div>
        {shift.counted_usd != null && (
          <>
            <div>
              <p className="text-text-mute text-xs">Apertura US$</p>
              <p className="font-semibold text-text">US$ {Number(shift.opening_usd ?? 0).toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p className="text-text-mute text-xs">Contado US$</p>
              <p className="font-semibold text-text">US$ {Number(shift.counted_usd).toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p className="text-text-mute text-xs">Diferencia US$</p>
              <p className={`font-semibold ${!shift.difference_usd ? 'text-accent' : 'text-red'}`}>
                {shift.difference_usd == null ? '—' : shift.difference_usd === 0 ? 'Exacto' : `US$ ${Number(shift.difference_usd).toLocaleString('es-AR')}`}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border border-line overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-2 text-text-soft text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">Concepto</th>
              <th className="px-3 py-2 font-medium">Cuenta</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const first = g.rows[0];
              const accountLabel = g.rows.map((r) => accountNames.get(r.id) ?? '—').join(' + ');
              const totalLocal = [...g.byAccountLocal.values()].reduce((s, v) => s + v, 0);
              return (
                <tr key={g.key} className="border-t border-line">
                  <td className="px-3 py-2">{first.concept}</td>
                  <td className="px-3 py-2 text-text-soft">{accountLabel}</td>
                  <td className="px-3 py-2 text-text-soft">{fmtDateTime(first.created_at)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${totalLocal >= 0 ? 'text-accent' : 'text-red'}`}>
                    {totalLocal >= 0 ? '+' : ''}
                    {money(totalLocal)}
                  </td>
                </tr>
              );
            })}
            {groups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-text-mute">
                  Sin movimientos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between font-semibold text-text border-t border-line pt-2">
        <span>Total del turno</span>
        <span>{money(total)}</span>
      </div>
    </div>
  );
}
