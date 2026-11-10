'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { guardarMedicoClub } from './actions';
import { CAMPOS_MEDICO, type MedicoClub } from '@/lib/alta/medico';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';

export function MedicoClubForm({ medico }: { medico: MedicoClub }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [estado, setEstado] = useState<'idle' | 'ok'>('idle');
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    setEstado('idle');
    startTransition(async () => {
      const res = await guardarMedicoClub(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEstado('ok');
      router.refresh();
    });
  }

  return (
    <form action={submit} onChange={() => setEstado('idle')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CAMPOS_MEDICO.map((c) => (
          <div key={c.key}>
            <label className="block text-xs font-medium text-text-soft mb-1">{c.label}</label>
            <input name={c.key} defaultValue={medico[c.key] ?? ''} placeholder={c.placeholder} className={inputCls} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-white font-semibold text-sm px-4 py-2 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar médico'}
        </button>
        {estado === 'ok' && <span className="text-accent text-sm">Guardado ✓</span>}
        {error && <span className="text-red text-sm">{error}</span>}
      </div>
    </form>
  );
}
