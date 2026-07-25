'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { addMovement } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

const CATEGORIES = ['Insumos', 'Alquiler', 'Servicios', 'Membresía', 'Operativo', 'Otro'];

export function MovementForm({ type }: { type: 'ingreso' | 'egreso' }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    formData.set('type', type);
    startTransition(async () => {
      const res = await addMovement(formData);
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
      <div>
        <label className={labelCls}>Categoría</label>
        <select name="category" className={inputCls} defaultValue={CATEGORIES[0]}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Concepto</label>
        <input name="concept" required className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Monto</label>
          <input name="amount" type="number" min="0" step="1" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Medio</label>
          <select name="method" className={inputCls} defaultValue="efectivo">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : type === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}
      </button>
    </form>
  );
}
