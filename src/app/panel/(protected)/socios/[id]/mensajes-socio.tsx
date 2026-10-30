'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generarLinkEtapa2 } from '../actions';
import { linkWhatsApp, telefonoWhatsApp } from '@/lib/alta/opciones';

export type MensajeFicha = { id: string; titulo: string; texto: string };

const LINK_ETAPA2 = '[LINK SEGUNDA PARTE]';

// Mensaje que corresponde al estado del socio (segunda parte o bienvenida),
// ya completado con sus datos. El texto es editable para completar lo que no tiene dato
// (ej. [DÍA Y HORA] de un turno) antes de mandarlo. Si el mensaje lleva el
// link personal de la segunda parte, se genera recién al enviar o copiar.
export function MensajesSocio({
  memberId,
  phone,
  mensajes,
  etapa2EnviadaAt,
  puedeGenerarLink,
}: {
  memberId: string;
  phone: string | null;
  mensajes: MensajeFicha[];
  etapa2EnviadaAt: string | null;
  puedeGenerarLink: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seleccion, setSeleccion] = useState(mensajes[0]?.id ?? '');
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    Object.fromEntries(mensajes.map((m) => [m.id, m.texto])),
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (mensajes.length === 0) return null;

  const texto = textos[seleccion] ?? '';
  const llevaLink = texto.includes(LINK_ETAPA2);
  const pendientes = Array.from(new Set((texto.replace(LINK_ETAPA2, '').match(/\[[^\]]+\]/g) ?? [])));
  const telValido = telefonoWhatsApp(phone) != null;

  async function resolverTexto(): Promise<string | null> {
    if (!puedeGenerarLink) {
      if (!llevaLink) return texto;
      setError('El link de la segunda parte solo se puede generar mientras el socio está pre-inscripto.');
      return null;
    }
    // Reutiliza el mismo link que ya figura en el mensaje y registra el envío.
    const res = await generarLinkEtapa2(memberId);
    if (res.error || !res.url) {
      setError(res.error ?? 'No se pudo generar el link');
      return null;
    }
    return texto.replace(LINK_ETAPA2, res.url);
  }

  function enviar() {
    setError(null);
    setAviso(null);
    // La ventana se abre ANTES del await: si se abre después, el navegador
    // del celular la toma como popup y la bloquea.
    const win = window.open('', '_blank');
    startTransition(async () => {
      const final = await resolverTexto();
      if (!final) {
        win?.close();
        return;
      }
      const wa = linkWhatsApp(phone, final);
      if (win) win.location.href = wa;
      else window.location.href = wa;
      if (puedeGenerarLink) router.refresh();
    });
  }

  function copiar() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const final = await resolverTexto();
      if (!final) return;
      try {
        await navigator.clipboard.writeText(final);
        setAviso('Mensaje copiado ✓');
      } catch {
        setError('No se pudo copiar. Seleccioná el texto a mano.');
      }
      if (puedeGenerarLink) router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-accent/40 bg-surface p-5 mb-4">
      <p className="text-xs font-semibold text-text-mute uppercase mb-3">
        Mensaje de WhatsApp{mensajes.length === 1 ? ` · ${mensajes[0].titulo}` : ''}
      </p>

      {mensajes.length > 1 && (
      <select
        value={seleccion}
        onChange={(e) => {
          setSeleccion(e.target.value);
          setAviso(null);
          setError(null);
        }}
        className="w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent mb-3"
      >
        {mensajes.map((m, i) => (
          <option key={m.id} value={m.id}>
            {m.titulo}
            {i === 0 ? ' (sugerido)' : ''}
          </option>
        ))}
      </select>
      )}

      <textarea
        value={texto}
        onChange={(e) => setTextos((prev) => ({ ...prev, [seleccion]: e.target.value }))}
        rows={Math.min(14, Math.max(5, texto.split('\n').length + 1))}
        className="w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent font-sans"
      />

      {pendientes.length > 0 && (
        <p className="text-amber-tx text-xs bg-amber-bg rounded-lg px-3 py-2 mt-2">
          Completá antes de enviar: {pendientes.join(', ')}
        </p>
      )}
      {puedeGenerarLink && (
        <p className="text-text-mute text-xs mt-2">
          El link es personal de este socio: sirve solo para él.
          {etapa2EnviadaAt && ` Último envío: ${etapa2EnviadaAt}.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          disabled={pending}
          onClick={enviar}
          className="rounded-lg bg-accent text-white font-semibold text-sm px-4 py-2 disabled:opacity-60"
        >
          {pending ? 'Preparando…' : 'Enviar por WhatsApp'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={copiar}
          className="rounded-lg border border-line-2 text-sm font-semibold px-4 py-2 hover:border-accent hover:text-accent disabled:opacity-60"
        >
          Copiar
        </button>
      </div>

      {!telValido && (
        <p className="text-amber-tx text-xs mt-2">
          El teléfono cargado no tiene formato de celular argentino: WhatsApp se va a abrir para que elijas el contacto.
        </p>
      )}
      {aviso && <p className="text-accent text-sm mt-2">{aviso}</p>}
      {error && <p className="text-red text-sm mt-2 break-all">{error}</p>}
    </div>
  );
}
