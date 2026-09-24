'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { anularMovimientoCaja } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function AnularMovimientoForm({
  receiptNumber,
  concept,
}: {
  receiptNumber: number;
  concept: string;
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await anularMovimientoCaja(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-text-soft">
        <p className="font-medium text-text mb-1">Movimiento a anular</p>
        <p>{concept}</p>
        <p className="text-xs text-text-mute mt-1">Recibo #{receiptNumber}</p>
      </div>

      <p className="text-sm text-text-soft">
        Se insertarán contrapartidas contables que reviertan el efecto en todas las cuentas involucradas. El movimiento
        original quedará marcado como <span className="font-medium text-red">anulado</span> y el motivo quedará
        registrado en los Asientos.
      </p>

      <input type="hidden" name="receipt_number" value={receiptNumber} />
      <input type="hidden" name="concept" value={concept} />

      <div>
        <label className={labelCls}>
          Motivo <span className="text-red">*</span>
        </label>
        <input
          name="motivo"
          required
          placeholder="Ej: error de importe, cuenta incorrecta…"
          className={inputCls}
          autoFocus
        />
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-red text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Anulando…' : 'Anular movimiento'}
      </button>
    </form>
  );
}
