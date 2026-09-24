'use client';

import { useState, useTransition } from 'react';
import { compraVentaDolares } from '../../actions';

type Account = { id: string; name: string; is_cash: boolean; currency: string };

export function CompraVentaDolaresForm({
  accounts,
}: {
  accounts: Account[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [tipo, setTipo] = useState<'compra' | 'venta'>('compra');
  const [usdAmount, setUsdAmount] = useState('');
  const [tipoCambio, setTipoCambio] = useState('');
  const [arsAccountId, setArsAccountId] = useState(accounts[0]?.id ?? '');

  const usd = Number(usdAmount) || 0;
  const tc = Number(tipoCambio) || 0;
  const arsEquivalente = usd * tc;

  function submit() {
    setError(null);
    if (usd <= 0) { setError('Ingresá la cantidad de dólares'); return; }
    if (tc <= 0) { setError('Ingresá el tipo de cambio'); return; }
    if (!arsAccountId) { setError('Seleccioná una cuenta'); return; }

    const fd = new FormData();
    fd.set('tipo', tipo);
    fd.set('usd_amount', String(usd));
    fd.set('tipo_cambio', String(tc));
    fd.set('ars_account_id', arsAccountId);

    startTransition(async () => {
      const res = await compraVentaDolares(fd);
      if (res?.error) { setError(res.error); return; }
      setSuccess(true);
    });
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <p className="text-accent font-semibold text-lg mb-1">✓ Operación registrada</p>
        <p className="text-text-soft text-sm">
          {tipo === 'compra'
            ? `Compra de USD ${usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} a $${tc} — impactó en caja general`
            : `Venta de USD ${usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} a $${tc} — impactó en caja general`}
        </p>
      </div>
    );
  }

  const labelCls = 'block text-xs font-medium text-text-soft mb-1';
  const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';

  return (
    <div className="space-y-5 min-w-[320px]">
      {/* Toggle compra / venta */}
      <div>
        <p className={labelCls}>Operación</p>
        <div className="flex rounded-lg border border-line-2 overflow-hidden text-sm font-semibold">
          <button
            type="button"
            onClick={() => setTipo('compra')}
            className={`flex-1 py-2 transition-colors ${tipo === 'compra' ? 'bg-accent text-white' : 'text-text-soft hover:text-text'}`}
          >
            Compra USD
          </button>
          <button
            type="button"
            onClick={() => setTipo('venta')}
            className={`flex-1 py-2 transition-colors ${tipo === 'venta' ? 'bg-accent text-white' : 'text-text-soft hover:text-text'}`}
          >
            Venta USD
          </button>
        </div>
        <p className="text-xs text-text-mute mt-1.5">
          {tipo === 'compra'
            ? 'Comprás USD: salen ARS de la cuenta seleccionada, entran USD a la caja.'
            : 'Vendés USD: salen USD de la caja, entran ARS a la cuenta seleccionada.'}
        </p>
      </div>

      {/* Monto USD + tipo de cambio */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Cantidad USD</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={usdAmount}
            onChange={(e) => setUsdAmount(e.target.value)}
            placeholder="0.00"
            className={inputCls + ' text-right tabular-nums'}
          />
        </div>
        <div>
          <label className={labelCls}>Tipo de cambio (ARS/USD)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={tipoCambio}
            onChange={(e) => setTipoCambio(e.target.value)}
            placeholder="Ej: 1200"
            className={inputCls + ' text-right tabular-nums'}
          />
        </div>
      </div>

      {/* Equivalente ARS */}
      {arsEquivalente > 0 && (
        <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-text-soft">
            {tipo === 'compra' ? 'ARS a debitar de la cuenta:' : 'ARS a acreditar en la cuenta:'}
          </span>
          <span className="font-bold tabular-nums text-text text-base">
            ${arsEquivalente.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      )}

      {/* Cuenta ARS */}
      <div>
        <label className={labelCls}>
          {tipo === 'compra' ? 'Cuenta de origen (ARS)' : 'Cuenta de destino (ARS)'}
        </label>
        <select
          value={arsAccountId}
          onChange={(e) => setArsAccountId(e.target.value)}
          className={inputCls}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending || usd <= 0 || tc <= 0}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2.5 disabled:opacity-60"
      >
        {pending
          ? 'Guardando…'
          : tipo === 'compra'
          ? `Registrar compra USD ${usd > 0 ? usd.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}`
          : `Registrar venta USD ${usd > 0 ? usd.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}`}
      </button>
    </div>
  );
}
