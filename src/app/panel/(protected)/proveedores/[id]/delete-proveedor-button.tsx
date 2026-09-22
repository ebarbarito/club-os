'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProveedor } from '../actions';

export function DeleteProveedorButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`¿Eliminar proveedor "${name}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const res = await deleteProveedor(id);
      if (!res?.error) {
        router.replace('/panel/proveedores');
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="rounded-lg border border-red/30 text-red text-sm font-semibold px-3 py-1.5 hover:bg-red/5 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Eliminando…' : 'Eliminar'}
    </button>
  );
}
