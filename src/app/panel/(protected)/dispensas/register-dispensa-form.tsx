'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { money } from '@/lib/format';
import { MemberSearch, type SearchableMember } from '@/components/member-search';
import { PaymentSplitEditor, newPaymentLine, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { registerDispensa } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type CatalogItem = { id: string; code: string | null; name: string; item_type: 'genetica' | 'accesorio'; price_per_gram: number; grams: number };
type ItemRow = { strainId: string; description: string; quantity: string; unitPrice: string; bonif1: string; bonif2: string };

function lineTotal(row: ItemRow): number {
  const qty = Number(row.quantity) || 0;
  const price = Number(row.unitPrice) || 0;
  const b1 = Number(row.bonif1) || 0;
  const b2 = Number(row.bonif2) || 0;
  return qty * price * (1 - b1 / 100) * (1 - b2 / 100);
}

export function RegisterDispensaForm({
  members,
  items,
  accounts,
}: {
  members: SearchableMember[];
  items: CatalogItem[];
  accounts: PaymentAccount[];
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [memberId, setMemberId] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([
    { strainId: '', description: '', quantity: '', unitPrice: '', bonif1: '0', bonif2: '0' },
  ]);
  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);

  const suggestedTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const item = items.find((it) => it.id === r.strainId);
      const qty = Number(r.quantity) || 0;
      return sum + qty * (item?.price_per_gram ?? 0);
    }, 0);
  }, [rows, items]);

  const realTotal = rows.reduce((sum, r) => sum + lineTotal(r), 0);
  const paidTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0) * (Number(p.exchangeRate) || 0), 0);

  function updateRow(i: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function selectItem(i: number, strainId: string) {
    const item = items.find((it) => it.id === strainId);
    updateRow(i, { strainId, description: item?.name ?? '', unitPrice: item ? String(item.price_per_gram) : '' });
  }

  function addRow() {
    setRows((prev) => [...prev, { strainId: '', description: '', quantity: '', unitPrice: '', bonif1: '0', bonif2: '0' }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit() {
    setError(null);
    if (!memberId) {
      setError('Elegí un socio');
      return;
    }
    const validRows = rows.filter((r) => r.strainId && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      setError('Cargá al menos un artículo');
      return;
    }
    const validPayments = payments.filter((p) => Number(p.amount) > 0);
    if (validPayments.length === 0) {
      setError('Cargá al menos un medio de pago');
      return;
    }

    const formData = new FormData();
    formData.set('member_id', memberId);
    formData.set('suggested_amount', String(suggestedTotal));
    formData.set(
      'items',
      JSON.stringify(
        validRows.map((r) => ({
          strain_id: r.strainId,
          description: r.description,
          quantity: Number(r.quantity),
          unit_price: Number(r.unitPrice) || 0,
          bonif1_pct: Number(r.bonif1) || 0,
          bonif2_pct: Number(r.bonif2) || 0,
        })),
      ),
    );
    formData.set(
      'payments',
      JSON.stringify(
        validPayments.map((p) => ({
          account_id: p.accountId,
          amount: Number(p.amount),
          exchange_rate: Number(p.exchangeRate) || 1,
        })),
      ),
    );

    startTransition(async () => {
      const res = await registerDispensa(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  if (members.length === 0) {
    return <p className="text-text-soft text-sm">No hay socios validados para dispensar.</p>;
  }
  if (items.length === 0) {
    return <p className="text-text-soft text-sm">No hay artículos con stock cargado. Cargá stock primero.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Socio (válido)</label>
        <MemberSearch members={members} value={memberId} onChange={setMemberId} />
      </div>

      <div>
        <label className={labelCls}>Artículos</label>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="rounded-lg border border-line-2 p-2 space-y-1.5">
              <div className="flex gap-1.5">
                <select value={row.strainId} onChange={(e) => selectItem(i, e.target.value)} className={`${inputCls} flex-1`}>
                  <option value="">Elegir artículo…</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code ? `${it.code} · ` : ''}
                      {it.name} · disp. {it.grams} {it.item_type === 'genetica' ? 'g' : 'u.'} · {money(it.price_per_gram)}
                    </option>
                  ))}
                </select>
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} className="text-red text-xs shrink-0">
                    Quitar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Cant."
                  value={row.quantity}
                  onChange={(e) => updateRow(i, { quantity: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Precio"
                  value={row.unitPrice}
                  onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Bonif. 1 %"
                  value={row.bonif1}
                  onChange={(e) => updateRow(i, { bonif1: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Bonif. 2 %"
                  value={row.bonif2}
                  onChange={(e) => updateRow(i, { bonif2: e.target.value })}
                  className={inputCls}
                />
              </div>
              <p className="text-text-mute text-xs text-right">Total línea: {money(lineTotal(row))}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="text-accent text-xs font-semibold mt-2">
          + Agregar artículo
        </button>
      </div>

      <div className="rounded-lg bg-surface-2 p-3 text-sm space-y-1">
        <div className="flex justify-between text-text-soft">
          <span>Total sugerido (precio de catálogo)</span>
          <span>{money(suggestedTotal)}</span>
        </div>
        <div className="flex justify-between font-semibold text-text">
          <span>Total dispensa</span>
          <span>{money(realTotal)}</span>
        </div>
      </div>

      <div>
        <label className={labelCls}>Forma de pago</label>
        <PaymentSplitEditor accounts={accounts} lines={payments} onChange={setPayments} />
        {Math.abs(paidTotal - realTotal) > 0.01 && (
          <p className="text-amber-tx text-xs mt-1">
            Lo cargado en pagos ({money(paidTotal)}) no coincide con el total de la dispensa — la diferencia queda en
            cuenta corriente del socio.
          </p>
        )}
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Registrando…' : 'Registrar dispensa'}
      </button>
    </div>
  );
}
