'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ModalTrigger, useModalClose } from '@/components/modal-trigger';
import { purgeAuditLog } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

function PurgeAuditFields() {
  const router = useRouter();
  const close = useModalClose();
  const [scope, setScope] = useState<'range' | 'all'>('range');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (scope === 'range' && !from && !to) {
      setError('Elegí al menos una fecha, o "Todo el registro"');
      return;
    }
    const warning =
      scope === 'all'
        ? '¿Borrar TODO el registro de asientos? No se puede deshacer.'
        : '¿Borrar los asientos del rango elegido? No se puede deshacer.';
    if (!confirm(warning)) return;

    startTransition(async () => {
      const res = await purgeAuditLog(scope === 'all' ? {} : { from: from || undefined, to: to || undefined });
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
      <p className="text-sm text-text-soft">Esta acción borra asientos de forma permanente.</p>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={scope === 'range'} onChange={() => setScope('range')} /> Por rango de fechas
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} /> Todo el registro
        </label>
      </div>
      {scope === 'range' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </div>
        </div>
      )}
      {error && <p className="text-red text-sm">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-red text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Purgando…' : 'Purgar'}
      </button>
    </div>
  );
}

export function PurgeAuditForm() {
  return (
    <ModalTrigger
      label="Purgar registro"
      className="rounded-lg border border-line-2 text-red text-sm font-semibold px-4 py-2 hover:border-red"
      title="Purgar asientos"
    >
      <PurgeAuditFields />
    </ModalTrigger>
  );
}
