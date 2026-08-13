'use client';

import { useMemo, useState } from 'react';

export type SearchableMember = { id: string; name: string; dni: string; member_number: number };

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';

// Buscador de socio por n° de socio, DNI o apellido/nombre — filtra en el
// cliente sobre la lista ya cargada (alcanza para el volumen de un club).
export function MemberSearch({
  members,
  value,
  onChange,
}: {
  members: SearchableMember[];
  value: string;
  onChange: (memberId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

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

  if (selected && !open) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-line-2 px-3 py-2 text-sm">
        <div>
          <span className="font-medium text-text">
            #{selected.member_number} · {selected.name}
          </span>
          <span className="text-text-mute"> · DNI {selected.dni}</span>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="text-accent text-xs font-semibold shrink-0 ml-2">
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        autoFocus={open}
        placeholder="Buscar por n° de socio, DNI o apellido…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        className={inputCls}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-line-2 bg-surface shadow-lg">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id);
                setQuery('');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2"
            >
              <span className="font-medium text-text">
                #{m.member_number} · {m.name}
              </span>
              <span className="text-text-mute"> · DNI {m.dni}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-text-mute">Sin resultados.</p>}
        </div>
      )}
    </div>
  );
}
