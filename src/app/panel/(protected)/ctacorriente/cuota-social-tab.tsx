'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { money, fmtDate } from '@/lib/format';
import { confirmarCuotaSocial, acreditarCuotaSocial } from './actions';

type Candidate = { memberId: string; memberName: string; memberNumber: number | null; cuotaSocial: number };
type Pending = { dispensaId: string; number: number; memberName: string; amount: number; createdAt: string };

export function CuotaSocialTab({
  candidates,
  pending,
  periodoLabel,
}: {
  candidates: Candidate[];
  pending: Pending[];
  periodoLabel: string;
}) {
  const router = useRouter();
  const [pendingGen, startGen] = useTransition();
  const [pendingAcreditar, startAcreditar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidates.map((c) => [c.memberId, String(c.cuotaSocial)])),
  );
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const rows = candidates.filter((c) => !removed.has(c.memberId));
  const total = rows.reduce((s, c) => s + (Number(amounts[c.memberId]) || 0), 0);

  function confirmar() {
    setError(null);
    const entries = rows
      .map((c) => ({ memberId: c.memberId, amount: Number(amounts[c.memberId]) || 0 }))
      .filter((e) => e.amount > 0);
    if (entries.length === 0) {
      setError('No hay ningún socio para generar');
      return;
    }
    if (!confirm(`¿Generar ${entries.length} cargo(s) de cuota social — ${periodoLabel}?`)) return;
    startGen(async () => {
      const res = await confirmarCuotaSocial(entries);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function acreditar(dispensaId: string) {
    if (!confirm('¿Ya llegó el comprobante de pago de esta cuota? Se va a acreditar como crédito de producto.')) return;
    startAcreditar(async () => {
      const res = await acreditarCuotaSocial(dispensaId);
      if (res?.error) {
        setError(res.error);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="font-semibold text-text">Generar cuotas del mes</p>
            <p className="text-text-mute text-xs">{periodoLabel} — socios con factura automática y sin cargo generado todavía</p>
          </div>
          <button
            type="button"
            disabled={pendingGen || rows.length === 0}
            onClick={confirmar}
            className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-40"
          >
            {pendingGen ? 'Generando…' : `Confirmar generación (${rows.length})`}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Socio</th>
              <th className="px-4 py-2.5 font-medium text-right">Cuota social</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.memberId} className="border-t border-line">
                <td className="px-4 py-2.5 text-text">
                  {c.memberNumber != null ? `N° ${c.memberNumber} — ` : ''}
                  {c.memberName}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={amounts[c.memberId] ?? ''}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [c.memberId]: e.target.value }))}
                    className="w-28 text-right rounded-lg border border-line-2 px-2 py-1 text-sm outline-none focus:border-accent"
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setRemoved((prev) => new Set(prev).add(c.memberId))}
                    className="text-red text-xs font-semibold"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-text-mute">
                  No hay socios pendientes de generar este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-line flex justify-between font-semibold text-text bg-surface-2">
            <span>Total a generar</span>
            <span>{money(total)}</span>
          </div>
        )}
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <p className="font-semibold text-text">Pendientes de acreditar</p>
          <p className="text-text-mute text-xs">Se acredita cuando llega el comprobante de pago (transferencia/tarjeta/MP) — recién ahí se convierte en crédito de producto</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Fecha</th>
              <th className="px-4 py-2.5 font-medium">Comprobante</th>
              <th className="px-4 py-2.5 font-medium">Socio</th>
              <th className="px-4 py-2.5 font-medium text-right">Monto</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {pending.map((p) => (
              <tr key={p.dispensaId} className="border-t border-line">
                <td className="px-4 py-2.5 text-text-soft">{fmtDate(p.createdAt)}</td>
                <td className="px-4 py-2.5 text-text-soft">N° {p.number}</td>
                <td className="px-4 py-2.5 text-text">{p.memberName}</td>
                <td className="px-4 py-2.5 text-right font-medium text-red">{money(p.amount)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    disabled={pendingAcreditar}
                    onClick={() => acreditar(p.dispensaId)}
                    className="rounded-lg bg-accent text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-60"
                  >
                    Acreditar pago
                  </button>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-mute">
                  No hay cuotas sociales pendientes de acreditar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
