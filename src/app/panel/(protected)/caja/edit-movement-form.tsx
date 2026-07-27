'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { editMovement } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

const CATEGORIES = ['Insumos', 'Alquiler', 'Servicios', 'Membresía', 'Operativo', 'Otro'];

type Movement = { id: string; category: string; concept: string; amount: number; method: string };

export function EditMovementForm({ movement }: { movement: Movement }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    formData.set('id', movement.id);
    startTransition(async () => {
      const res = await editMovement(formData);
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
        <select name="category" className={inputCls} defaultValue={movement.category}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Concepto</label>
        <input name="concept" required defaultValue={movement.concept} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Monto</label>
          <input name="amount" type="number" min="0" step="1" required defaultValue={movement.amount} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Medio</label>
          <select name="method" className={inputCls} defaultValue={movement.method}>
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
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
