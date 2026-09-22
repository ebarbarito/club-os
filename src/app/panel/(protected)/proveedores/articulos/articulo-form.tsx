'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { createArticulo, updateArticulo } from '../actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Articulo = { id: string; code: string | null; description: string; unit: string | null; notes: string | null };

export function ArticuloForm({ articulo }: { articulo?: Articulo }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = articulo
        ? await updateArticulo(articulo.id, formData)
        : await createArticulo(formData);
      if (res?.error) { setError(res.error); return; }
      close();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Código</label>
          <input name="code" defaultValue={articulo?.code ?? ''} className={inputCls} placeholder="Ej: ART-001" />
        </div>
        <div>
          <label className={labelCls}>Unidad</label>
          <input name="unit" defaultValue={articulo?.unit ?? ''} className={inputCls} placeholder="Ej: kg, lt, u" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Descripción *</label>
        <input name="description" required defaultValue={articulo?.description ?? ''} className={inputCls} placeholder="Nombre del artículo" />
      </div>
      <div>
        <label className={labelCls}>Notas</label>
        <textarea name="notes" rows={2} defaultValue={articulo?.notes ?? ''} className={inputCls} />
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : articulo ? 'Guardar cambios' : 'Crear artículo'}
      </button>
    </form>
  );
}
