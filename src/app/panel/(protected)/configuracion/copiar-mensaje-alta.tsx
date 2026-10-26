'use client';

import { useState } from 'react';
import { mensajeEtapa1 } from '@/lib/alta/opciones';

// Copia el instructivo de la pre-inscripción (etapa 1) con el link ya
// puesto, para pegarlo en WhatsApp en la consulta inicial.
export function CopiarMensajeAlta({ clubName, altaUrl }: { clubName: string; altaUrl: string }) {
  const [estado, setEstado] = useState<'idle' | 'copiado' | 'error'>('idle');
  const [verMensaje, setVerMensaje] = useState(false);
  const mensaje = mensajeEtapa1(clubName, altaUrl);

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado('copiado');
    } catch {
      setEstado('error');
      setVerMensaje(true);
    }
  }

  return (
    <div>
      <p className="text-text-mute text-xs mb-1">Link de pre-inscripción (alta de socio, paso 1)</p>
      <a
        href={altaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent text-sm font-medium hover:underline break-all"
      >
        {altaUrl} ↗
      </a>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => copiar(mensaje)}
          className="rounded-lg bg-accent text-white font-semibold text-sm px-4 py-2"
        >
          {estado === 'copiado' ? 'Mensaje copiado ✓' : 'Copiar mensaje para WhatsApp'}
        </button>
        <button
          type="button"
          onClick={() => setVerMensaje((v) => !v)}
          className="rounded-lg border border-line-2 text-sm font-semibold px-4 py-2 hover:border-accent hover:text-accent"
        >
          {verMensaje ? 'Ocultar mensaje' : 'Ver mensaje'}
        </button>
      </div>
      {estado === 'error' && <p className="text-red text-xs mt-2">No se pudo copiar: seleccioná el texto de abajo a mano.</p>}
      {verMensaje && (
        <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-xs text-text-soft font-sans">{mensaje}</pre>
      )}
    </div>
  );
}
