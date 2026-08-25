'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { closeCajaDiaria, closeCajaGeneral } from './actions';
import { money } from '@/lib/format';

const DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 200, 100, 50];
const inputCls = 'w-full rounded-lg border border-line-2 px-2 py-1.5 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function CloseShiftForm({ expected, expectedUsd, kind }: { expected: number; expectedUsd?: number; kind: 'diaria' | 'general' }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [usdCounted, setUsdCounted] = useState('0');
  const [leaveCash, setLeaveCash] = useState<string | null>(null);
  const [leaveUsd, setLeaveUsd] = useState<string | null>(null);

  const totalCash = DENOMINATIONS.reduce((sum, d) => sum + d * Number(counts[d] || 0), 0);
  const totalUsd = Number(usdCounted) || 0;
  const difference = totalCash - expected;
  const differenceUsd = totalUsd - (expectedUsd ?? 0);
  // Por default se deja todo lo contado para la caja siguiente, salvo que
  // el admin lo reduzca a mano.
  const effectiveLeaveCash = leaveCash === null ? totalCash : Math.min(Number(leaveCash) || 0, totalCash);
  const effectiveLeaveUsd = leaveUsd === null ? totalUsd : Math.min(Number(leaveUsd) || 0, totalUsd);

  function submit() {
    startTransition(async () => {
      const formData = new FormData();
      const res =
        kind === 'diaria'
          ? await (async () => {
              formData.set('counted_cash', String(totalCash));
              formData.set('counted_usd', String(totalUsd));
              formData.set('leave_cash', String(effectiveLeaveCash));
              formData.set('leave_usd', String(effectiveLeaveUsd));
              return closeCajaDiaria(formData);
            })()
          : await (async () => {
              formData.set('counted_cash', String(totalCash));
              return closeCajaGeneral(formData);
            })();
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">Conteo de efectivo por denominación:</p>
      <div className="grid grid-cols-2 gap-2">
        {DENOMINATIONS.map((d) => (
          <div key={d} className="flex items-center gap-2">
            <span className="text-sm text-text-soft w-16">{money(d)}</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              className={inputCls}
              value={counts[d] ?? ''}
              onChange={(e) => setCounts((prev) => ({ ...prev, [d]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      {kind === 'diaria' && (
        <div>
          <label className={labelCls}>Dólares contados (total, sin denominación)</label>
          <input type="number" min="0" step="0.01" placeholder="0" className={inputCls} value={usdCounted} onChange={(e) => setUsdCounted(e.target.value)} />
        </div>
      )}

      <div className="rounded-lg bg-surface-2 p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-text-soft">Total contado (pesos)</span>
          <span className="font-semibold">{money(totalCash)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-soft">Diferencia (pesos)</span>
          <span className={`font-semibold ${difference === 0 ? 'text-accent' : 'text-red'}`}>
            {difference === 0 ? 'Exacto' : money(difference)}
          </span>
        </div>
        {kind === 'diaria' && (
          <>
            <div className="flex justify-between pt-1 border-t border-line">
              <span className="text-text-soft">Total contado (US$)</span>
              <span className="font-semibold">US$ {totalUsd.toLocaleString('es-AR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-soft">Diferencia (US$)</span>
              <span className={`font-semibold ${differenceUsd === 0 ? 'text-accent' : 'text-red'}`}>
                {differenceUsd === 0 ? 'Exacto' : `US$ ${differenceUsd.toLocaleString('es-AR')}`}
              </span>
            </div>
          </>
        )}
      </div>

      {kind === 'diaria' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Dejar para la caja siguiente (pesos)</label>
            <input
              type="number"
              min="0"
              max={totalCash}
              step="1"
              className={inputCls}
              value={leaveCash ?? totalCash}
              onChange={(e) => setLeaveCash(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Dejar para la caja siguiente (US$)</label>
            <input
              type="number"
              min="0"
              max={totalUsd}
              step="0.01"
              className={inputCls}
              value={leaveUsd ?? totalUsd}
              onChange={(e) => setLeaveUsd(e.target.value)}
            />
          </div>
        </div>
      )}

      <p className="text-text-mute text-xs">
        {kind === 'diaria'
          ? `Al cerrar se abre el turno siguiente con ${money(effectiveLeaveCash)} y US$ ${effectiveLeaveUsd.toLocaleString('es-AR')} de apertura. ${
              effectiveLeaveCash < totalCash || effectiveLeaveUsd < totalUsd
                ? 'El resto se deposita en Caja general (si hay una abierta).'
                : ''
            }`
          : `Al cerrar se abre automáticamente el turno siguiente con ${money(totalCash)} como saldo de apertura.`}
      </p>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Cerrando…' : 'Cerrar caja'}
      </button>
    </div>
  );
}
