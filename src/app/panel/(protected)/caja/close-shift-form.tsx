'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { closeShift } from './actions';
import { money } from '@/lib/format';

const DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 200, 100, 50];

export function CloseShiftForm({ expected }: { expected: number }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});

  const total = DENOMINATIONS.reduce((sum, d) => sum + d * Number(counts[d] || 0), 0);
  const difference = total - expected;

  function submit() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('counted_cash', String(total));
      const res = await closeShift(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">Conteo de efectivo por denominación:</p>
      <div className="grid grid-cols-2 gap-2">
        {DENOMINATIONS.map((d) => (
          <div key={d} className="flex items-center gap-2">
            <span className="text-sm text-text-soft w-16">{money(d)}</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              className="w-full rounded-lg border border-line-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
              value={counts[d] ?? ''}
              onChange={(e) => setCounts((prev) => ({ ...prev, [d]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-surface-2 p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-text-soft">Total contado</span>
          <span className="font-semibold">{money(total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-soft">Efectivo esperado</span>
          <span className="font-semibold">{money(expected)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-soft">Diferencia</span>
          <span className={`font-semibold ${difference === 0 ? 'text-accent' : 'text-red'}`}>
            {difference === 0 ? 'Exacto' : money(difference)}
          </span>
        </div>
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Cerrando…' : 'Cerrar caja'}
      </button>
    </div>
  );
}
