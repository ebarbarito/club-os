'use client';

import { useState, useTransition } from 'react';
import { transferirEntreCuentas } from './actions';
import { money } from '@/lib/format';

type Account = { id: string; name: string; is_cash: boolean; currency: string; exchange_rate: number };

export function TransferEntreCuentasForm({ accounts }: { accounts: Account[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [origenId, setOrigenId] = useState(accounts[0]?.id ?? '');
  const [destinoId, setDestinoId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [concept, setConcept] = useState('');

  const origen = accounts.find((a) => a.id === origenId);
  const destino = accounts.find((a) => a.id === destinoId);
  const needsExchange = origen && destino && origen.currency !== destino.currency;
  const tc = needsExchange ? (Number(exchangeRate) || 0) : 1;
  const amt = Number(amount) || 0;
  const amtLocal = amt * tc;

  // Swap origen ↔ destino
  function swap() {
    const prev = origenId;
    setOrigenId(destinoId);
    setDestinoId(prev);
  }

  function submit() {
    setError(null);
    if (!origenId || !destinoId) { setError('Seleccioná las dos cuentas'); return; }
    if (origenId === destinoId) { setError('Las cuentas deben ser distintas'); return; }
    if (amt <= 0) { setError('Ingresá un importe'); return; }
    if (needsExchange && tc <= 0) { setError('Ingresá el tipo de cambio'); return; }

    const fd = new FormData();
    fd.set('origen_id', origenId);
    fd.set('destino_id', destinoId);
    fd.set('amount', String(amt));
    fd.set('exchange_rate', String(tc));
    fd.set('concept', concept);

    startTransition(async () => {
      const res = await transferirEntreCuentas(fd);
      if (res?.error) { setError(res.error); return; }
      setSuccess(`${origen?.name} → ${destino?.name}: ${needsExchange ? `${amt} ${origen?.currency} (≈ ${money(amtLocal)})` : money(amtLocal)}`);
    });
  }

  const labelCls = 'block text-xs font-medium text-text-soft mb-1';
  const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';

  if (success) {
    return (
      <div className="text-center py-6 min-w-[320px]">
        <p className="text-accent font-semibold text-lg mb-1">✓ Transferencia registrada</p>
        <p className="text-text-soft text-sm">{success}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 min-w-[320px]">
      {/* Cuentas con swap */}
      <div>
        <p className={labelCls}>Origen → Destino</p>
        <div className="flex items-center gap-2">
          <select
            value={origenId}
            onChange={(e) => setOrigenId(e.target.value)}
            className={inputCls + ' flex-1'}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={swap}
            className="shrink-0 rounded-lg border border-line-2 px-2.5 py-2 text-text-soft hover:text-accent hover:border-accent transition-colors"
            title="Invertir sentido"
          >
            ⇄
          </button>

          <select
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
            className={inputCls + ' flex-1'}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        {origenId === destinoId && (
          <p className="text-red text-xs mt-1">Las cuentas deben ser distintas</p>
        )}
      </div>

      {/* Monedas mezcladas: aviso + tipo de cambio */}
      {needsExchange && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300/50 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          La cuenta origen es {origen?.currency} y el destino es {destino?.currency}. Ingresá el importe en {origen?.currency} y el tipo de cambio.
        </div>
      )}

      {/* Importe + tipo de cambio */}
      <div className={needsExchange ? 'grid grid-cols-2 gap-3' : ''}>
        <div>
          <label className={labelCls}>
            Importe{needsExchange ? ` (${origen?.currency})` : ''}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={inputCls + ' text-right tabular-nums'}
          />
        </div>
        {needsExchange && (
          <div>
            <label className={labelCls}>Tipo de cambio (ARS/{origen?.currency})</label>
            <input
              type="number"
              min="0"
              step="1"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="Ej: 1200"
              className={inputCls + ' text-right tabular-nums'}
            />
          </div>
        )}
      </div>

      {/* Preview del movimiento */}
      {amt > 0 && (!needsExchange || tc > 0) && (
        <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-text-soft">Sale de</span>
            <span className="font-semibold text-red">{origen?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-soft">Entra a</span>
            <span className="font-semibold text-accent">{destino?.name}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-1 mt-1">
            <span className="text-text-soft">Importe ARS</span>
            <span className="font-bold tabular-nums">{money(amtLocal)}</span>
          </div>
        </div>
      )}

      {/* Concepto opcional */}
      <div>
        <label className={labelCls}>Concepto (opcional)</label>
        <input
          type="text"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder={`Transferencia ${origen?.name ?? ''} → ${destino?.name ?? ''}`}
          className={inputCls}
        />
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending || amt <= 0 || origenId === destinoId || (needsExchange && tc <= 0)}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2.5 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : `Registrar transferencia${amt > 0 ? ` ${needsExchange ? `${amt} ${origen?.currency}` : money(amtLocal)}` : ''}`}
      </button>
    </div>
  );
}
