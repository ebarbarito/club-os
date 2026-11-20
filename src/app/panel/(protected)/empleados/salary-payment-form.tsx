'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { PaymentSplitEditor, newPaymentLine, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { money } from '@/lib/format';
import { nombreMes } from '@/lib/empleados/sueldo';
import { pagarSueldo } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export type CuentaSueldo = {
  periodo: string; // 'YYYY-MM' actual
  periodoProximo: string;
  sueldo: number; // sueldo del mes
  arrastre: number; // retirado el mes pasado a cuenta de este
  consumido: number; // arrastre + retirado este mes
  disponible: number; // pendiente del sueldo del mes
  aCuentaProximo: number; // ya retirado a cuenta del próximo
  maximo: number; // tope que puede retirar ahora
  tieneRegistroMes: boolean;
};

export function SalaryPaymentForm({
  employeeId,
  employeeName,
  baseSalary,
  cuenta,
  accounts,
}: {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  cuenta: CuentaSueldo;
  accounts: PaymentAccount[];
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [salaryAmount, setSalaryAmount] = useState<string>(String(cuenta.sueldo || baseSalary));
  const [description, setDescription] = useState(cuenta.disponible > 0.01 ? 'Sueldo' : 'Adelanto');
  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);

  const paymentTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  // Si todavía no hay registro del mes, el sueldo del mes se puede ajustar.
  const sueldoMes = cuenta.tieneRegistroMes ? cuenta.sueldo : Number(salaryAmount) || baseSalary;
  const disponible = Math.max(0, sueldoMes - cuenta.consumido);
  const maximo = cuenta.maximo + (disponible - cuenta.disponible);
  const aCuentaEste = Math.max(0, paymentTotal - disponible);
  const mesProx = nombreMes(cuenta.periodoProximo);

  function submit() {
    setError(null);
    const validPayments = payments.filter((p) => Number(p.amount) > 0);
    if (validPayments.length === 0 || paymentTotal <= 0) {
      setError('Cargá al menos una cuenta con monto');
      return;
    }
    if (paymentTotal > maximo + 0.005) {
      setError(`Supera lo que puede retirar: hasta ${money(maximo)} (el resto del sueldo de este mes y el de ${mesProx}).`);
      return;
    }
    if (
      aCuentaEste > 0.005 &&
      !window.confirm(`De este pago, ${money(aCuentaEste)} van a cuenta del sueldo de ${mesProx}. ¿Confirmás?`)
    ) {
      return;
    }

    const fd = new FormData();
    fd.set('employee_id', employeeId);
    fd.set('amount', String(paymentTotal));
    fd.set('description', aCuentaEste > 0.005 && description === 'Sueldo' ? 'Sueldo + adelanto' : description);
    fd.set(
      'payments',
      JSON.stringify(
        validPayments.map((p) => ({
          account_id: p.accountId,
          amount: Number(p.amount),
          exchange_rate: Number(p.exchangeRate) || 1,
        })),
      ),
    );
    if (!cuenta.tieneRegistroMes) fd.set('salary_amount', salaryAmount);

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
        <p className="text-text-soft">
          Sueldo de {nombreMes(cuenta.periodo)}: <span className="font-medium text-text">{money(sueldoMes)}</span>
        </p>
        {cuenta.arrastre > 0.005 && (
          <p className="text-text-soft">
            Adelantado el mes pasado a cuenta de este: <span className="font-medium text-text">{money(cuenta.arrastre)}</span>
          </p>
        )}
        <p className="text-text-soft">
          Retirado: <span className="font-medium text-text">{money(cuenta.consumido)}</span>
        </p>
        <p className="text-text-soft">
          Pendiente del mes:{' '}
          <span className={`font-semibold ${disponible > 0.01 ? 'text-accent' : 'text-text-mute'}`}>{money(disponible)}</span>
        </p>
        {cuenta.aCuentaProximo > 0.005 && (
          <p className="text-amber-tx font-semibold">
            Ya retiró {money(cuenta.aCuentaProximo)} a cuenta del sueldo de {mesProx}.
          </p>
        )}
      </div>

      {!cuenta.tieneRegistroMes && (
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
          <p className="text-text-mute text-xs mt-1">Base: {money(baseSalary)}. Podés ajustarlo para este mes.</p>
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
        {paymentTotal > 0 && <p className="text-xs text-text-soft mt-1">Total: {money(paymentTotal)}</p>}
      </div>

      {aCuentaEste > 0.005 && paymentTotal <= maximo + 0.005 && (
        <div className="rounded-lg border-2 border-gold/60 bg-amber-bg px-4 py-3 text-sm">
          <p className="font-semibold text-amber-tx">⚠ Retiro a cuenta del próximo sueldo</p>
          <p className="text-text mt-1">
            {disponible > 0.005
              ? `${money(disponible)} completan el sueldo de ${nombreMes(cuenta.periodo)} y `
              : 'El sueldo de este mes ya está cobrado: '}
            <span className="font-bold">{money(aCuentaEste)}</span> se descuentan del sueldo de {mesProx}.
          </p>
        </div>
      )}
      {paymentTotal > maximo + 0.005 && (
        <p className="text-red text-sm">
          Supera lo que puede retirar: hasta {money(maximo)} (el resto de este mes y el sueldo de {mesProx}).
        </p>
      )}

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
