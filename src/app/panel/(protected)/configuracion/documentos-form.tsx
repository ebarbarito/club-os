'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { guardarDocumentosAdhesion } from './actions';
import { MAX_DOCUMENTOS, type DocumentoAdhesion } from '@/lib/alta/documentos';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';

// Editor de los documentos que el socio firma en la segunda parte. Si el
// club no cargó ninguno, se muestran (y se usan) los textos por defecto.
export function DocumentosForm({
  documentos,
  usandoPorDefecto,
}: {
  documentos: DocumentoAdhesion[];
  usandoPorDefecto: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [docs, setDocs] = useState<DocumentoAdhesion[]>(documentos);
  const [estado, setEstado] = useState<'idle' | 'ok'>('idle');
  const [error, setError] = useState<string | null>(null);

  function cambiarSoloAuto(i: number, valor: boolean) {
    setEstado('idle');
    setDocs((prev) => prev.map((d, j) => (j === i ? { ...d, soloAutocultivador: valor } : d)));
  }

  function cambiar(i: number, campo: 'titulo' | 'texto', valor: string) {
    setEstado('idle');
    setDocs((prev) => prev.map((d, j) => (j === i ? { ...d, [campo]: valor } : d)));
  }

  function mover(i: number, delta: number) {
    setEstado('idle');
    setDocs((prev) => {
      const next = [...prev];
      const j = i + delta;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await guardarDocumentosAdhesion(JSON.stringify(docs));
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEstado('ok');
      router.refresh();
    });
  }

  return (
    <div>
      {usandoPorDefecto && (
        <p className="text-amber-tx text-xs bg-amber-bg rounded-lg px-3 py-2 mb-3">
          Todavía no cargaste documentos propios: los socios firman este texto por defecto. Pegá acá el Formulario de
          Adhesión, el Contrato de Membresía, etc., y guardá.
        </p>
      )}

      <div className="space-y-4">
        {docs.map((d, i) => (
          <div key={i} className="rounded-lg border border-line-2 p-3">
            <div className="flex gap-2 items-center mb-2">
              <span className="text-text-mute text-xs font-semibold w-5">{i + 1}.</span>
              <input
                value={d.titulo}
                onChange={(e) => cambiar(i, 'titulo', e.target.value)}
                placeholder="Título (ej. Contrato de Membresía)"
                className={`${inputCls} font-semibold`}
              />
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="text-text-soft px-1 disabled:opacity-30" title="Subir">
                ↑
              </button>
              <button
                type="button"
                onClick={() => mover(i, 1)}
                disabled={i === docs.length - 1}
                className="text-text-soft px-1 disabled:opacity-30"
                title="Bajar"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => {
                  setEstado('idle');
                  setDocs((prev) => prev.filter((_, j) => j !== i));
                }}
                className="text-red text-xs font-semibold px-1"
              >
                Quitar
              </button>
            </div>
            <textarea
              value={d.texto}
              onChange={(e) => cambiar(i, 'texto', e.target.value)}
              rows={10}
              placeholder="Pegá acá el texto completo del documento"
              className={`${inputCls} font-sans`}
            />
            <label className="flex items-center gap-2 mt-2 text-sm text-text-soft cursor-pointer">
              <input
                type="checkbox"
                checked={d.soloAutocultivador === true}
                onChange={(e) => cambiarSoloAuto(i, e.target.checked)}
              />
              Solo para autocultivadores
              <span className="text-text-mute text-xs">(el paciente no lo ve ni lo firma)</span>
            </label>
          </div>
        ))}
      </div>

      <p className="text-text-mute text-xs mt-3">
        En el texto podés usar <code>[NOMBRE COMPLETO]</code>, <code>[DNI]</code>, <code>[DOMICILIO]</code>,{' '}
        <code>[EMAIL]</code>, <code>[CATEGORÍA]</code>, <code>[FECHA]</code>, <code>[FECHA LARGA]</code>,{' '}
        <code>[PLAN]</code>, <code>[CUOTA MENSUAL]</code> y <code>[CUOTA EN LETRAS]</code>: se completan solos con los
        datos de cada socio.
      </p>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        {docs.length < MAX_DOCUMENTOS && (
          <button
            type="button"
            onClick={() => {
              setEstado('idle');
              setDocs((prev) => [...prev, { titulo: '', texto: '', soloAutocultivador: false }]);
            }}
            className="rounded-lg border border-line-2 text-sm font-semibold px-4 py-2 hover:border-accent hover:text-accent"
          >
            + Agregar documento
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={guardar}
          className="rounded-lg bg-accent text-white font-semibold text-sm px-4 py-2 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar documentos'}
        </button>
        {estado === 'ok' && <span className="text-accent text-sm">Guardado ✓</span>}
        {error && <span className="text-red text-sm">{error}</span>}
      </div>
    </div>
  );
}
