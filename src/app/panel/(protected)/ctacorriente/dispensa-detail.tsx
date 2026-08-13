import { money, fmtDateTime } from '@/lib/format';

type Item = { description: string; quantity: number; unit_price: number; bonif1_pct: number; bonif2_pct: number; total: number };
type Payment = { amount_local: number; account_name: string };

export function DispensaDetail({
  createdAt,
  items,
  payments,
  amount,
}: {
  createdAt: string;
  items: Item[];
  payments: Payment[];
  amount: number;
}) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-text-mute">{fmtDateTime(createdAt)}</p>

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
          payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{p.account_name}</span>
              <span>{money(p.amount_local)}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-between font-semibold text-text border-t border-line pt-2">
        <span>Total dispensa</span>
        <span>{money(amount)}</span>
      </div>
    </div>
  );
}
