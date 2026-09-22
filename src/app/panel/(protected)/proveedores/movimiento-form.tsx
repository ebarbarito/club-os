'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { PaymentSplitEditor, newPaymentLine, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { addMovimiento } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function MovimientoForm({
  proveedorId,
  defaultType,
  accounts,
}: {
  proveedorId: string;
  defaultType: 'deuda' | 'pago';
  accounts: PaymentAccount[];
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'deuda' | 'pago'>(defaultType);
  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);
  const [impactaCaja, setImpactaCaja] = useState(true);

  const paymentTotal = payments.reduce(
    (s, p) => s + (Number(p.amount) || 0) * (Number(p.exchangeRate) || 1),
    0,
  );

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const description = String(formData.get('description') ?? '').trim();
      if (!description) { setError('Ingresá una descripción'); return; }

      const date = String(formData.get('date') ?? new Date().toISOString().split('T')[0]);

      if (type === 'deuda') {
        const amount = Number(formData.get('amount'));
        if (!amount || amount <= 0) { setError('El importe debe ser mayor a cero'); return; }
        const res = await addMovimiento(proveedorId, {
          type: 'deuda',
          amount,
          description,
          date,
          account_id: null,
          exchange_rate: 1,
          impacta_caja: false,
          payments: [],
        });
        if (res?.error) { setError(res.error); return; }
      } else {
        // pago: validar payments
        const validPayments = payments.filter((p) => Number(p.amount) > 0);
        if (validPayments.length === 0) { setError('Ingresá al menos una forma de pago con monto'); return; }
        if (paymentTotal <= 0) { setError('El importe debe ser mayor a cero'); return; }
        const res = await addMovimiento(proveedorId, {
          type: 'pago',
          amount: paymentTotal,
          description,
          date,
          account_id: validPayments[0]?.accountId ?? null,
          exchange_rate: Number(validPayments[0]?.exchangeRate) || 1,
          impacta_caja: impactaCaja,
          payments: validPayments.map((p) => ({
            account_id: p.accountId,
            amount: (Number(p.amount) || 0) * (Number(p.exchangeRate) || 1),
            exchange_rate: Number(p.exchangeRate) || 1,
          })),
        });
        if (res?.error) { setError(res.error); return; }
      }

      close();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {/* Tipo */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType('deuda')}
          className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
            type === 'deuda'
              ? 'border-red bg-red/5 text-red'
              : 'border-line-2 text-text-soft hover:border-red/50'
          }`}
        >
          Deuda
        </button>
        <button
          type="button"
          onClick={() => setType('pago')}
          className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
            type === 'pago'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-line-2 text-text-soft hover:border-accent/50'
          }`}
        >
          Pago
        </button>
      </div>

      {/* Descripción */}
      <div>
        <label className={labelCls}>Descripción *</label>
        <input
          name="description"
          required
          className={inputCls}
          placeholder={type === 'deuda' ? 'Ej: Factura #123 insumos' : 'Ej: Pago parcial factura #123'}
        />
      </div>

      {/* Fecha */}
      <div>
        <label className={labelCls}>Fecha</label>
        <input
          name="date"
          type="date"
          defaultValue={new Date().toISOString().split('T')[0]}
          className={inputCls}
        />
      </div>

      {/* Importe (solo deuda) */}
      {type === 'deuda' && (
        <div>
          <label className={labelCls}>Importe *</label>
          <input name="amount" type="number" min="0.01" step="0.01" required className={inputCls} placeholder="0" />
        </div>
      )}

      {/* Forma de pago (solo pago) */}
      {type === 'pago' && (
        <>
          <div>
            <label className={labelCls}>Forma de pago *</label>
            <PaymentSplitEditor accounts={accounts} lines={payments} onChange={setPayments} />
          </div>

          {/* Impacta caja */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={impactaCaja}
              onChange={(e) => setImpactaCaja(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line-2 accent-accent"
            />
            <span className="text-sm">
              <span className="font-medium text-text">Impactar en caja diaria</span>
              <span className="block text-xs text-text-soft mt-0.5">
                Registra el egreso en el turno de caja actual para que no genere faltante.
              </span>
            </span>
          </label>
        </>
      )}

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending
          ? 'Guardando…'
          : type === 'deuda'
          ? 'Registrar deuda'
          : 'Registrar pago'}
      </button>
    </form>
  );
}
