'use client';

import { useTransition } from 'react';
import { deleteArticulo } from '../actions';

export function DeleteArticuloButton({ id, description }: { id: string; description: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`¿Eliminar "${description}"?`)) return;
    startTransition(async () => {
      await deleteArticulo(id);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-text-mute hover:text-red disabled:opacity-40 text-xs transition-colors"
    >
      Eliminar
    </button>
  );
}
