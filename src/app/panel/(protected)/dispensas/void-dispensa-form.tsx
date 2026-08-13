'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { voidDispensa } from './actions';

export function VoidDispensaForm({ dispensaId }: { dispensaId: string }) {
  const router = useRouter();
  const close = useModalClose();
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!reason.trim()) {
      setError('Contá brevemente por qué se anula');
      return;
    }
    startTransition(async () => {
      const res = await voidDispensa(dispensaId, reason);
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
      <p className="text-sm text-text-soft">
        Se revierte el stock descontado y se borran los asientos de caja que generó. Queda un registro de que se
        anuló, quién y por qué.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Motivo de la anulación"
        className="w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-red"
      />
      {error && <p className="text-red text-sm">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-red text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Anulando…' : 'Anular dispensa'}
      </button>
    </div>
  );
}
