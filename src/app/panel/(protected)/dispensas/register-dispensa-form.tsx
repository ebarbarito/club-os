'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { money } from '@/lib/format';
import { registerDispensa } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Member = { id: string; name: string; dni: string };
type Strain = { id: string; name: string; price_per_gram: number; grams: number };
type PaymentLine = { method: string; amount: string };

export function RegisterDispensaForm({ members, strains }: { members: Member[]; strains: Strain[] }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [strainId, setStrainId] = useState(strains[0]?.id ?? '');
  const [grams, setGrams] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: 'efectivo', amount: '' }]);
  const [amountTouched, setAmountTouched] = useState(false);

  const selectedStrain = strains.find((s) => s.id === strainId);
  const suggestedAmount = useMemo(() => {
    const g = Number(grams);
    if (!selectedStrain || !g) return 0;
    return g * selectedStrain.price_per_gram;
  }, [selectedStrain, grams]);

  // Mientras haya una sola línea y nadie la tocó a mano, se sincroniza
  // con el monto sugerido — apenas se edita o se agrega otra línea, deja
  // de auto-completarse (así se puede dividir el cobro libremente).
  const displayPayments =
    !amountTouched && payments.length === 1 ? [{ ...payments[0], amount: String(suggestedAmount || '') }] : payments;

  const total = displayPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const difference = total - suggestedAmount;

  function updateLine(i: number, patch: Partial<PaymentLine>) {
    setAmountTouched(true);
    setPayments((prev) => {
      const base = !amountTouched && prev.length === 1 ? displayPayments : prev;
      return base.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    });
  }

  function addLine() {
    setAmountTouched(true);
    setPayments((prev) => [...(prev.length === 1 && !amountTouched ? displayPayments : prev), { method: 'transferencia', amount: '' }]);
  }

  function removeLine(i: number) {
    setPayments((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(formData: FormData) {
    const validPayments = displayPayments.filter((p) => Number(p.amount) > 0);
    if (validPayments.length === 0) {
      setError('Cargá al menos un medio de pago con un monto mayor a 0');
      return;
    }
    formData.set('suggested_amount', String(suggestedAmount));
    formData.set('payments', JSON.stringify(validPayments.map((p) => ({ method: p.method, amount: Number(p.amount) }))));

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
  if (strains.length === 0) {
    return <p className="text-text-soft text-sm">No hay stock cargado. Cargá stock primero.</p>;
  }

  return (
    <form action={submit} className="space-y-3">
      <div>
        <label className={labelCls}>Socio (válido)</label>
        <select name="member_id" required className={inputCls}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · DNI {m.dni}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Genética</label>
        <select
          name="strain_id"
          required
          value={strainId}
          onChange={(e) => setStrainId(e.target.value)}
          className={inputCls}
        >
          {strains.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · disponible {s.grams} g · {money(s.price_per_gram)}/g
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Gramos</label>
        <input
          name="grams"
          type="number"
          min="0.1"
          step="0.1"
          required
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="rounded-lg bg-surface-2 p-3 text-sm space-y-1">
        <div className="flex justify-between text-text-soft">
          <span>Precio sugerido por gramo</span>
          <span>{selectedStrain ? money(selectedStrain.price_per_gram) : '—'}</span>
        </div>
        <div className="flex justify-between text-text-soft">
          <span>Monto sugerido</span>
          <span>{money(suggestedAmount)}</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Cobro (podés dividir en más de un medio de pago)</label>
        </div>
        <div className="space-y-2">
          {displayPayments.map((p, i) => (
            <div key={i} className="flex gap-2">
              <select
                value={p.method}
                onChange={(e) => updateLine(i, { method: e.target.value })}
                className={inputCls}
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Monto"
                value={p.amount}
                onChange={(e) => updateLine(i, { amount: e.target.value })}
                className={inputCls}
              />
              {displayPayments.length > 1 && (
                <button type="button" onClick={() => removeLine(i)} className="text-red text-xs shrink-0">
                  Quitar
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addLine} className="text-accent text-xs font-semibold mt-2">
          + Dividir en otro medio de pago
        </button>
      </div>

      <div className="rounded-lg bg-surface-2 p-3 text-sm flex justify-between">
        <span className="text-text-soft">Total a cobrar</span>
        <span className="font-semibold text-text">
          {money(total)}
          {difference !== 0 && (
            <span className={difference > 0 ? 'text-accent' : 'text-red'}> ({difference > 0 ? '+' : ''}{money(difference)} vs. sugerido)</span>
          )}
        </span>
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Registrando…' : 'Registrar dispensa'}
      </button>
    </form>
  );
}
