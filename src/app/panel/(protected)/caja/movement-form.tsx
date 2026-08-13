'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { PaymentSplitEditor, newPaymentLine, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { addMovement } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

const CONCEPTS = ['Alquiler', 'Ferretería', 'Eventos', 'Almacén', 'Insumos', 'Servicios', 'Membresía', 'Operativo', 'Otro'];

export function MovementForm({ accounts }: { accounts: PaymentAccount[] }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [concept, setConcept] = useState(CONCEPTS[0]);
  const [customConcept, setCustomConcept] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);

  function submit(formData: FormData) {
    const validPayments = payments.filter((p) => Number(p.amount) > 0);
    if (validPayments.length === 0) {
      setError('Cargá al menos una cuenta con monto');
      return;
    }
    const finalConcept = concept === 'Otro' ? customConcept || 'Otro' : concept;
    formData.set('category', finalConcept);
    formData.set('concept', finalConcept);
    formData.set(
      'payments',
      JSON.stringify(
        validPayments.map((p) => ({
          account_id: p.accountId,
          amount: Number(p.amount),
          exchange_rate: Number(p.exchangeRate) || 1,
        })),
      ),
    );
    startTransition(async () => {
      const res = await addMovement(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <div>
        <label className={labelCls}>Categoría</label>
        <select name="type" className={inputCls} defaultValue="ingreso">
          <option value="ingreso">Ingreso</option>
          <option value="egreso">Egreso</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Concepto</label>
        <select value={concept} onChange={(e) => setConcept(e.target.value)} className={inputCls}>
          {CONCEPTS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {concept === 'Otro' && (
          <input
            value={customConcept}
            onChange={(e) => setCustomConcept(e.target.value)}
            placeholder="Especificar concepto"
            className={`${inputCls} mt-2`}
          />
        )}
      </div>
      <div>
        <label className={labelCls}>Medio de pago</label>
        <PaymentSplitEditor accounts={accounts} lines={payments} onChange={setPayments} />
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : 'Registrar movimiento'}
      </button>
    </form>
  );
}
