'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { createAccount, updateAccount } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Account = {
  id: string;
  name: string;
  currency: string;
  exchange_rate: number;
  is_cash: boolean;
  active: boolean;
};

export function AccountForm({ account }: { account?: Account }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = account ? await updateAccount(formData) : await createAccount(formData);
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
      {account && <input type="hidden" name="id" value={account.id} />}
      <div>
        <label className={labelCls}>Nombre</label>
        <input name="name" required defaultValue={account?.name} className={inputCls} placeholder="ej. Banco Provincia" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Moneda</label>
          <input name="currency" required defaultValue={account?.currency ?? 'ARS'} className={inputCls} placeholder="ARS, USD..." />
        </div>
        <div>
          <label className={labelCls}>Cotización default</label>
          <input
            name="exchange_rate"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={account?.exchange_rate ?? 1}
            className={inputCls}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-text-soft">
        <input type="checkbox" name="is_cash" defaultChecked={account?.is_cash ?? false} />
        Es efectivo físico (cuenta para el arqueo de Caja)
      </label>
      {account && (
        <label className="flex items-center gap-2 text-sm text-text-soft">
          <input type="checkbox" name="active" defaultChecked={account.active} />
          Activa
        </label>
      )}

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : account ? 'Guardar cambios' : 'Crear cuenta'}
      </button>
    </form>
  );
}
