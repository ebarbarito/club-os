import { createClient } from '@/lib/supabase/server';
import { money, fmtDateTime } from '@/lib/format';
import { PrintButton } from './print-button';

export async function ShiftSummary({ shiftId }: { shiftId: string }) {
  const supabase = await createClient();
  const [{ data: shift }, { data: movements }] = await Promise.all([
    supabase.from('caja_shifts').select('*, opened_by_profile:profiles(name)').eq('id', shiftId).maybeSingle(),
    supabase
      .from('ledger')
      .select('id, type, category, concept, amount_local, created_at, account:payment_accounts(name)')
      .eq('shift_id', shiftId)
      .order('created_at'),
  ]);

  if (!shift) return <p className="text-text-mute text-sm">Turno no encontrado.</p>;

  const openedBy = Array.isArray(shift.opened_by_profile) ? shift.opened_by_profile[0] : shift.opened_by_profile;
  const total = (movements ?? []).reduce((s, m) => s + (m.type === 'ingreso' ? m.amount_local : -m.amount_local), 0);

  return (
    <div className="space-y-4 text-sm">
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
              {(movements ?? []).map((m) => {
                const account = Array.isArray(m.account) ? m.account[0] : m.account;
                return (
                  <tr key={m.id} className="border-t border-line">
                    <td className="px-3 py-2">{m.concept}</td>
                    <td className="px-3 py-2 text-text-soft">{account?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-text-soft">{fmtDateTime(m.created_at)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${m.type === 'ingreso' ? 'text-accent' : 'text-red'}`}>
                      {m.type === 'ingreso' ? '+' : '-'}
                      {money(m.amount_local)}
                    </td>
                  </tr>
                );
              })}
              {(movements ?? []).length === 0 && (
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

      <PrintButton />
    </div>
  );
}
