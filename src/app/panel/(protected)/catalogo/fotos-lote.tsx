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
  const [elegidas, setElegidas] = useState<File[]>([]);
  const [arrastrando, setArrastrando] = useState(false);

  function tomar(lista: FileList | null) {
    const files: File[] = [];
    if (lista) for (let i = 0; i < lista.length; i++) if (lista[i].type.startsWith('image/')) files.push(lista[i]);
    setElegidas(files);
    setFilas([]);
  }

  async function subir() {
    const files = elegidas;
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
    setElegidas([]);
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
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={subiendo}
        onChange={(e) => tomar(e.target.files)}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          if (!subiendo) tomar(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center ${arrastrando ? 'border-accent bg-accent/5' : 'border-line-2'}`}
      >
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={subiendo}
          className="rounded-lg border-2 border-accent px-4 py-2 text-sm font-semibold text-accent disabled:opacity-50"
        >
          Elegir fotos
        </button>
        <p className="text-xs text-text-mute">o arrastralas acá</p>
        <p className="text-sm font-semibold text-text">
          {elegidas.length === 0 ? 'Ninguna foto elegida' : `${elegidas.length} foto${elegidas.length === 1 ? '' : 's'} elegida${elegidas.length === 1 ? '' : 's'}`}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} disabled={subiendo} />
        Reemplazar las fotos que ya tenga cada artículo
      </label>
      <button
        type="button"
        onClick={subir}
        disabled={subiendo || elegidas.length === 0}
        className="w-full rounded-lg bg-accent text-white font-semibold py-2.5 disabled:opacity-50"
      >
        {subiendo
          ? `Subiendo… ${ok + mal} de ${filas.length}`
          : elegidas.length === 0
            ? 'Elegí las fotos primero'
            : `Subir ${elegidas.length} foto${elegidas.length === 1 ? '' : 's'}`}
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
