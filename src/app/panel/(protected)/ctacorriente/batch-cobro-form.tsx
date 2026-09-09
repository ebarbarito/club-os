'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { money } from '@/lib/format';
import { PaymentSplitEditor, defaultAccount, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { payDispensaBatch } from './actions';

type Allocation = { dispensaId: string; number: number; amount: number };

export function BatchCobroForm({
  allocations,
  accounts,
  cuotaSocialAccountId,
  saldoCuotaSocial = 0,
  generalAccountId,
  saldoAFavorGeneral = 0,
}: {
  allocations: Allocation[];
  accounts: PaymentAccount[];
  cuotaSocialAccountId?: string | null;
  saldoCuotaSocial?: number;
  generalAccountId?: string | null;
  saldoAFavorGeneral?: number;
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const total = allocations.reduce((s, a) => s + a.amount, 0);
  const [lines, setLines] = useState<PaymentLine[]>(() => {
    const account = defaultAccount(accounts);
    return [{ accountId: account?.id ?? '', amount: String(total), exchangeRate: String(account?.exchange_rate ?? 1) }];
  });
  const [useCredit, setUseCredit] = useState('');
  const [useGeneralCredit, setUseGeneralCredit] = useState('');
  const creditUsed = Math.min(Number(useCredit) || 0, saldoCuotaSocial);
  const generalCreditUsed = Math.min(Number(useGeneralCredit) || 0, saldoAFavorGeneral);

  function submit() {
    const validLines = lines.filter((l) => Number(l.amount) > 0);
    if (validLines.length === 0 && creditUsed <= 0 && generalCreditUsed <= 0) {
      setError('Cargá al menos un medio de pago');
      return;
    }
    const payments = validLines.map((l) => ({ account_id: l.accountId, amount: Number(l.amount), exchange_rate: Number(l.exchangeRate) || 1 }));
    if (creditUsed > 0 && cuotaSocialAccountId) {
      payments.push({ account_id: cuotaSocialAccountId, amount: creditUsed, exchange_rate: 1 });
    }
    if (generalCreditUsed > 0 && generalAccountId) {
      payments.push({ account_id: generalAccountId, amount: generalCreditUsed, exchange_rate: 1 });
    }
    startTransition(async () => {
      const res = await payDispensaBatch(
        allocations.map((a) => ({ dispensa_id: a.dispensaId, amount: a.amount })),
        payments,
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

      {cuotaSocialAccountId && saldoCuotaSocial > 0.01 && (
        <div className="rounded-lg border border-amber/40 bg-amber-bg px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-medium text-amber-tx">
              🪙 Crédito cuota social disponible: {money(saldoCuotaSocial)}
            </label>
            <input
              type="number"
              min="0"
              max={saldoCuotaSocial}
              step="1"
              placeholder="0"
              value={useCredit}
              onChange={(e) => setUseCredit(e.target.value)}
              className="w-28 rounded-lg border border-line-2 px-2 py-1 text-sm text-right outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      {generalAccountId && saldoAFavorGeneral > 0.01 && (
        <div className="rounded-lg border border-line-2 bg-surface-2 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-medium text-text">
              💰 Saldo a favor disponible: {money(saldoAFavorGeneral)}
            </label>
            <input
              type="number"
              min="0"
              max={saldoAFavorGeneral}
              step="1"
              placeholder="0"
              value={useGeneralCredit}
              onChange={(e) => setUseGeneralCredit(e.target.value)}
              className="w-28 rounded-lg border border-line-2 px-2 py-1 text-sm text-right outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

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
