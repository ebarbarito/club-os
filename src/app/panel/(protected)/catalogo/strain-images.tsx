'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadStrainImages, removeStrainImage } from './actions';

export function StrainImages({ strainId, images }: { strainId: string; images: string[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpload() {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return;
    setError(null);

    const formData = new FormData();
    formData.set('strain_id', strainId);
    for (const file of files) formData.append('images', file);

    startTransition(async () => {
      const res = await uploadStrainImages(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    });
  }

  function handleRemove(url: string) {
    startTransition(async () => {
      const res = await removeStrainImage(strainId, url);
      if (res?.error) setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="border-t border-line pt-3 mt-3">
      <p className="text-xs font-semibold text-text-mute uppercase mb-2">Fotos (carrusel del sitio público)</p>

      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {images.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-line" />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                disabled={pending}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red text-white text-xs leading-5"
                aria-label="Quitar foto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="text-xs flex-1" />
        <button
          type="button"
          onClick={handleUpload}
          disabled={pending}
          className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {pending ? 'Subiendo…' : 'Subir'}
        </button>
      </div>
      {error && <p className="text-red text-xs mt-1">{error}</p>}
    </div>
  );
}
