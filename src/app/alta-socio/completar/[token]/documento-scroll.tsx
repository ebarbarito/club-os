'use client';

import { useEffect, useRef, useState } from 'react';
import { CAMPO_INVALIDO } from '@/lib/alta/marcar-campo';

// Un documento para leer y aceptar: el "Leí y acepto" se habilita recién
// cuando el socio llegó al final del texto (o si el texto entra entero sin
// scroll).
export function DocumentoScroll({
  index,
  titulo,
  texto,
  aceptado,
  onAceptadoChange,
}: {
  index: number;
  titulo: string;
  texto: string;
  aceptado: boolean;
  onAceptadoChange: (v: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [leido, setLeido] = useState(false);

  function revisar() {
    const el = ref.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setLeido(true);
  }

  useEffect(() => {
    // Texto corto que no necesita scroll: queda leído de entrada.
    revisar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-campo className={`rounded-lg border border-line-2 scroll-mt-4 ${CAMPO_INVALIDO}`}>
      <div className="px-3 py-2 border-b border-line-2 bg-surface-2 flex items-center justify-between gap-2">
        <p className="font-semibold text-text text-sm">{titulo}</p>
        {aceptado ? (
          <span className="text-accent text-xs font-semibold">Aceptado ✓</span>
        ) : !leido ? (
          <span className="text-text-mute text-xs">Deslizá hasta el final ↓</span>
        ) : null}
      </div>
      <div
        ref={ref}
        onScroll={revisar}
        className="max-h-72 overflow-y-auto px-4 py-3 text-sm text-text-soft whitespace-pre-wrap leading-relaxed bg-white/40"
      >
        {texto}
      </div>
      <label
        className={`flex items-start gap-2 px-3 py-2.5 border-t border-line-2 text-sm ${leido ? 'cursor-pointer text-text' : 'text-text-mute'}`}
      >
        <input
          type="checkbox"
          name={`acepta_doc_${index}`}
          disabled={!leido}
          checked={aceptado}
          onChange={(e) => onAceptadoChange(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Leí y acepto el <strong>{titulo}</strong>
          {!leido && <span className="block text-xs">Se habilita cuando llegás al final del texto.</span>}
        </span>
      </label>
    </div>
  );
}
