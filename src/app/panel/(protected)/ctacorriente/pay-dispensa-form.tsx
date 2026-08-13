'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { money } from '@/lib/format';
import { PaymentSplitEditor, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { payDispensa } from './actions';

export function PayDispensaForm({
  dispensaId,
  adeudado,
  accounts,
}: {
  dispensaId: string;
  adeudado: number;
  accounts: PaymentAccount[];
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<PaymentLine[]>(() => [
    { accountId: accounts[0]?.id ?? '', amount: String(adeudado), exchangeRate: String(accounts[0]?.exchange_rate ?? 1) },
  ]);

  function submit() {
    const validLines = lines.filter((l) => Number(l.amount) > 0);
    if (validLines.length === 0) {
      setError('Cargá al menos un medio de pago');
      return;
    }
    startTransition(async () => {
      const res = await payDispensa(
        dispensaId,
        validLines.map((l) => ({
          account_id: l.accountId,
          amount: Number(l.amount),
          exchange_rate: Number(l.exchangeRate) || 1,
        })),
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
      <p className="text-sm text-text-soft">
        Adeudado: <span className="font-semibold text-red">{money(adeudado)}</span> — podés cobrar parcial o total.
      </p>
      <PaymentSplitEditor accounts={accounts} lines={lines} onChange={setLines} />
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
