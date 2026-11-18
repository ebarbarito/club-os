'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { refrescarCatalogo, subirFotoPorNombre } from './actions';

type Fila = { archivo: string; estado: 'pendiente' | 'ok' | 'error'; detalle?: string };

// Subir muchas fotos de una vez: el nombre de cada archivo tiene que ser el
// nombre del artículo (ej. "Sandía.jpg", "Mountain Cake.jpg"). Se suben de a
// una para no pasar el límite de tamaño.
export function FotosLote() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [reemplazar, setReemplazar] = useState(false);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [subiendo, setSubiendo] = useState(false);

  async function subir() {
    const lista = input.current?.files;
    const files: File[] = [];
    if (lista) for (let i = 0; i < lista.length; i++) files.push(lista[i]);
    if (files.length === 0) return;
    setSubiendo(true);
    const estado: Fila[] = files.map((f) => ({ archivo: f.name, estado: 'pendiente' }));
    setFilas([...estado]);
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.set('foto', files[i]);
      fd.set('reemplazar', reemplazar ? '1' : '0');
      try {
        const res = await subirFotoPorNombre(fd);
        estado[i] = res.error
          ? { archivo: files[i].name, estado: 'error', detalle: res.error }
          : { archivo: files[i].name, estado: 'ok', detalle: res.articulo };
      } catch {
        estado[i] = { archivo: files[i].name, estado: 'error', detalle: 'No se pudo subir' };
      }
      setFilas([...estado]);
    }
    await refrescarCatalogo();
    router.refresh();
    setSubiendo(false);
    if (input.current) input.current.value = '';
  }

  const ok = filas.filter((f) => f.estado === 'ok').length;
  const mal = filas.filter((f) => f.estado === 'error').length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-soft">
        Elegí todas las fotos juntas. Cada archivo tiene que llamarse como el artículo (por ejemplo{' '}
        <strong>Sandía.jpg</strong> o <strong>Mountain Cake.jpg</strong>); no importan mayúsculas, acentos ni signos.
        La foto nueva queda como principal.
      </p>
      <input ref={input} type="file" accept="image/*" multiple className="block w-full text-sm" disabled={subiendo} />
      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} disabled={subiendo} />
        Reemplazar las fotos que ya tenga cada artículo
      </label>
      <button
        type="button"
        onClick={subir}
        disabled={subiendo}
        className="w-full rounded-lg bg-accent text-white font-semibold py-2.5 disabled:opacity-60"
      >
        {subiendo ? `Subiendo… ${ok + mal} de ${filas.length}` : 'Subir fotos'}
      </button>
      {filas.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-line text-sm" data-resultado-lote>
          {filas.map((f, i) => (
            <div key={i} className="flex justify-between gap-3 border-b border-line px-3 py-1.5 last:border-0">
              <span className="truncate text-text">{f.archivo}</span>
              <span className={f.estado === 'ok' ? 'text-accent' : f.estado === 'error' ? 'text-red' : 'text-text-mute'}>
                {f.estado === 'pendiente' ? '…' : f.estado === 'ok' ? `✓ ${f.detalle}` : f.detalle}
              </span>
            </div>
          ))}
        </div>
      )}
      {!subiendo && filas.length > 0 && (
        <p className="text-sm font-semibold text-text">
          {ok} subida{ok === 1 ? '' : 's'}
          {mal > 0 ? ` · ${mal} sin asignar` : ''}
        </p>
      )}
    </div>
  );
}
