'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { adjustGeneralStock } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function AdjustGeneralStockForm({ strainId, currentGrams, unit }: { strainId: string; currentGrams: number; unit: string }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await adjustGeneralStock(formData);
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
      <input type="hidden" name="strain_id" value={strainId} />
      <p className="text-sm text-text-soft">Stock general actual: {currentGrams} {unit}</p>
      <div>
        <label className={labelCls}>Movimiento</label>
        <select name="mode" className={inputCls} defaultValue="add">
          <option value="add">Ingreso de compra/cosecha (sumar)</option>
          <option value="remove">Merma (restar)</option>
          <option value="set">Fijar valor exacto</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Cantidad</label>
        <input name="value" type="number" min="0" step="0.1" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Nota (opcional)</label>
        <input name="note" className={inputCls} />
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : 'Ajustar stock general'}
      </button>
    </form>
  );
}
