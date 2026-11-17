'use client';

import { useRef, useState } from 'react';

// Foto con la cámara de la tablet. Se achica antes de enviarla (máx. 1600 px,
// JPEG) para que el formulario completo no pese de más.
async function achicar(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function FotoInput({ name, label, ayuda }: { name: string; label: string; ayuda?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function cambio(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      setPreview(null);
      return;
    }
    setProcesando(true);
    const chico = await achicar(file);
    if (chico !== file) {
      const dt = new DataTransfer();
      dt.items.add(chico);
      input.files = dt.files;
    }
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(chico);
    });
    setProcesando(false);
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-line-2 p-4 flex flex-col items-center gap-3 text-center">
      <p className="font-semibold text-text">{label}</p>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={label} className="max-h-40 rounded-lg object-contain" />
      ) : (
        <div className="h-28 w-full rounded-lg bg-surface-2 flex items-center justify-center text-4xl" aria-hidden>
          📷
        </div>
      )}
      {ayuda && <p className="text-text-mute text-sm">{ayuda}</p>}
      <input ref={ref} type="file" name={name} accept="image/*" capture="environment" onChange={cambio} className="hidden" />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={procesando}
        className="rounded-xl border-2 border-accent text-accent font-semibold px-5 py-3 text-base disabled:opacity-60"
      >
        {procesando ? 'Procesando…' : preview ? 'Sacar otra' : 'Sacar foto'}
      </button>
    </div>
  );
}
