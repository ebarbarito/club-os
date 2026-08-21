'use client';

import { money, fmtDateTime } from '@/lib/format';

type Item = { description: string; quantity: number; unit_price: number; bonif1_pct: number; bonif2_pct: number; total: number };
type Payment = { receipt_number: number; created_at: string; amount_local: number; account_name: string };

export function DispensaDetail({
  number,
  memberName,
  createdAt,
  items,
  payments,
  amount,
}: {
  number: number;
  memberName: string;
  createdAt: string;
  items: Item[];
  payments: Payment[];
  amount: number;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div className="print-area space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-text">Dispensa N° {number}</p>
            <p className="text-text-mute">
              {fmtDateTime(createdAt)} · {memberName}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-line overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-2 text-text-soft text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Artículo</th>
                <th className="px-3 py-2 font-medium">Cant.</th>
                <th className="px-3 py-2 font-medium">Precio</th>
                <th className="px-3 py-2 font-medium">Bonif.</th>
                <th className="px-3 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-2">{it.description}</td>
                  <td className="px-3 py-2">{it.quantity}</td>
                  <td className="px-3 py-2">{money(it.unit_price)}</td>
                  <td className="px-3 py-2">
                    {it.bonif1_pct || it.bonif2_pct ? `${it.bonif1_pct}% + ${it.bonif2_pct}%` : '—'}
                  </td>
                  <td className="px-3 py-2 font-medium">{money(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <p className="text-xs font-semibold text-text-mute uppercase mb-1">Pagos registrados</p>
          {payments.length === 0 ? (
            <p className="text-text-mute">Sin pagos.</p>
          ) : (
            <div className="space-y-1">
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    rec{String(p.receipt_number).padStart(2, '0')} · {p.account_name} ·{' '}
                    <span className="text-text-mute">{fmtDateTime(p.created_at)}</span>
                  </span>
                  <span>{money(p.amount_local)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between font-semibold text-text border-t border-line pt-2">
          <span>Total dispensa</span>
          <span>{money(amount)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.print()}
        className="print-hide w-full rounded-lg border border-line-2 text-text font-semibold text-sm py-2 hover:border-accent hover:text-accent"
      >
        Imprimir
      </button>
    </div>
  );
}
