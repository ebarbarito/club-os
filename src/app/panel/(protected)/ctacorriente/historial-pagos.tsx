'use client';

import { useState, useTransition } from 'react';
import { money, fmtDateTime } from '@/lib/format';
import { anularPagoDispensa } from './actions';

export type HistorialEntry = {
  date: string;
  label: string;
  amount: number;
  voided: boolean;
  receiptNumber?: number;
  dispensaId?: string;
};

function AnularPagoInline({
  receiptNumber,
  dispensaId,
  label,
}: {
  receiptNumber: number;
  dispensaId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!motivo.trim()) { setError('Ingresá un motivo'); return; }
    startTransition(async () => {
      const res = await anularPagoDispensa(receiptNumber, dispensaId, motivo);
      if (res?.error) { setError(res.error); return; }
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-2 text-xs text-red border border-red/30 rounded px-1.5 py-0.5 hover:bg-red/10 shrink-0"
      >
        Anular
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-1 rounded-lg border border-red/30 bg-red/5 p-2">
      <p className="text-xs text-text-soft">Anular: {label}</p>
      <textarea
        autoFocus
        value={motivo}
        onChange={(e) => { setMotivo(e.target.value); setError(''); }}
        placeholder="Motivo de la anulación…"
        rows={2}
        className="w-full rounded border border-line-2 px-2 py-1 text-xs outline-none focus:border-red resize-none"
      />
      {error && <p className="text-xs text-red">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded bg-red text-white text-xs font-semibold py-1 disabled:opacity-50"
        >
          {isPending ? 'Anulando…' : 'Confirmar anulación'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setMotivo(''); setError(''); }}
          className="flex-1 rounded border border-line-2 text-text text-xs font-semibold py-1"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function HistorialPagos({ entries }: { entries: HistorialEntry[] }) {
  if (entries.length === 0) return null;

  // Track which receipt_numbers already showed an Anular button
  const shownReceipts = new Set<number>();

  return (
    <details className="rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-text">
        Historial de movimientos ({entries.length})
      </summary>
      <div className="border-t border-line divide-y divide-line">
        {entries.map((h, i) => {
          const isPayment = h.receiptNumber != null && h.dispensaId != null && h.amount < 0;
          const showAnular = isPayment && !h.voided && !shownReceipts.has(h.receiptNumber!);
          if (showAnular) shownReceipts.add(h.receiptNumber!);

          return (
            <div key={i} className={`px-4 py-2 text-sm ${h.voided ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-center gap-2">
                <span className="text-text-soft flex-1 min-w-0">
                  {fmtDateTime(h.date)} · {h.label}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`font-medium ${h.amount >= 0 ? 'text-text' : 'text-accent'}`}>
                    {h.amount >= 0 ? '+' : ''}
                    {money(h.amount)}
                  </span>
                  {showAnular && (
                    <AnularPagoInline
                      receiptNumber={h.receiptNumber!}
                      dispensaId={h.dispensaId!}
                      label={h.label}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
