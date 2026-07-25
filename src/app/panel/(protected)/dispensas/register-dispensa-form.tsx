'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { registerDispensa } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Member = { id: string; name: string; dni: string };
type Strain = { id: string; name: string; price_per_gram: number; grams: number };

export function RegisterDispensaForm({ members, strains }: { members: Member[]; strains: Strain[] }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
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
        <select name="strain_id" required className={inputCls}>
          {strains.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · disponible {s.grams} g · ${s.price_per_gram}/g
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Gramos</label>
          <input name="grams" type="number" min="0.1" step="0.1" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Medio de pago</label>
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
        {pending ? 'Registrando…' : 'Registrar dispensa'}
      </button>
    </form>
  );
}
