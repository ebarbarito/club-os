'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { closeCiclo } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';

type Strain = { id: string; name: string };
type SalaStrain = { strainId: string; strainName: string; plants: number };
type Row = { strainId: string; grams: string };

export function CloseCicloForm({
  salaId,
  salaStrains,
  strains,
}: {
  salaId: string;
  salaStrains: SalaStrain[];
  strains: Strain[];
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Prellenado con las genéticas configuradas en la sala — el admin solo
  // completa cuánto se cosechó de cada una.
  const [rows, setRows] = useState<Row[]>(
    salaStrains.length > 0
      ? salaStrains.map((s) => ({ strainId: s.strainId, grams: '' }))
      : [{ strainId: strains[0]?.id ?? '', grams: '' }],
  );

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function submit() {
    setError(null);
    const items = rows
      .filter((r) => r.strainId && Number(r.grams) > 0)
      .map((r) => ({ strain_id: r.strainId, grams: Number(r.grams) }));
    if (items.length === 0) {
      setError('Cargá al menos una genética con gramos.');
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set('sala_id', salaId);
      formData.set('items', JSON.stringify(items));
      const res = await closeCiclo(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  if (strains.length === 0) {
    return <p className="text-text-soft text-sm">Cargá al menos una genética en Stock antes de cerrar un ciclo.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">Rendimiento cosechado por genética — se suma directo al stock.</p>

      {rows.map((row, i) => {
        const configured = salaStrains.find((s) => s.strainId === row.strainId);
        return (
          <div key={i}>
            <div className="flex gap-2">
              <select
                className={inputCls}
                value={row.strainId}
                onChange={(e) => updateRow(i, { strainId: e.target.value })}
              >
                {strains.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Gramos cosechados"
                className={inputCls}
                value={row.grams}
                onChange={(e) => updateRow(i, { grams: e.target.value })}
              />
            </div>
            {configured && <p className="text-text-mute text-xs mt-1">{configured.plants} plantas cargadas en esta sala</p>}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { strainId: strains[0]?.id ?? '', grams: '' }])}
        className="text-sm text-accent font-semibold"
      >
        + Agregar otra genética
      </button>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Cerrando ciclo…' : 'Confirmar cierre de ciclo'}
      </button>
    </div>
  );
}
