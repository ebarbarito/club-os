'use client';

import { useEffect } from 'react';

// Abre el diálogo de impresión apenas se carga la hoja (?auto=1) y deja un
// botón para volver a imprimir.
export function AutoImprimir({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hide rounded-lg bg-accent text-white font-semibold text-sm px-4 py-2"
    >
      Imprimir
    </button>
  );
}
