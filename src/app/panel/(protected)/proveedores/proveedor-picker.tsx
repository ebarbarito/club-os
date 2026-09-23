'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { money } from '@/lib/format';

export type ProveedorRow = {
  id: string;
  name: string;
  rubro: string | null;
  cuit: string | null;
  saldo: number;
};

export function ProveedorPicker({ proveedores }: { proveedores: ProveedorRow[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return proveedores;
    return proveedores.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.rubro ?? '').toLowerCase().includes(q) ||
        (p.cuit ?? '').includes(q),
    );
  }, [proveedores, query]);

  const totalSaldo = proveedores.reduce((s, p) => s + p.saldo, 0);

  return (
    <div className="space-y-3">
      {proveedores.length > 4 && (
        <input
          autoFocus
          placeholder="Buscar por nombre, rubro o CUIT…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line-2 bg-surface p-10 text-center text-text-mute text-sm">
          Sin resultados para &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div className="rounded-xl border border-line-2 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-text-soft text-xs">
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Rubro</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/panel/proveedores/${p.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.cuit && (
                      <span className="text-text-mute ml-2 text-xs hidden sm:inline">
                        CUIT {p.cuit}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-soft hidden sm:table-cell">
                    {p.rubro ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.saldo > 0 ? (
                      <span className="font-semibold text-red">{money(p.saldo)}</span>
                    ) : p.saldo < 0 ? (
                      <span className="font-semibold text-emerald-600">
                        {money(Math.abs(p.saldo))} a favor
                      </span>
                    ) : (
                      <span className="text-text-mute">Sin deuda</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {proveedores.length > 1 && (
              <tfoot>
                <tr className="border-t border-line bg-surface-2 text-xs font-semibold">
                  <td className="px-4 py-2 text-text-soft" colSpan={2}>
                    {filtered.length === proveedores.length
                      ? `${proveedores.length} proveedor${proveedores.length !== 1 ? 'es' : ''}`
                      : `${filtered.length} de ${proveedores.length}`}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {totalSaldo > 0 ? (
                      <span className="text-red">Total: {money(totalSaldo)}</span>
                    ) : totalSaldo < 0 ? (
                      <span className="text-emerald-600">
                        Total: {money(Math.abs(totalSaldo))} a favor
                      </span>
                    ) : (
                      <span className="text-text-mute">Sin deuda total</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {proveedores.length === 0 && (
        <div className="rounded-xl border border-line-2 bg-surface p-12 text-center text-text-soft text-sm">
          No hay proveedores registrados todavía.
        </div>
      )}
    </div>
  );
}
