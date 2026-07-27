'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { completeDelivery } from './actions';

export function ConfirmDeliveryForm({ orderId, defaultMethod }: { orderId: string; defaultMethod: string | null }) {
  const router = useRouter();
  const close = useModalClose();
  const [method, setMethod] = useState(defaultMethod ?? 'efectivo');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      const res = await completeDelivery(orderId, method);
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
        Confirmá (o corregí) la forma de pago con la que se cobró esta entrega.
      </p>
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="efectivo">Efectivo</option>
        <option value="transferencia">Transferencia</option>
      </select>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Confirmando…' : 'Confirmar entrega'}
      </button>
    </div>
  );
}
