'use client';

import { money } from '@/lib/format';

export type PaymentAccount = {
  id: string;
  name: string;
  currency: string;
  exchange_rate: number;
  is_cash: boolean;
};

export type PaymentLine = { accountId: string; amount: string; exchangeRate: string };

const inputCls = 'rounded-lg border border-line-2 px-2 py-1.5 text-sm outline-none focus:border-accent';

// Efectivo como default: es el medio de pago mas frecuente, evita que el
// dispensador tenga que cambiarlo en cada operacion.
export function defaultAccount(accounts: PaymentAccount[]): PaymentAccount | undefined {
  return accounts.find((a) => a.is_cash) ?? accounts[0];
}

export function newPaymentLine(accounts: PaymentAccount[]): PaymentLine {
  const account = defaultAccount(accounts);
  return { accountId: account?.id ?? '', amount: '', exchangeRate: String(account?.exchange_rate ?? 1) };
}

// Editor de pago dividido en varias cuentas (Efectivo, US$, bancos...),
// cada una con su propia cotización — usado en Dispensa, Cuenta Corriente
// y Caja. Cotización solo se muestra editable si la cuenta no es ARS.
export function PaymentSplitEditor({
  accounts,
  lines,
  onChange,
}: {
  accounts: PaymentAccount[];
  lines: PaymentLine[];
  onChange: (lines: PaymentLine[]) => void;
}) {
  function updateLine(i: number, patch: Partial<PaymentLine>) {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function setAccount(i: number, accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    updateLine(i, { accountId, exchangeRate: String(account?.exchange_rate ?? 1) });
  }

  function addLine() {
    onChange([...lines, newPaymentLine(accounts)]);
  }

  function removeLine(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }

  const totalLocal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0) * (Number(l.exchangeRate) || 0), 0);

  if (accounts.length === 0) {
    return <p className="text-text-soft text-sm">No hay cuentas de pago configuradas. Cargá al menos una en Cuentas.</p>;
  }

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const account = accounts.find((a) => a.id === line.accountId);
        const isForeign = account && account.currency !== 'ARS';
        const local = (Number(line.amount) || 0) * (Number(line.exchangeRate) || 0);
        return (
          <div key={i} className="flex gap-2 items-center flex-wrap">
            <select value={line.accountId} onChange={(e) => setAccount(i, e.target.value)} className={`${inputCls} flex-1 min-w-[9rem]`}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Monto"
              value={line.amount}
              onChange={(e) => updateLine(i, { amount: e.target.value })}
              className={`${inputCls} w-24`}
            />
            {isForeign && (
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Cotización"
                title="Cotización: cuántos pesos vale 1 unidad de esta moneda"
                value={line.exchangeRate}
                onChange={(e) => updateLine(i, { exchangeRate: e.target.value })}
                className={`${inputCls} w-20`}
              />
            )}
            <span className="text-text-mute text-xs w-24 shrink-0">{money(local)}</span>
            {lines.length > 1 && (
              <button type="button" onClick={() => removeLine(i)} className="text-red text-xs shrink-0">
                Quitar
              </button>
            )}
          </div>
        );
      })}
      <button type="button" onClick={addLine} className="text-accent text-xs font-semibold">
        + Dividir en otra cuenta
      </button>
      <div className="flex justify-between text-sm pt-1 border-t border-line">
        <span className="text-text-soft">Total en pesos</span>
        <span className="font-semibold text-text">{money(totalLocal)}</span>
      </div>
    </div>
  );
}
