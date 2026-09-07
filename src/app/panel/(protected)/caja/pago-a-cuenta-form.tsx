'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { MemberSearch, type SearchableMember } from '@/components/member-search';
import { PaymentSplitEditor, newPaymentLine, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { registrarPagoACuenta } from './actions';

const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function PagoACuentaForm({ members, accounts }: { members: SearchableMember[]; accounts: PaymentAccount[] }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);

  function submit() {
    setError(null);
    if (!memberId) {
      setError('Elegí un socio');
      return;
    }
    const validPayments = payments.filter((p) => Number(p.amount) > 0);
    if (validPayments.length === 0) {
      setError('Cargá al menos una cuenta con monto');
      return;
    }
    startTransition(async () => {
      const res = await registrarPagoACuenta(
        memberId,
        validPayments.map((p) => ({ account_id: p.accountId, amount: Number(p.amount), exchange_rate: Number(p.exchangeRate) || 1 })),
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
        <label className={labelCls}>Socio</label>
        <MemberSearch members={members} value={memberId} onChange={setMemberId} autoFocus />
      </div>
      <div>
        <label className={labelCls}>Forma de pago</label>
        <PaymentSplitEditor accounts={accounts} lines={payments} onChange={setPayments} />
      </div>
      <p className="text-text-mute text-xs">
        Se aplica primero a los comprobantes adeudados más viejos de este socio. Si paga más de lo que debe, el
        resto queda como saldo a favor.
      </p>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Registrando…' : 'Registrar pago a cuenta'}
      </button>
    </div>
  );
}
