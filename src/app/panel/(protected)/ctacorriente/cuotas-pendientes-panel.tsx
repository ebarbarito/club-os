'use client';

import { useState, useTransition } from 'react';
import { money } from '@/lib/format';
import { PaymentSplitEditor, newPaymentLine, type PaymentLine, type PaymentAccount } from '@/components/payment-split';
import { cobrarCuotasSocialesDesdeCtaCte } from './actions';

export type PendingCuotaCargo = {
  id: string;
  periodo: string; // 'YYYY-MM-DD'
  amount: number;
  paid_amount: number;
};

function formatPeriodo(periodo: string): string {
  const d = new Date(periodo + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

export function CuotasPendientesPanel({
  memberId,
  cargos,
  accounts,
}: {
  memberId: string;
  cargos: PendingCuotaCargo[];
  accounts: PaymentAccount[];
}) {
  const [open, setOpen] = useState(false);
  const [cobros, setCobros] = useState<Record<string, string>>({});
  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (cargos.length === 0) return null;

  const totalCobros = cargos.reduce((s, c) => s + (Number(cobros[c.id]) || 0), 0);
  const totalPago = payments.reduce((s, p) => s + (Number(p.amount) || 0) * (Number(p.exchangeRate) || 1), 0);

  function cobrar() {
    setError(null);
    const cobrosList = cargos
      .map((c) => ({ charge_id: c.id, amount: Number(cobros[c.id]) || 0 }))
      .filter((c) => c.amount > 0);
    if (cobrosList.length === 0) { setError('Ingresá al menos un importe a cobrar'); return; }
    const validPayments = payments.filter((p) => Number(p.amount) > 0);
    if (validPayments.length === 0) { setError('Elegí una forma de pago'); return; }

    const formData = new FormData();
    formData.set('member_id', memberId);
    formData.set('cobros', JSON.stringify(cobrosList));
    formData.set('payments', JSON.stringify(validPayments.map((p) => ({
      account_id: p.accountId,
      amount: Number(p.amount),
      exchange_rate: Number(p.exchangeRate) || 1,
    }))));

    startTransition(async () => {
      const res = await cobrarCuotasSocialesDesdeCtaCte(formData);
      if (res?.error) { setError(res.error); return; }
      setCobros({});
      setPayments([newPaymentLine(accounts)]);
      setOpen(false);
    });
  }

  return (
    <div className="rounded-xl border border-red/30 bg-surface overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => { setOpen((v) => !v); setError(null); }}
      >
        <span className="font-semibold text-text">
          ⚠ Cuota social adeudada ({cargos.length} período{cargos.length > 1 ? 's' : ''})
        </span>
        <span className="text-xs text-red/70">{open ? '▲ cerrar' : '▼ cobrar'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-line">
          <table className="w-full text-sm mt-3">
            <thead className="text-left text-text-soft">
              <tr>
                <th className="py-1.5 font-medium">Período</th>
                <th className="py-1.5 font-medium text-right">Total</th>
                <th className="py-1.5 font-medium text-right">Pendiente</th>
                <th className="py-1.5 font-medium text-right">Cobro</th>
              </tr>
            </thead>
            <tbody>
              {cargos.map((c) => {
                const pendiente = c.amount - c.paid_amount;
                return (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-2 text-text">{formatPeriodo(c.periodo)}</td>
                    <td className="py-2 text-right text-text-soft">{money(c.amount)}</td>
                    <td className="py-2 text-right font-medium text-red">{money(pendiente)}</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max={pendiente}
                        step="0.01"
                        placeholder="0"
                        value={cobros[c.id] ?? ''}
                        onChange={(e) => setCobros((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        className="w-24 rounded-lg border border-line-2 px-2 py-1 text-sm text-right outline-none focus:border-accent"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalCobros > 0 && (
            <p className="text-sm text-text-soft">
              Total a cobrar: <span className="font-semibold text-text">{money(totalCobros)}</span>
            </p>
          )}

          <div>
            <p className="text-xs font-medium text-text-soft mb-1">Forma de pago</p>
            <PaymentSplitEditor accounts={accounts} lines={payments} onChange={setPayments} />
          </div>

          {error && <p className="text-red text-xs">{error}</p>}

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-text-mute">
              {totalPago > 0 && totalCobros > 0
                ? `Pago: ${money(totalPago)} · Cobros: ${money(totalCobros)}`
                : ''}
            </p>
            <button
              type="button"
              disabled={pending || totalCobros <= 0}
              onClick={cobrar}
              className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-40"
            >
              {pending ? 'Procesando…' : 'Aceptar cobro'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
