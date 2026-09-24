'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { money } from '@/lib/format';

export type ProveedorRow = {
  id: string;
  numero: number | null;
  name: string;
  rubro: string | null;
  cuit: string | null;
  saldo: number;
  saldoUSD: number;
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

  const totalSaldoARS = proveedores.reduce((s, p) => s + p.saldo, 0);
  const totalSaldoUSD = proveedores.reduce((s, p) => s + (p.saldoUSD ?? 0), 0);

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
                <th className="px-4 py-3 text-left font-medium w-14">Nro.</th>
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Rubro</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3 text-text-mute font-mono text-xs tabular-nums">
                    {p.numero != null ? String(p.numero).padStart(3, '0') : '—'}
                  </td>
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
                    {(p.saldo === 0 && (p.saldoUSD ?? 0) === 0) ? (
                      <span className="text-text-mute">Sin deuda</span>
                    ) : (
                      <span className="flex flex-col gap-0.5 items-end">
                        {p.saldo !== 0 && (
                          <span className={`font-semibold ${p.saldo > 0 ? 'text-red' : 'text-emerald-600'}`}>
                            {p.saldo > 0 ? money(p.saldo) : money(Math.abs(p.saldo))}
                          </span>
                        )}
                        {(p.saldoUSD ?? 0) !== 0 && (
                          <span className={`font-semibold text-sm ${(p.saldoUSD ?? 0) > 0 ? 'text-red' : 'text-emerald-600'}`}>
                            {'USD ' + Math.abs(p.saldoUSD ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {proveedores.length > 1 && (
              <tfoot>
                <tr className="border-t border-line bg-surface-2 text-xs font-semibold">
                  <td className="px-4 py-2 text-text-soft" colSpan={3}>
                    {filtered.length === proveedores.length
                      ? `${proveedores.length} proveedor${proveedores.length !== 1 ? 'es' : ''}`
                      : `${filtered.length} de ${proveedores.length}`}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {(totalSaldoARS === 0 && totalSaldoUSD === 0) ? (
                      <span className="text-text-mute">Sin deuda total</span>
                    ) : (
                      <span className="flex flex-col gap-0.5 items-end">
                        {totalSaldoARS !== 0 && (
                          <span className={totalSaldoARS > 0 ? 'text-red' : 'text-emerald-600'}>
                            {totalSaldoARS > 0 ? money(totalSaldoARS) : money(Math.abs(totalSaldoARS))} ARS
                          </span>
                        )}
                        {totalSaldoUSD !== 0 && (
                          <span className={totalSaldoUSD > 0 ? 'text-red' : 'text-emerald-600'}>
                            {'USD ' + Math.abs(totalSaldoUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </span>
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
