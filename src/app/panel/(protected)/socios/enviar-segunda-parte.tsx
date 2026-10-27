'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { generarLinkEtapa2 } from './actions';
import { linkWhatsApp } from '@/lib/alta/opciones';

const LINK_ETAPA2 = '[LINK SEGUNDA PARTE]';

// Botón de la lista de socios (pre-inscriptos): genera el link personal de
// la segunda parte y abre WhatsApp con el mensaje de la guía (2.3 o 3.6) ya
// completado. Para editar el texto antes de mandarlo, está la ficha.
export function EnviarSegundaParte({
  memberId,
  phone,
  texto,
  enviadaAt,
}: {
  memberId: string;
  phone: string | null;
  texto: string;
  enviadaAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function enviar() {
    setError(null);
    // Ventana abierta ANTES del await para que el celular no la bloquee.
    const win = window.open('', '_blank');
    startTransition(async () => {
      const res = await generarLinkEtapa2(memberId);
      if (res.error || !res.url) {
        win?.close();
        setError(res.error ?? 'No se pudo generar el link');
        return;
      }
      const wa = linkWhatsApp(phone, texto.replace(LINK_ETAPA2, res.url));
      if (win) win.location.href = wa;
      else window.location.href = wa;
      router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={enviar}
        disabled={pending}
        title={enviadaAt ? `Último envío: ${enviadaAt}` : undefined}
        className="rounded-lg bg-accent text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-60"
      >
        {pending ? 'Generando…' : enviadaAt ? 'Reenviar 2ª parte' : 'Enviar 2ª parte'}
      </button>
      {error && <span className="text-red text-[11px] mt-1 max-w-[180px] whitespace-normal">{error}</span>}
    </div>
  );
}
