'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { createStrain, updateStrain } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Strain = {
  id: string;
  name: string;
  type: string;
  thc: number | null;
  cbd: number | null;
  price_per_gram: number;
  status: 'activa' | 'sin_stock' | 'inactiva';
  cross_info: string | null;
  composition: string | null;
  aroma: string | null;
  effects: string | null;
  notes: string | null;
  description: string | null;
};

export function StrainForm({ strain }: { strain?: Strain }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = strain ? await updateStrain(formData) : await createStrain(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="grid grid-cols-2 gap-3">
      {strain && <input type="hidden" name="id" value={strain.id} />}
      <div className="col-span-2">
        <label className={labelCls}>Nombre</label>
        <input name="name" required defaultValue={strain?.name} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Tipo</label>
        <select name="type" className={inputCls} defaultValue={strain?.type ?? 'Híbrida'}>
          <option>Indica</option>
          <option>Sativa</option>
          <option>Híbrida</option>
          <option>Alto CBD</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Precio por gramo</label>
        <input
          name="price_per_gram"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={strain?.price_per_gram}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>THC %</label>
        <input name="thc" type="number" min="0" max="100" step="0.1" defaultValue={strain?.thc ?? ''} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>CBD %</label>
        <input name="cbd" type="number" min="0" max="100" step="0.1" defaultValue={strain?.cbd ?? ''} className={inputCls} />
      </div>

      <div className="col-span-2 border-t border-line pt-3 mt-1">
        <p className="text-xs font-semibold text-text-mute uppercase mb-2">Ficha técnica (opcional)</p>
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Cruza</label>
        <input name="cross_info" defaultValue={strain?.cross_info ?? ''} className={inputCls} placeholder="ej. Sandía x Yeti" />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Composición</label>
        <input
          name="composition"
          defaultValue={strain?.composition ?? ''}
          className={inputCls}
          placeholder="ej. 40% Indica / 60% Sativa"
        />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Sabor y aroma</label>
        <input name="aroma" defaultValue={strain?.aroma ?? ''} className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Efectos</label>
        <input name="effects" defaultValue={strain?.effects ?? ''} className={inputCls} placeholder="ej. Cerebral · Eufórico · Social" />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Notas de cultivo</label>
        <textarea name="notes" defaultValue={strain?.notes ?? ''} rows={2} className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Descripción</label>
        <textarea
          name="description"
          defaultValue={strain?.description ?? ''}
          rows={3}
          className={inputCls}
          placeholder="Texto libre para mostrar en la ficha del sitio público"
        />
      </div>

      {strain && (
        <div className="col-span-2">
          <label className={labelCls}>Estado</label>
          <select name="status" className={inputCls} defaultValue={strain.status}>
            <option value="activa">Activa</option>
            <option value="sin_stock">Sin stock (visible, no reservable)</option>
            <option value="inactiva">Inactiva (oculta del sitio público)</option>
          </select>
        </div>
      )}

      {error && <p className="col-span-2 text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : strain ? 'Guardar cambios' : 'Crear genética'}
      </button>
    </form>
  );
}
