'use client';

import { useTransition } from 'react';
import { deleteMovimiento } from '../actions';

export function DeleteMovimientoButton({
  movId,
  proveedorId,
}: {
  movId: string;
  proveedorId: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm('¿Eliminar este movimiento?')) return;
    startTransition(async () => {
      await deleteMovimiento(movId, proveedorId);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-text-mute hover:text-red disabled:opacity-40 transition-colors"
      title="Eliminar"
    >
      ✕
    </button>
  );
}
