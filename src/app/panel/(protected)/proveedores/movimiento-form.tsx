'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { addMovimiento } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Account = { id: string; name: string; currency: string; exchange_rate: number };

export function MovimientoForm({
  proveedorId,
  defaultType,
  accounts,
}: {
  proveedorId: string;
  defaultType: 'deuda' | 'pago';
  accounts: Account[];
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'deuda' | 'pago'>(defaultType);
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id ?? '');

  const account = accounts.find((a) => a.id === selectedAccount);
  const isUsd = account?.currency === 'USD';

  function submit(formData: FormData) {
    startTransition(async () => {
      const amount = Number(formData.get('amount'));
      if (!amount || amount <= 0) {
        setError('El importe debe ser mayor a cero');
        return;
      }
      const description = String(formData.get('description') ?? '').trim();
      if (!description) {
        setError('Ingresá una descripción');
        return;
      }
      const res = await addMovimiento(proveedorId, {
        type,
        amount,
        description,
        date: String(formData.get('date') ?? new Date().toISOString().split('T')[0]),
        account_id: type === 'pago' ? selectedAccount || null : null,
        exchange_rate: account?.exchange_rate ?? 1,
      });
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

      <div>
        <label className={labelCls}>Descripción *</label>
        <input name="description" required className={inputCls} placeholder={type === 'deuda' ? 'Ej: Factura #123 insumos' : 'Ej: Pago parcial factura #123'} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Importe *</label>
          <input name="amount" type="number" min="0.01" step="0.01" required className={inputCls} placeholder="0" />
          {isUsd && <p className="text-xs text-text-mute mt-1">En USD — cotización: ${account?.exchange_rate}</p>}
        </div>
        <div>
          <label className={labelCls}>Fecha</label>
          <input
            name="date"
            type="date"
            defaultValue={new Date().toISOString().split('T')[0]}
            className={inputCls}
          />
        </div>
      </div>

      {type === 'pago' && (
        <div>
          <label className={labelCls}>Forma de pago</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className={inputCls}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
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
