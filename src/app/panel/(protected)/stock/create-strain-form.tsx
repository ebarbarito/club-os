'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { createStrain } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function CreateStrainForm() {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await createStrain(formData);
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
        <label className={labelCls}>Nombre</label>
        <input name="name" required className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipo</label>
          <select name="type" className={inputCls} defaultValue="Híbrida">
            <option>Indica</option>
            <option>Sativa</option>
            <option>Híbrida</option>
            <option>Alto CBD</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Precio por gramo</label>
          <input name="price_per_gram" type="number" min="0" step="1" required className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Stock inicial (g)</label>
          <input name="grams" type="number" min="0" step="0.1" defaultValue={0} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Stock mínimo (g)</label>
          <input name="min_grams" type="number" min="0" step="0.1" defaultValue={0} className={inputCls} />
        </div>
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Creando…' : 'Agregar genética'}
      </button>
    </form>
  );
}
