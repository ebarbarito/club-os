'use client';

import { useMemo, useRef, useState } from 'react';
import { money } from '@/lib/format';

export type SearchableMember = { id: string; name: string; dni: string; member_number: number; adeudado?: number };

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';

// Buscador de socio por n° de socio, DNI o apellido/nombre — filtra en el
// cliente sobre la lista ya cargada (alcanza para el volumen de un club).
// Navegable por teclado (↑/↓ + Enter) para no depender del mouse; al elegir
// un socio dispara onSelected para que el formulario mueva el foco al
// siguiente campo (ej. la grilla de artículos).
export function MemberSearch({
  members,
  value,
  onChange,
  onSelected,
  autoFocus,
}: {
  members: SearchableMember[];
  value: string;
  onChange: (memberId: string) => void;
  onSelected?: () => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = members.find((m) => m.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members.slice(0, 20);
    return members
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) || m.dni.includes(q) || String(m.member_number).includes(q),
      )
      .slice(0, 20);
  }, [members, query]);

  const safeHighlighted = Math.min(highlighted, Math.max(filtered.length - 1, 0));

  function select(memberId: string) {
    onChange(memberId);
    setQuery('');
    setOpen(false);
    onSelected?.();
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
        <div>
          <span className="font-medium text-text">
            #{selected.member_number} · {selected.name}
          </span>
          <span className="text-text-mute"> · DNI {selected.dni}</span>
          {typeof selected.adeudado === 'number' && <span className="text-red font-medium"> · {money(selected.adeudado)}</span>}
        </div>
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
        autoFocus={autoFocus}
        placeholder="Buscar por n° de socio, DNI o apellido…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={inputCls}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-line-2 bg-surface shadow-lg">
          {filtered.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => select(m.id)}
              className={`w-full text-left px-3 py-2 text-sm ${i === safeHighlighted ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
            >
              <span className="font-medium text-text">
                #{m.member_number} · {m.name}
              </span>
              <span className="text-text-mute"> · DNI {m.dni}</span>
              {typeof m.adeudado === 'number' && <span className="text-red font-medium"> · {money(m.adeudado)}</span>}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-text-mute">Sin resultados.</p>}
        </div>
      )}
    </div>
  );
}
