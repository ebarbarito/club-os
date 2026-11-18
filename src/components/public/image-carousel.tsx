'use client';

import { useEffect, useState } from 'react';
import { FotoEnPreparacion } from '@/components/foto-en-preparacion';

// Fotos de una genética: se ven completas (sin recortar) en un recuadro
// cuadrado; tocando la foto se abre grande para verla bien.
export function ImageCarousel({ images, alt, esGenetica = true }: { images: string[]; alt: string; esGenetica?: boolean }) {
  const [index, setIndex] = useState(0);
  const [grande, setGrande] = useState(false);

  useEffect(() => {
    if (!grande) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGrande(false);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [grande, images.length]);

  if (images.length === 0) {
    return <FotoEnPreparacion className="aspect-square w-full rounded-lg mb-3" esGenetica={esGenetica} />;
  }

  const flechas = (tam: string) =>
    images.length > 1 && (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i - 1 + images.length) % images.length);
          }}
          aria-label="Foto anterior"
          className={`absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 text-white ${tam}`}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i + 1) % images.length);
          }}
          aria-label="Foto siguiente"
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 text-white ${tam}`}
        >
          ›
        </button>
      </>
    );

  return (
    <>
      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-surface-3">
        <button type="button" onClick={() => setGrande(true)} className="block h-full w-full" aria-label={`Ver ${alt} en grande`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[index]} alt={alt} loading="lazy" className="h-full w-full object-contain" />
        </button>
        {flechas('h-8 w-8 text-lg')}
        {images.length > 1 && (
          <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`} />
            ))}
          </div>
        )}
      </div>

      {grande && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setGrande(false)}
          role="dialog"
          aria-label={alt}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[index]} alt={alt} className="max-h-[88vh] max-w-full rounded-lg object-contain" />
          {flechas('h-12 w-12 text-3xl')}
          <button
            type="button"
            onClick={() => setGrande(false)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 h-11 w-11 rounded-full bg-white/15 text-2xl text-white"
          >
            ×
          </button>
          <p className="absolute bottom-4 left-0 right-0 text-center font-display text-2xl text-white">{alt}</p>
        </div>
      )}
    </>
  );
}
