'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { createAccount, updateAccount } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Account = {
  id: string;
  name: string;
  currency: string;
  exchange_rate: number;
  is_cash: boolean;
  active: boolean;
};

type Tax = { id: string; name: string; pct: number; applies_to: string };
type TaxLine = { name: string; pct: string; appliesTo: 'ingreso' | 'egreso' | 'ambos' };

export function AccountForm({ account, taxes }: { account?: Account; taxes?: Tax[] }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [taxLines, setTaxLines] = useState<TaxLine[]>(
    () => (taxes ?? []).map((t) => ({ name: t.name, pct: String(t.pct), appliesTo: t.applies_to as TaxLine['appliesTo'] })),
  );

  function updateTaxLine(i: number, patch: Partial<TaxLine>) {
    setTaxLines((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function addTaxLine() {
    setTaxLines((prev) => [...prev, { name: '', pct: '', appliesTo: 'ambos' }]);
  }
  function removeTaxLine(i: number) {
    setTaxLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(formData: FormData) {
    const validTaxes = taxLines.filter((t) => t.name.trim() && Number(t.pct) > 0);
    formData.set(
      'taxes',
      JSON.stringify(validTaxes.map((t) => ({ name: t.name.trim(), pct: Number(t.pct), applies_to: t.appliesTo }))),
    );
    startTransition(async () => {
      const res = account ? await updateAccount(formData) : await createAccount(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-3">
      {account && <input type="hidden" name="id" value={account.id} />}
      <div>
        <label className={labelCls}>Nombre</label>
        <input name="name" required defaultValue={account?.name} className={inputCls} placeholder="ej. Banco Provincia" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Moneda</label>
          <input name="currency" required defaultValue={account?.currency ?? 'ARS'} className={inputCls} placeholder="ARS, USD..." />
        </div>
        <div>
          <label className={labelCls}>Cotización default</label>
          <input
            name="exchange_rate"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={account?.exchange_rate ?? 1}
            className={inputCls}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-text-soft">
        <input type="checkbox" name="is_cash" defaultChecked={account?.is_cash ?? false} />
        Es efectivo físico (cuenta para el arqueo de Caja)
      </label>
      {account && (
        <label className="flex items-center gap-2 text-sm text-text-soft">
          <input type="checkbox" name="active" defaultChecked={account.active} />
          Activa
        </label>
      )}

      {account && (
        <div>
          <label className={labelCls}>Impuestos</label>
          <p className="text-xs text-text-mute mb-2">
            Se descuentan/suman solos en Caja en cada pago o cobro por esta cuenta — al socio siempre se le cobra el importe completo.
          </p>
          <div className="space-y-2">
            {taxLines.map((t, i) => (
              <div key={i} className="flex gap-2 items-center flex-wrap">
                <input
                  placeholder="Nombre (ej. IIBB)"
                  value={t.name}
                  onChange={(e) => updateTaxLine(i, { name: e.target.value })}
                  className={`${inputCls} flex-1 min-w-[8rem]`}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="%"
                  value={t.pct}
                  onChange={(e) => updateTaxLine(i, { pct: e.target.value })}
                  className={`${inputCls} w-20`}
                />
                <select
                  value={t.appliesTo}
                  onChange={(e) => updateTaxLine(i, { appliesTo: e.target.value as TaxLine['appliesTo'] })}
                  className={`${inputCls} w-32`}
                >
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                  <option value="ambos">Ambos</option>
                </select>
                <button type="button" onClick={() => removeTaxLine(i)} className="text-red text-xs font-semibold shrink-0">
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addTaxLine} className="text-accent text-xs font-semibold mt-2">
            + Agregar impuesto
          </button>
        </div>
      )}

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : account ? 'Guardar cambios' : 'Crear cuenta'}
      </button>
    </form>
  );
}
