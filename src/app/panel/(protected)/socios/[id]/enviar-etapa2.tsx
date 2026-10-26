'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generarLinkEtapa2 } from '../actions';
import { linkWhatsApp, mensajeEtapa2, telefonoWhatsApp } from '@/lib/alta/opciones';

// Botón de la ficha de un socio pre-inscripto: genera el link personal de
// la etapa 2 y abre WhatsApp con el mensaje armado. "Copiar link" queda
// para cuando el teléfono no se puede normalizar o se manda por otro lado.
export function EnviarEtapa2({
  memberId,
  phone,
  tenantName,
  enviadaAt,
}: {
  memberId: string;
  phone: string | null;
  tenantName: string;
  enviadaAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const telValido = telefonoWhatsApp(phone) != null;

  function enviar(modo: 'whatsapp' | 'copiar') {
    setError(null);
    setCopiado(false);
    // La ventana se abre ANTES del await: si se abre después, el navegador
    // del celular la toma como popup y la bloquea.
    const win = modo === 'whatsapp' ? window.open('', '_blank') : null;
    startTransition(async () => {
      const res = await generarLinkEtapa2(memberId);
      if (res.error || !res.url) {
        win?.close();
        setError(res.error ?? 'No se pudo generar el link');
        return;
      }
      const url = res.url;
      if (modo === 'whatsapp') {
        const wa = linkWhatsApp(phone, mensajeEtapa2(tenantName, url));
        if (win) win.location.href = wa;
        else window.location.href = wa;
      } else {
        try {
          await navigator.clipboard.writeText(url);
          setCopiado(true);
        } catch {
          setError(`No se pudo copiar. Link: ${url}`);
        }
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-accent/40 bg-surface p-5 mb-4">
      <p className="text-xs font-semibold text-text-mute uppercase mb-1">Etapa 2 — Formulario de adhesión</p>
      <p className="text-text-soft text-sm mb-3">
        Cuando revises la pre-inscripción, mandale al socio su link personal para cargar la indicación médica, elegir el
        plan y firmar.
        {enviadaAt && <span className="block text-text-mute text-xs mt-1">Último envío: {enviadaAt}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => enviar('whatsapp')}
          className="rounded-lg bg-accent text-white font-semibold text-sm px-4 py-2 disabled:opacity-60"
        >
          {pending ? 'Generando…' : enviadaAt ? 'Reenviar por WhatsApp' : 'Enviar etapa 2 por WhatsApp'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => enviar('copiar')}
          className="rounded-lg border border-line-2 text-sm font-semibold px-4 py-2 hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {copiado ? 'Link copiado ✓' : 'Copiar link'}
        </button>
      </div>
      {!telValido && (
        <p className="text-amber-tx text-xs mt-2">
          El teléfono cargado no tiene formato de celular argentino: WhatsApp se va a abrir para que elijas el contacto.
        </p>
      )}
      {error && <p className="text-red text-sm mt-2 break-all">{error}</p>}
    </div>
  );
}
