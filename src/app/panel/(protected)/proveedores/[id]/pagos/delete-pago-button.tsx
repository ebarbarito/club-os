'use client';

import { useTransition } from 'react';
import { deletePagoComprobante } from '../../actions';

export function DeletePagoButton({
  id,
  proveedorId,
}: {
  id: string;
  proveedorId: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm('¿Eliminar este pago? Se restaurarán los saldos de los comprobantes asociados.')) return;
    startTransition(async () => {
      await deletePagoComprobante(id, proveedorId);
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
