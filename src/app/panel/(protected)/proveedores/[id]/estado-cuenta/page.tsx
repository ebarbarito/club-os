import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { money, fmtDate } from '@/lib/format';

export default async function EstadoCuentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const { id } = await params;
  const supabase = await createClient();

  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('id, name, cuit, rubro')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!proveedor) notFound();

  const { data: comprobantes } = await supabase
    .from('proveedor_comprobantes')
    .select('id, tipo, fecha, punto_venta, numero, total, saldo, created_at')
    .eq('proveedor_id', id)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true });

  const { data: pagos } = await supabase
    .from('proveedor_pagos')
    .select('id, fecha, total, notas, created_at')
    .eq('proveedor_id', id)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true });

  // ── Construir ledger cronológico ──────────────────────────────────────────

  type LedgerRow = {
    key: string;
    fecha: string;
    created_at: string;
    tipo: 'factura' | 'nota_credito' | 'pago';
    descripcion: string;
    debe: number;    // aumenta la deuda
    haber: number;   // reduce la deuda
  };

  const rows: LedgerRow[] = [];

  for (const c of comprobantes ?? []) {
    const nro = `${c.punto_venta}-${c.numero}`;
    if (c.tipo === 'factura') {
      rows.push({
        key: `comp-${c.id}`,
        fecha: c.fecha,
        created_at: c.created_at,
        tipo: 'factura',
        descripcion: `Factura ${nro}`,
        debe: c.total,
        haber: 0,
      });
    } else {
      rows.push({
        key: `comp-${c.id}`,
        fecha: c.fecha,
        created_at: c.created_at,
        tipo: 'nota_credito',
        descripcion: `Nota de crédito ${nro}`,
        debe: 0,
        haber: c.total,
      });
    }
  }

  for (const p of pagos ?? []) {
    rows.push({
      key: `pago-${p.id}`,
      fecha: p.fecha,
      created_at: p.created_at,
      tipo: 'pago',
      descripcion: p.notas ? `Pago — ${p.notas}` : 'Pago',
      debe: 0,
      haber: p.total,
    });
  }

  // Ordenar por fecha, luego por created_at
  rows.sort((a, b) => {
    const dateDiff = a.fecha.localeCompare(b.fecha);
    if (dateDiff !== 0) return dateDiff;
    return a.created_at.localeCompare(b.created_at);
  });

  // Calcular saldo acumulado corriendo
  let saldoAcum = 0;
  const rowsConSaldo = rows.map((r) => {
    saldoAcum += r.debe - r.haber;
    return { ...r, saldoAcum };
  });

  // ── Resumen ───────────────────────────────────────────────────────────────

  const totalFacturasOrig = (comprobantes ?? [])
    .filter((c) => c.tipo === 'factura')
    .reduce((s, c) => s + c.total, 0);

  const totalNCs = (comprobantes ?? [])
    .filter((c) => c.tipo === 'nota_credito')
    .reduce((s, c) => s + c.total, 0);

  const totalPagado = (pagos ?? []).reduce((s, p) => s + p.total, 0);

  // Saldo real = suma de saldos actuales por comprobante (ya considera los pagos/NCs aplicados)
  const saldoActual = (comprobantes ?? []).reduce((s, c) => s + c.saldo, 0);

  const creditoDisponible = (comprobantes ?? [])
    .filter((c) => c.tipo === 'nota_credito' && c.saldo < 0)
    .reduce((s, c) => s + Math.abs(c.saldo), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/panel/proveedores/${id}`}
            className="text-xs text-text-mute hover:text-accent mb-1 inline-block"
          >
            ← Volver a {proveedor.name}
          </Link>
          <h1 className="font-display text-2xl font-bold text-text">Estado de cuenta</h1>
          <p className="text-text-soft text-sm">
            {proveedor.name}
            {proveedor.cuit && <span className="text-text-mute ml-2">CUIT {proveedor.cuit}</span>}
          </p>
        </div>
        <button
          onClick={() => typeof window !== 'undefined' && window.print()}
          className="rounded-lg border border-line-2 text-text-soft text-sm font-semibold px-3 py-1.5 hover:border-accent hover:text-accent print:hidden"
        >
          Imprimir
        </button>
      </div>

      {/* Tiles resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
        <div className="rounded-xl border border-line-2 bg-surface p-4">
          <p className="text-xs text-text-mute mb-1">Total facturas</p>
          <p className="text-lg font-semibold text-red tabular-nums">{money(totalFacturasOrig)}</p>
        </div>
        <div className="rounded-xl border border-line-2 bg-surface p-4">
          <p className="text-xs text-text-mute mb-1">Notas de crédito</p>
          <p className="text-lg font-semibold text-emerald-600 tabular-nums">{money(totalNCs)}</p>
        </div>
        <div className="rounded-xl border border-line-2 bg-surface p-4">
          <p className="text-xs text-text-mute mb-1">Pagos realizados</p>
          <p className="text-lg font-semibold text-text tabular-nums">{money(totalPagado)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${
          saldoActual > 0
            ? 'border-red/30 bg-red/5'
            : saldoActual < 0
            ? 'border-emerald-600/30 bg-emerald-600/5'
            : 'border-line-2 bg-surface'
        }`}>
          <p className="text-xs text-text-mute mb-1">Saldo pendiente</p>
          <p className={`text-lg font-bold tabular-nums ${
            saldoActual > 0 ? 'text-red' : saldoActual < 0 ? 'text-emerald-600' : 'text-text-soft'
          }`}>
            {saldoActual === 0
              ? 'Sin deuda'
              : saldoActual > 0
              ? money(saldoActual)
              : `${money(Math.abs(saldoActual))} a favor`}
          </p>
          {creditoDisponible > 0 && (
            <p className="text-xs text-emerald-600 mt-1">
              Crédito disponible: {money(creditoDisponible)}
            </p>
          )}
        </div>
      </div>

      {/* Ledger */}
      <div className="rounded-xl border border-line-2 overflow-hidden">
        <div className="bg-surface-2 px-4 py-2 border-b border-line">
          <p className="text-xs font-semibold text-text-soft uppercase tracking-wide">
            Movimientos cronológicos
          </p>
        </div>

        {rowsConSaldo.length === 0 ? (
          <div className="p-8 text-center text-text-soft text-sm">
            No hay movimientos registrados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/50 text-text-soft text-xs">
                <th className="px-4 py-2 text-left font-medium">Fecha</th>
                <th className="px-4 py-2 text-left font-medium">Concepto</th>
                <th className="px-4 py-2 text-right font-medium">Debe</th>
                <th className="px-4 py-2 text-right font-medium">Haber</th>
                <th className="px-4 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rowsConSaldo.map((row) => (
                <tr
                  key={row.key}
                  className={`${
                    row.tipo === 'pago'
                      ? 'bg-accent/5'
                      : row.tipo === 'nota_credito'
                      ? 'bg-emerald-600/5'
                      : ''
                  }`}
                >
                  <td className="px-4 py-3 text-text-soft tabular-nums whitespace-nowrap">
                    {fmtDate(row.fecha)}
                  </td>
                  <td className="px-4 py-3 text-text">
                    <span className={`inline-flex items-center gap-1.5`}>
                      {row.tipo === 'factura' && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red flex-shrink-0" />
                      )}
                      {row.tipo === 'nota_credito' && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                      {row.tipo === 'pago' && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                      )}
                      {row.descripcion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.debe > 0 ? (
                      <span className="text-red font-medium">{money(row.debe)}</span>
                    ) : (
                      <span className="text-text-mute">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.haber > 0 ? (
                      <span className="text-emerald-600 font-medium">{money(row.haber)}</span>
                    ) : (
                      <span className="text-text-mute">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    <span className={row.saldoAcum > 0 ? 'text-red' : row.saldoAcum < 0 ? 'text-emerald-600' : 'text-text-soft'}>
                      {row.saldoAcum === 0 ? '—' : row.saldoAcum > 0 ? money(row.saldoAcum) : `(${money(Math.abs(row.saldoAcum))})`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line bg-surface-2 font-semibold text-sm">
                <td className="px-4 py-3" colSpan={2}>
                  <span className="text-text-soft text-xs uppercase tracking-wide">Totales</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-red">
                  {money(rowsConSaldo.reduce((s, r) => s + r.debe, 0))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                  {money(rowsConSaldo.reduce((s, r) => s + r.haber, 0))}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${saldoActual > 0 ? 'text-red' : saldoActual < 0 ? 'text-emerald-600' : 'text-text-soft'}`}>
                  {saldoActual === 0
                    ? '—'
                    : saldoActual > 0
                    ? money(saldoActual)
                    : `(${money(Math.abs(saldoActual))})`}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Detalle comprobantes actuales */}
      <div className="rounded-xl border border-line-2 overflow-hidden print:break-before-page">
        <div className="bg-surface-2 px-4 py-2 border-b border-line">
          <p className="text-xs font-semibold text-text-soft uppercase tracking-wide">
            Comprobantes — estado actual
          </p>
        </div>

        {(comprobantes ?? []).length === 0 ? (
          <div className="p-8 text-center text-text-soft text-sm">No hay comprobantes.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/50 text-text-soft text-xs">
                <th className="px-4 py-2 text-left font-medium">Fecha</th>
                <th className="px-4 py-2 text-left font-medium">Tipo</th>
                <th className="px-4 py-2 text-left font-medium">Nro.</th>
                <th className="px-4 py-2 text-right font-medium">Total original</th>
                <th className="px-4 py-2 text-right font-medium">Aplicado</th>
                <th className="px-4 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(comprobantes ?? [])
                .slice()
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .map((c) => {
                  const nro = `${c.punto_venta}-${c.numero}`;
                  const isFactura = c.tipo === 'factura';
                  // Para factura: aplicado = total - saldo
                  // Para NC: aplicado = total - abs(saldo) = lo que ya se usó del crédito
                  const aplicado = isFactura
                    ? c.total - c.saldo
                    : c.total - Math.abs(c.saldo);
                  const saldoDisplay = isFactura ? c.saldo : Math.abs(c.saldo);
                  const saldoPendiente = isFactura ? c.saldo > 0 : Math.abs(c.saldo) > 0;

                  return (
                    <tr key={c.id} className={!saldoPendiente ? 'opacity-60' : ''}>
                      <td className="px-4 py-3 text-text-soft tabular-nums">{fmtDate(c.fecha)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          isFactura
                            ? 'bg-red/10 text-red'
                            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {isFactura ? 'Factura' : 'N. Crédito'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text">{nro}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(c.total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-soft">
                        {aplicado > 0 ? money(aplicado) : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${
                        !saldoPendiente
                          ? 'text-text-mute'
                          : isFactura
                          ? 'text-red'
                          : 'text-emerald-600'
                      }`}>
                        {saldoPendiente
                          ? isFactura
                            ? money(saldoDisplay)
                            : `${money(saldoDisplay)} crédito`
                          : 'Cancelado'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
