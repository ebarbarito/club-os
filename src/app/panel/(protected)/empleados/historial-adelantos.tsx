import { money, fmtDateTime } from '@/lib/format';
import { nombreMes, periodoDe, type EstadoSueldo } from '@/lib/empleados/sueldo';
import type { RetiroDetalle } from '@/lib/empleados/sueldo-server';

// Historial de pagos y adelantos de un empleado, mes por mes (más nuevo
// arriba), con lo retirado a cuenta del mes siguiente.
export function HistorialAdelantos({ estado, retiros }: { estado: EstadoSueldo; retiros: RetiroDetalle[] }) {
  const meses = [...estado.meses].reverse().filter((m) => m.retirado !== 0 || m.arrastre > 0 || m === estado.actual);
  if (retiros.length === 0) return <p className="text-text-mute text-sm">Sin pagos ni adelantos registrados.</p>;

  return (
    <div className="space-y-5 text-sm">
      {meses.map((m) => {
        const delMes = retiros.filter((r) => periodoDe(r.fecha) === m.periodo).reverse();
        return (
          <div key={m.periodo} className="rounded-lg border border-line">
            <div className="flex flex-wrap items-baseline justify-between gap-2 bg-surface-2 px-4 py-2.5 rounded-t-lg">
              <p className="font-semibold text-text capitalize">{nombreMes(m.periodo, true)}</p>
              <p className="text-xs text-text-soft">
                Sueldo {money(m.sueldo)} · Retirado {money(m.consumido)} ·{' '}
                {m.aCuentaProximo > 0.005 ? (
                  <span className="font-semibold text-amber-tx">{money(m.aCuentaProximo)} a cuenta del mes siguiente</span>
                ) : (
                  <span className={m.disponible > 0.005 ? 'font-semibold text-accent' : ''}>Pendiente {money(m.disponible)}</span>
                )}
              </p>
            </div>
            <table className="w-full">
              <tbody>
                {m.arrastre > 0.005 && (
                  <tr className="border-t border-line">
                    <td className="px-4 py-2 text-xs text-text-soft" colSpan={2}>
                      Adelantado en {nombreMes(estado.meses[estado.meses.indexOf(m) - 1]?.periodo ?? m.periodo)} a cuenta de este mes
                    </td>
                    <td className="px-4 py-2 text-right text-xs font-semibold text-amber-tx tabular-nums">{money(m.arrastre)}</td>
                  </tr>
                )}
                {delMes.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-4 py-2 text-xs text-text-soft whitespace-nowrap">{fmtDateTime(r.fecha)}</td>
                    <td className="px-4 py-2 text-xs">
                      <div className="text-text">{r.concepto}</div>
                      {r.cuenta && <div className="text-text-mute">{r.cuenta}</div>}
                    </td>
                    <td
                      className={`px-4 py-2 text-right text-xs font-semibold tabular-nums ${r.monto < 0 ? 'text-accent' : 'text-text'}`}
                    >
                      {r.monto < 0 ? `+${money(-r.monto)}` : money(r.monto)}
                    </td>
                  </tr>
                ))}
                {delMes.length === 0 && m.arrastre <= 0.005 && (
                  <tr className="border-t border-line">
                    <td className="px-4 py-2 text-xs text-text-mute" colSpan={3}>
                      Sin retiros este mes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
