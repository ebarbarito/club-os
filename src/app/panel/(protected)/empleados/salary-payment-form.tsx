'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { PaymentSplitEditor, newPaymentLine, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { money } from '@/lib/format';
import { pagarSueldo } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export type SalaryInfo = {
  id?: string;
  amount: number;        // importe del sueldo del mes
  paid_amount: number;   // ya pagado
};

export function SalaryPaymentForm({
  employeeId,
  employeeName,
  baseSalary,
  salary,            // current month salary record (if any)
  accounts,
}: {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  salary: SalaryInfo | null;
  accounts: PaymentAccount[];
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // If a salary record exists, amount is locked to its amount; otherwise editable
  const hasSalary = salary !== null;
  const pendingAmount = hasSalary ? salary.amount - salary.paid_amount : baseSalary;

  const [salaryAmount, setSalaryAmount] = useState<string>(
    hasSalary ? String(salary.amount) : String(baseSalary),
  );
  const [description, setDescription] = useState('Sueldo');
  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);

  const paymentTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const effectiveSalaryAmount = hasSalary ? salary.amount : Number(salaryAmount) || baseSalary;
  const effectivePending = effectiveSalaryAmount - (salary?.paid_amount ?? 0);

  function submit() {
    setError(null);
    const validPayments = payments.filter((p) => Number(p.amount) > 0);
    if (validPayments.length === 0) {
      setError('Cargá al menos una cuenta con monto');
      return;
    }
    if (paymentTotal <= 0) {
      setError('El monto debe ser mayor a cero');
      return;
    }
    if (paymentTotal > effectivePending + 0.005) {
      setError(`El pago (${money(paymentTotal)}) excede el saldo pendiente (${money(effectivePending)})`);
      return;
    }

    const fd = new FormData();
    fd.set('employee_id', employeeId);
    fd.set('amount', String(paymentTotal));
    fd.set('description', description);
    fd.set('payments', JSON.stringify(validPayments.map((p) => ({
      account_id: p.accountId,
      amount: Number(p.amount),
      exchange_rate: Number(p.exchangeRate) || 1,
    }))));
    if (!hasSalary) {
      fd.set('salary_amount', salaryAmount);
    }

    startTransition(async () => {
      const res = await pagarSueldo(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm space-y-1">
        <p className="font-semibold text-text">{employeeName}</p>
        {hasSalary ? (
          <>
            <p className="text-text-soft">Sueldo del mes: <span className="font-medium text-text">{money(salary.amount)}</span></p>
            <p className="text-text-soft">Pagado: <span className="font-medium text-text">{money(salary.paid_amount)}</span></p>
            <p className="text-text-soft">Pendiente: <span className={`font-semibold ${effectivePending > 0.01 ? 'text-accent' : 'text-red'}`}>{money(effectivePending)}</span></p>
          </>
        ) : (
          <p className="text-text-soft">Sin pagos este mes — se creará el registro al confirmar.</p>
        )}
      </div>

      {!hasSalary && (
        <div>
          <label className={labelCls}>Importe del sueldo del mes</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={salaryAmount}
            onChange={(e) => setSalaryAmount(e.target.value)}
            className={inputCls}
          />
          <p className="text-text-mute text-xs mt-1">
            Base: {money(baseSalary)}. Podés ajustarlo para este mes.
          </p>
        </div>
      )}

      <div>
        <label className={labelCls}>Tipo de pago</label>
        <select value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls}>
          <option value="Sueldo">Sueldo</option>
          <option value="Adelanto">Adelanto</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>Medio de pago</label>
        <PaymentSplitEditor accounts={accounts} lines={payments} onChange={setPayments} />
        {paymentTotal > 0 && (
          <p className="text-xs text-text-soft mt-1">Total: {money(paymentTotal)}</p>
        )}
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Registrando…' : 'Registrar pago'}
      </button>
    </div>
  );
}
