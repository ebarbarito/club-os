'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { enviarAccesoSocio } from '../actions';

// Estado del acceso del socio al sitio de socios (usuario = DNI) y botón
// para mandarle una clave provisoria por mail.
export function AccesoSocio({
  memberId,
  email,
  estado,
  detalle,
  puedeEnviar,
}: {
  memberId: string;
  email: string | null;
  estado: string;
  detalle: string | null;
  puedeEnviar: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  function enviar() {
    setMsg(null);
    startTransition(async () => {
      const res = await enviarAccesoSocio(memberId);
      if (res.error) setMsg({ error: res.error });
      else {
        setMsg({ ok: `Clave enviada a ${res.email}. Vence en 30 minutos.` });
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 mb-4">
      <p className="text-xs font-semibold text-text-mute uppercase mb-3">Acceso al sitio de socios</p>
      <p className="text-sm">
        <strong>{estado}</strong>
        {detalle && <span className="text-text-soft"> · {detalle}</span>}
      </p>
      <p className="text-text-mute text-xs mt-1">Usuario: su DNI. {email ? `Mail: ${email}` : 'Sin mail cargado.'}</p>
      {puedeEnviar && (
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button
            type="button"
            onClick={enviar}
            disabled={pending}
            className="rounded-lg bg-accent text-white font-semibold text-sm px-4 py-2 disabled:opacity-60"
          >
            {pending ? 'Enviando…' : 'Enviar clave por mail'}
          </button>
          {msg?.ok && <span className="text-accent text-sm">{msg.ok}</span>}
          {msg?.error && <span className="text-red text-sm">{msg.error}</span>}
        </div>
      )}
    </div>
  );
}
