'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { money } from '@/lib/format';
import { PaymentSplitEditor, defaultAccount, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { payDispensaBatch } from './actions';

type Allocation = { dispensaId: string; number: number; amount: number };

export function BatchCobroForm({ allocations, accounts }: { allocations: Allocation[]; accounts: PaymentAccount[] }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const total = allocations.reduce((s, a) => s + a.amount, 0);
  const [lines, setLines] = useState<PaymentLine[]>(() => {
    const account = defaultAccount(accounts);
    return [{ accountId: account?.id ?? '', amount: String(total), exchangeRate: String(account?.exchange_rate ?? 1) }];
  });

  function submit() {
    const validLines = lines.filter((l) => Number(l.amount) > 0);
    if (validLines.length === 0) {
      setError('Cargá al menos un medio de pago');
      return;
    }
    startTransition(async () => {
      const res = await payDispensaBatch(
        allocations.map((a) => ({ dispensa_id: a.dispensaId, amount: a.amount })),
        validLines.map((l) => ({ account_id: l.accountId, amount: Number(l.amount), exchange_rate: Number(l.exchangeRate) || 1 })),
      );
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
      <div>
        <p className="text-xs font-semibold text-text-mute uppercase mb-1">Se cobra</p>
        <div className="space-y-1 text-sm">
          {allocations.map((a) => (
            <div key={a.dispensaId} className="flex justify-between text-text-soft">
              <span>Dispensa N° {a.number}</span>
              <span>{money(a.amount)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-semibold text-text border-t border-line pt-2 mt-2">
          <span>Total a cobrar</span>
          <span>{money(total)}</span>
        </div>
      </div>

      <PaymentSplitEditor accounts={accounts} lines={lines} onChange={setLines} />
      <p className="text-text-mute text-xs">
        Si lo pagado supera el total a cobrar, la diferencia queda como saldo a favor del socio.
      </p>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Confirmando…' : 'Confirmar cobro'}
      </button>
    </div>
  );
}
