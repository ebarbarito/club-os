'use client';

import { useEffect, useState } from 'react';
import { fmtDateTime } from '@/lib/format';
import { historialDispensa, type MovimientoDispensa } from './actions';

// Historial de la sala dispensa: ingresos, egresos y saldo en columnas.
// Se carga al abrir el modal (no en cada fila de la tabla).
export function DispensaHistory({ strainId, unit }: { strainId: string; unit: string }) {
  const [estado, setEstado] = useState<
    { cargando: true } | { error: string } | { movimientos: MovimientoDispensa[]; actual: number }
  >({ cargando: true });

  useEffect(() => {
    let vivo = true;
    historialDispensa(strainId)
      .then((r) => vivo && setEstado(r))
      .catch(() => vivo && setEstado({ error: 'No se pudo cargar el historial' }));
    return () => {
      vivo = false;
    };
  }, [strainId]);

  if ('cargando' in estado) return <p className="text-text-mute text-sm">Cargando…</p>;
  if ('error' in estado) return <p className="text-red text-sm">{estado.error}</p>;

  const { movimientos, actual } = estado;
  const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const totalIngresos = movimientos.reduce((s, m) => s + m.ingreso, 0);
  const totalEgresos = movimientos.reduce((s, m) => s + m.egreso, 0);

  if (movimientos.length === 0) {
    return (
      <p className="text-text-mute text-sm">
        Sin movimientos registrados. Saldo actual: {num(actual)} {unit}
      </p>
    );
  }

  return (
    <div className="text-sm">
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <div className="text-xs text-text-soft">Ingresos</div>
          <div className="font-semibold text-accent">+{num(totalIngresos)} {unit}</div>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <div className="text-xs text-text-soft">Egresos</div>
          <div className="font-semibold text-red">−{num(totalEgresos)} {unit}</div>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <div className="text-xs text-text-soft">Saldo actual</div>
          <div className="font-semibold text-text">
            {num(actual)} {unit}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-text-soft text-xs">
              <th className="text-left py-1.5 pr-3 font-medium">Fecha</th>
              <th className="text-left py-1.5 pr-3 font-medium">Movimiento</th>
              <th className="text-right py-1.5 px-2 font-medium">Ingresos</th>
              <th className="text-right py-1.5 px-2 font-medium">Egresos</th>
              <th className="text-right py-1.5 pl-2 font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m, i) => (
              <tr key={i} className="border-t border-line align-top">
                <td className="py-2 pr-3 text-text-soft text-xs whitespace-nowrap">{fmtDateTime(m.fecha)}</td>
                <td className="py-2 pr-3 text-xs">
                  <div className="text-text">{m.concepto}</div>
                  {m.detalle && <div className="text-text-mute">{m.detalle}</div>}
                </td>
                <td className="py-2 px-2 text-right text-xs tabular-nums font-semibold text-accent">
                  {m.ingreso ? `${num(m.ingreso)} ${unit}` : ''}
                </td>
                <td className="py-2 px-2 text-right text-xs tabular-nums font-semibold text-red">
                  {m.egreso ? `${num(m.egreso)} ${unit}` : ''}
                </td>
                <td className="py-2 pl-2 text-right text-xs tabular-nums font-semibold text-text">
                  {num(m.saldo)} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-mute">Más reciente arriba. El saldo es el stock de dispensa después de cada movimiento.</p>
    </div>
  );
}
