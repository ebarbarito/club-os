'use client';

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { money } from '@/lib/format';

export type SearchableItem = {
  id: string;
  code: string | null;
  name: string;
  item_type: 'genetica' | 'accesorio';
  price_per_gram: number;
  grams: number;
};

export type ItemSearchHandle = { focus: () => void };

function label(it: SearchableItem): string {
  return `${it.code ? `${it.code} · ` : ''}${it.name} · disp. ${it.grams} ${it.item_type === 'genetica' ? 'g' : 'u.'} · ${money(it.price_per_gram)}`;
}

// Buscador de artículo por nombre o código — mismo patrón que el
// buscador de socio (filtra en cliente, navegable por teclado), pero
// además siempre ordena alfabético. Expone `focus()` via ref para que un
// formulario con varias filas pueda mover el foco a la siguiente al
// agregar una fila.
export const ItemSearch = forwardRef<
  ItemSearchHandle,
  {
    items: SearchableItem[];
    value: string;
    onChange: (itemId: string) => void;
  }
>(function ItemSearch({ items, value, onChange }, ref) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);
  const selected = items.find((it) => it.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted.slice(0, 30);
    return sorted.filter((it) => it.name.toLowerCase().includes(q) || (it.code ?? '').toLowerCase().includes(q)).slice(0, 30);
  }, [sorted, query]);

  const safeHighlighted = Math.min(highlighted, Math.max(filtered.length - 1, 0));

  function select(itemId: string) {
    onChange(itemId);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[safeHighlighted]) select(filtered[safeHighlighted].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  if (selected && !open) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-line-2 px-3 py-2 text-sm">
        <span className="truncate">{label(selected)}</span>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="text-accent text-xs font-semibold shrink-0 ml-2"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        placeholder="Buscar artículo…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-line-2 bg-surface shadow-lg">
          {filtered.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => select(it.id)}
              className={`w-full text-left px-3 py-2 text-sm ${i === safeHighlighted ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
            >
              {label(it)}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-text-mute">Sin resultados.</p>}
        </div>
      )}
    </div>
  );
});
