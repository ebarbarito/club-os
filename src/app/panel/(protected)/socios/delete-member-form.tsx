'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { softDeleteMember } from './actions';

export function DeleteMemberForm({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    startTransition(async () => {
      const res = await softDeleteMember(memberId);
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
        ¿Eliminar a <span className="font-semibold text-text">{memberName}</span>? Deja de aparecer en el padrón, pero
        su historial de dispensas y pagos se conserva.
      </p>
      {error && <p className="text-red text-sm">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={confirm}
        className="w-full rounded-lg bg-red text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Eliminando…' : 'Sí, eliminar'}
      </button>
    </div>
  );
}
