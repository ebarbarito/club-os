'use client';

import { useState } from 'react';
import { money } from '@/lib/format';
import { useStore } from './store';
import type { CatalogItem } from '@/lib/public/get-catalog';

const TYPES = ['Todos', 'Indica', 'Sativa', 'Híbrida', 'Alto CBD'];

export function CatalogSection({ catalog }: { catalog: CatalogItem[] }) {
  const [type, setType] = useState('Todos');
  const { addToCart } = useStore();
  const [grams, setGrams] = useState<Record<string, number>>({});

  const filtered = type === 'Todos' ? catalog : catalog.filter((c) => c.type === type);

  return (
    <section id="geneticas" className="py-16 px-6 max-w-6xl mx-auto">
      <h2 className="font-display text-3xl font-bold text-text mb-2">Genéticas</h2>
      <p className="text-text-soft mb-6">Catálogo disponible para socios validados.</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1.5 text-sm border ${
              type === t ? 'border-accent text-accent font-semibold' : 'border-line-2 text-text-soft'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div key={item.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-display font-bold text-text">{item.name}</h3>
              <span className="text-xs rounded-full bg-surface-3 px-2 py-0.5 text-text-soft">{item.type}</span>
            </div>
            <p className="text-text-mute text-xs mb-3">
              {item.thc ? `THC ${item.thc}%` : ''} {item.cbd ? `· CBD ${item.cbd}%` : ''}
            </p>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-text">{money(item.price_per_gram)}/g</span>
              <span className={`text-xs ${item.grams > 0 ? 'text-accent' : 'text-red'}`}>
                {item.grams > 0 ? `${item.grams} g disponibles` : 'Sin stock'}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={item.grams}
                defaultValue={1}
                disabled={item.grams <= 0}
                onChange={(e) => setGrams((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                className="w-16 rounded-lg border border-line-2 px-2 py-1.5 text-sm"
              />
              <button
                disabled={item.grams <= 0}
                onClick={() =>
                  addToCart(
                    { strainId: item.id, name: item.name, pricePerGram: item.price_per_gram },
                    grams[item.id] ?? 1,
                  )
                }
                className="flex-1 rounded-lg bg-accent text-white text-sm font-semibold py-1.5 disabled:opacity-50"
              >
                Reservar
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="col-span-full text-center text-text-mute py-10">Sin genéticas en esta categoría.</p>}
      </div>
    </section>
  );
}
