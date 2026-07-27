'use client';

import { useState } from 'react';

export function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="h-40 rounded-lg bg-surface-3 flex items-center justify-center text-text-mute text-xs mb-3">
        Sin foto
      </div>
    );
  }

  return (
    <div className="relative h-40 rounded-lg overflow-hidden mb-3 bg-surface-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[index]} alt={alt} className="h-full w-full object-cover" />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
            aria-label="Anterior"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/40 text-white text-xs"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % images.length)}
            aria-label="Siguiente"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/40 text-white text-xs"
          >
            ›
          </button>
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
            {images.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
