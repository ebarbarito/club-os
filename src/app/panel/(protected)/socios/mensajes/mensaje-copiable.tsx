'use client';

import { useState } from 'react';

export function MensajeCopiable({ id, titulo, texto }: { id: string; titulo: string; texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el texto queda seleccionable a mano.
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-text">
          <span className="text-text-mute font-medium">{id} · </span>
          {titulo}
        </p>
        <button
          type="button"
          onClick={copiar}
          className="shrink-0 rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
        >
          {copiado ? 'Copiado ✓' : 'Copiar'}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-text-soft border-l-2 border-line-2 pl-3 select-text">{texto}</p>
    </div>
  );
}
