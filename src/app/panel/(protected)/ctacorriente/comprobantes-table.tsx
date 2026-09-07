'use client';

import { useState } from 'react';
import { ModalTrigger } from '@/components/modal-trigger';
import { money, fmtDate } from '@/lib/format';
import type { PaymentAccount } from '@/components/payment-split';
import { DispensaDetail } from './dispensa-detail';
import { BatchCobroForm } from './batch-cobro-form';

type Item = { description: string; quantity: number; unit_price: number; bonif1_pct: number; bonif2_pct: number; total: number };
type Payment = { receipt_number: number; created_at: string; amount_local: number; account_name: string };
type Comprobante = {
  id: string;
  number: number;
  created_at: string;
  amount: number;
  adeudado: number;
  esCuotaSocial: boolean;
  items: Item[];
  payments: Payment[];
};

const inputCls = 'w-24 rounded-lg border border-line-2 px-2 py-1 text-sm text-right outline-none focus:border-accent';

export function ComprobantesTable({
  comprobantes,
  memberName,
  accounts,
}: {
  comprobantes: Comprobante[];
  memberName: string;
  accounts: PaymentAccount[];
}) {
  const [cobros, setCobros] = useState<Record<string, string>>({});

  const totalAdeudado = comprobantes.reduce((s, c) => s + c.adeudado, 0);
  const allocations = comprobantes
    .map((c) => ({ dispensaId: c.id, number: c.number, amount: Math.min(Number(cobros[c.id]) || 0, c.adeudado) }))
    .filter((a) => a.amount > 0);
  const totalCobro = allocations.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="rounded-xl border border-line bg-surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-text-soft text-left">
          <tr>
            <th className="px-4 py-2.5 font-medium">Fecha</th>
            <th className="px-4 py-2.5 font-medium">Comprobante</th>
            <th className="px-4 py-2.5 font-medium">Importe</th>
            <th className="px-4 py-2.5 font-medium">Adeudado</th>
            <th className="px-4 py-2.5 font-medium text-right">Cobro</th>
          </tr>
        </thead>
        <tbody>
          {comprobantes.map((c) => (
            <tr key={c.id} className="border-t border-line">
              <td className="px-4 py-2.5 text-text-soft">{fmtDate(c.created_at)}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <ModalTrigger label={`N° ${c.number}`} className="text-accent text-sm font-medium hover:underline" title="Detalle del comprobante">
                    <DispensaDetail number={c.number} memberName={memberName} createdAt={c.created_at} items={c.items} payments={c.payments} amount={c.amount} />
                  </ModalTrigger>
                  {c.esCuotaSocial && (
                    <span className="rounded-full bg-amber-bg text-amber-tx text-xs font-semibold px-2 py-0.5">Cuota social</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2.5 text-text-soft">{money(c.amount)}</td>
              <td className="px-4 py-2.5 font-medium text-red">{money(c.adeudado)}</td>
              <td className="px-4 py-2.5 text-right">
                <input
                  type="number"
                  min="0"
                  max={c.adeudado}
                  step="0.01"
                  placeholder="0"
                  value={cobros[c.id] ?? ''}
                  onChange={(e) => setCobros((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  className={inputCls}
                />
              </td>
            </tr>
          ))}
          {comprobantes.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-text-mute">
                Este socio no tiene comprobantes adeudados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {comprobantes.length > 0 && (
        <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-6">
            <div>
              <p className="text-text-mute text-xs">Total adeudado</p>
              <p className="font-semibold text-text">{money(totalAdeudado)}</p>
            </div>
            <div>
              <p className="text-text-mute text-xs">Total a cobrar</p>
              <p className="font-semibold text-text">{money(totalCobro)}</p>
            </div>
          </div>
          {totalCobro > 0 ? (
            <ModalTrigger label="Forma de pago" className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2" title="Cobrar">
              <BatchCobroForm allocations={allocations} accounts={accounts} />
            </ModalTrigger>
          ) : (
            <button type="button" disabled className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 opacity-40 cursor-not-allowed">
              Forma de pago
            </button>
          )}
        </div>
      )}
    </div>
  );
}
