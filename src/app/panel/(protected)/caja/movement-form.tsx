'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { PaymentSplitEditor, newPaymentLine, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { addMovement } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export type EmployeeOption = { id: string; name: string };
export type ConceptOption = { id: string; name: string; allows_ingreso: boolean; allows_egreso: boolean };

function firstValidConcept(concepts: ConceptOption[], type: 'ingreso' | 'egreso'): string {
  const valid = concepts.filter((c) => type === 'ingreso' ? c.allows_ingreso : c.allows_egreso);
  return valid[0]?.name ?? '';
}

export function MovementForm({
  accounts,
  kind,
  employees = [],
  concepts = [],
}: {
  accounts: PaymentAccount[];
  kind: 'diaria' | 'general';
  employees?: EmployeeOption[];
  concepts?: ConceptOption[];
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [concept, setConcept] = useState<string>(() => firstValidConcept(concepts, 'ingreso'));
  const [customConcept, setCustomConcept] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);

  const validConcepts = concepts.filter((c) => type === 'ingreso' ? c.allows_ingreso : c.allows_egreso);

  function handleTypeChange(newType: 'ingreso' | 'egreso') {
    setType(newType);
    // Reset concept to first valid one for the new type
    const first = firstValidConcept(concepts, newType);
    setConcept(first);
  }

  function submit(formData: FormData) {
    const validPayments = payments.filter((p) => Number(p.amount) > 0);
    if (validPayments.length === 0) {
      setError('Cargá al menos una cuenta con monto');
      return;
    }
    const employeeId = concept.startsWith('emp:') ? concept.slice(4) : null;
    const employee = employeeId ? employees.find((e) => e.id === employeeId) : null;
    const resolvedConcept = employee
      ? `Sueldo ${employee.name}`
      : concept === '__custom__'
      ? customConcept.trim() || 'Otro'
      : concept;
    formData.set('kind', kind);
    formData.set('category', resolvedConcept);
    formData.set('concept', resolvedConcept);
    if (employeeId) formData.set('employee_id', employeeId);
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
        <label className={labelCls}>Tipo</label>
        <select name="type" value={type} onChange={(e) => handleTypeChange(e.target.value as 'ingreso' | 'egreso')} className={inputCls}>
          <option value="ingreso">Ingreso</option>
          <option value="egreso">Egreso</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Concepto</label>
        <select value={concept} onChange={(e) => setConcept(e.target.value)} className={inputCls}>
          {validConcepts.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
          {type === 'egreso' && employees.length > 0 && (
            <optgroup label="Sueldos">
              {employees.map((e) => (
                <option key={e.id} value={`emp:${e.id}`}>
                  Sueldo {e.name}
                </option>
              ))}
            </optgroup>
          )}
          <option value="__custom__">Otro…</option>
        </select>
        {concept === '__custom__' && (
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
