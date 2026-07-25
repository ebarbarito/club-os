'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteUser } from './actions';

export function DeleteUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm('¿Eliminar este usuario?')) return;
        startTransition(async () => {
          await deleteUser(userId);
          router.refresh();
        });
      }}
      className="text-red text-xs font-semibold hover:underline disabled:opacity-60"
    >
      {pending ? '…' : 'Eliminar'}
    </button>
  );
}
