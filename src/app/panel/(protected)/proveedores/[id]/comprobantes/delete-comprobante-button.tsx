'use client';

import { useTransition } from 'react';
import { deleteComprobante } from '../../actions';

export function DeleteComprobanteButton({
  id,
  proveedorId,
  label,
}: {
  id: string;
  proveedorId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`¿Eliminar comprobante ${label}?`)) return;
    startTransition(async () => {
      await deleteComprobante(id, proveedorId);
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
