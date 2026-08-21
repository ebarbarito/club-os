'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { sendStock } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function SendStockForm({
  strainId,
  strainName,
  unit,
  available,
}: {
  strainId: string;
  strainName: string;
  unit: string;
  available: number;
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await sendStock(formData);
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
      <p className="text-sm text-text-soft">
        {strainName} · disponible en general: {available} {unit}
      </p>
      <div>
        <label className={labelCls}>Cantidad</label>
        <input name="quantity" type="number" min="0.01" step="0.01" max={available} required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Clasificación</label>
        <select name="type" className={inputCls} defaultValue="envio_dispensa">
          <option value="envio_dispensa">Dispensa (suma en sala dispensa)</option>
          <option value="envio_muestra">Muestra (no suma en sala dispensa)</option>
        </select>
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
        {pending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  );
}
