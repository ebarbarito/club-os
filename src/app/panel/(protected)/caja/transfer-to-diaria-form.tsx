'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { money } from '@/lib/format';
import { transferGeneralToDiaria } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function TransferToDiariaForm({ availableCash, availableUsd }: { availableCash: number; availableUsd: number }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [usdAmount, setUsdAmount] = useState('');

  function submit() {
    setError(null);
    const cash = Number(cashAmount) || 0;
    const usd = Number(usdAmount) || 0;
    if (cash <= 0 && usd <= 0) {
      setError('Cargá un monto en pesos o en dólares');
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set('cash_amount', String(cash));
      formData.set('usd_amount', String(usd));
      const res = await transferGeneralToDiaria(formData);
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
      <p className="text-sm text-text-soft">
        Disponible en caja general: {money(availableCash)} · US$ {availableUsd.toLocaleString('es-AR')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Pesos</label>
          <input type="number" min="0" max={availableCash} step="1" placeholder="0" className={inputCls} value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Dólares</label>
          <input type="number" min="0" max={availableUsd} step="0.01" placeholder="0" className={inputCls} value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} />
        </div>
      </div>
      <p className="text-text-mute text-xs">Genera un egreso acá y un ingreso en Caja diaria, en el mismo momento.</p>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Enviando…' : 'Enviar a caja diaria'}
      </button>
    </div>
  );
}
