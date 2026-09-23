'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { money, fmtDate } from '@/lib/format';
import { PaymentSplitEditor, newPaymentLine, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { createPagoComprobante } from '../../../actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type ComprobantePendiente = {
  id: string;
  tipo: 'factura' | 'nota_credito';
  fecha: string;
  punto_venta: string;
  numero: string;
  total: number;
  saldo: number;  // facturas: positivo | NCs: negativo
};

type Seleccion = {
  checked: boolean;
  monto: string;
};

function initSelecciones(
  comprobantes: ComprobantePendiente[],
  defaultMonto: (c: ComprobantePendiente) => number,
): Record<string, Seleccion> {
  return Object.fromEntries(
    comprobantes.map((c) => [c.id, { checked: false, monto: String(defaultMonto(c)) }]),
  );
}

export function PagoForm({
  proveedorId,
  proveedorName,
  facturas,
  notasCredito,
  accounts,
}: {
  proveedorId: string;
  proveedorName: string;
  facturas: ComprobantePendiente[];
  notasCredito: ComprobantePendiente[];
  accounts: PaymentAccount[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');
  const [impactaCaja, setImpactaCaja] = useState(true);

  // Facturas seleccionadas — iniciadas con todas chequeadas
  const [selFacturas, setSelFacturas] = useState<Record<string, Seleccion>>(() =>
    Object.fromEntries(
      facturas.map((c) => [c.id, { checked: true, monto: String(c.saldo) }]),
    ),
  );

  // NCs seleccionadas — iniciadas sin checkear; monto = -saldo (el crédito disponible positivo)
  const [selNCs, setSelNCs] = useState<Record<string, Seleccion>>(() =>
    initSelecciones(notasCredito, (c) => Math.abs(c.saldo)),
  );

  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);

  // ── Totales ─────────────────────────────────────────────────────────────────

  const totalFacturas = useMemo(
    () =>
      Object.values(selFacturas)
        .filter((s: Seleccion) => s.checked)
        .reduce((sum: number, s: Seleccion) => sum + (Number(s.monto) || 0), 0),
    [selFacturas],
  );

  const totalNCs = useMemo(
    () =>
      Object.values(selNCs)
        .filter((s: Seleccion) => s.checked)
        .reduce((sum: number, s: Seleccion) => sum + (Number(s.monto) || 0), 0),
    [selNCs],
  );

  // Lo que debe pagarse en efectivo/transferencia
  const totalEfectivo = Math.max(0, totalFacturas - totalNCs);

  const totalPagos = payments.reduce(
    (sum: number, l: PaymentLine) => sum + (Number(l.amount) || 0) * (Number(l.exchangeRate) || 1),
    0,
  );

  // ── Facturas: check all ──────────────────────────────────────────────────────

  const checkedFacturasCount = Object.values(selFacturas).filter((s: Seleccion) => s.checked).length;
  const allFacturasChecked = checkedFacturasCount === facturas.length;
  const someFacturasChecked = checkedFacturasCount > 0 && !allFacturasChecked;

  function toggleAllFacturas() {
    setSelFacturas((prev: Record<string, Seleccion>) => {
      const next = { ...prev };
      const shouldCheck = !allFacturasChecked;
      for (const id of Object.keys(next)) next[id] = { ...next[id], checked: shouldCheck };
      return next;
    });
  }

  function toggleFactura(id: string) {
    setSelFacturas((prev: Record<string, Seleccion>) => ({
      ...prev,
      [id]: { ...prev[id], checked: !prev[id].checked },
    }));
  }

  function setMontoFactura(id: string, value: string) {
    setSelFacturas((prev: Record<string, Seleccion>) => ({ ...prev, [id]: { ...prev[id], monto: value } }));
  }

  // ── NCs: toggle ─────────────────────────────────────────────────────────────

  function toggleNC(id: string) {
    setSelNCs((prev: Record<string, Seleccion>) => ({
      ...prev,
      [id]: { ...prev[id], checked: !prev[id].checked },
    }));
  }

  function setMontoNC(id: string, value: string) {
    setSelNCs((prev: Record<string, Seleccion>) => ({ ...prev, [id]: { ...prev[id], monto: value } }));
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  function submit() {
    setError(null);

    const facturaItems = facturas
      .filter((c) => selFacturas[c.id]?.checked)
      .map((c) => ({ comprobante_id: c.id, monto: Number(selFacturas[c.id].monto) || 0, tipo: 'factura' as const }))
      .filter((item) => item.monto > 0);

    const ncItems = notasCredito
      .filter((c) => selNCs[c.id]?.checked)
      .map((c) => ({ comprobante_id: c.id, monto: Number(selNCs[c.id].monto) || 0, tipo: 'nota_credito' as const }))
      .filter((item) => item.monto > 0);

    if (facturaItems.length === 0) {
      setError('Seleccioná al menos una factura con monto mayor a cero');
      return;
    }

    // Validar NCs no excedan disponible
    for (const item of ncItems) {
      const nc = notasCredito.find((c) => c.id === item.comprobante_id);
      if (nc && item.monto > Math.abs(nc.saldo)) {
        setError(`Nota de crédito ${nc.punto_venta}-${nc.numero}: el monto aplicado (${money(item.monto)}) supera el crédito disponible (${money(Math.abs(nc.saldo))})`);
        return;
      }
    }

    // Si hay pago en efectivo, validar que los medios de pago coincidan
    if (totalEfectivo > 0) {
      const diff = Math.abs(totalEfectivo - totalPagos);
      if (diff > 1) {
        setError(
          `El total de los medios de pago (${money(totalPagos)}) no coincide con el efectivo a pagar (${money(totalEfectivo)})`,
        );
        return;
      }
      if (totalPagos <= 0) {
        setError('Ingresá los montos en las formas de pago');
        return;
      }
    }

    startTransition(async () => {
      const res = await createPagoComprobante(proveedorId, {
        fecha,
        total: totalEfectivo,   // solo el efectivo real
        notas,
        impacta_caja: impactaCaja && totalEfectivo > 0,
        items: [...facturaItems, ...ncItems],
        payments: totalEfectivo > 0
          ? payments
              .filter((p: PaymentLine) => p.accountId && Number(p.amount) > 0)
              .map((p: PaymentLine) => ({
                account_id: p.accountId,
                amount: (Number(p.amount) || 0) * (Number(p.exchangeRate) || 1),
                exchange_rate: Number(p.exchangeRate) || 1,
              }))
          : [],
      });

      if (res?.error) { setError(res.error); return; }
      router.replace(`/panel/proveedores/${proveedorId}`);
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-text-mute mb-1">
          ←{' '}
          <a href={`/panel/proveedores/${proveedorId}`} className="hover:text-accent">
            Volver a {proveedorName}
          </a>
        </p>
        <h1 className="font-display text-2xl font-bold text-text">Registrar pago</h1>
        <p className="text-text-soft text-sm">{proveedorName}</p>
      </div>

      {/* Fecha */}
      <div className="rounded-xl border border-line-2 bg-surface p-4 max-w-xs">
        <label className={labelCls}>Fecha *</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Comprobantes a cancelar */}
      <div className="rounded-xl border border-line-2 overflow-hidden">
        <div className="bg-surface-2 px-4 py-2 border-b border-line">
          <p className="text-xs font-semibold text-text-soft uppercase tracking-wide">
            Facturas a cancelar
          </p>
        </div>

        {facturas.length === 0 ? (
          <div className="p-8 text-center text-text-soft text-sm">
            No hay facturas con saldo pendiente.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/50 text-text-soft text-xs">
                <th className="px-4 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={allFacturasChecked}
                    ref={(el) => { if (el) el.indeterminate = someFacturasChecked; }}
                    onChange={toggleAllFacturas}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-4 py-2 text-left font-medium">Fecha</th>
                <th className="px-4 py-2 text-left font-medium">Nro.</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Saldo pendiente</th>
                <th className="px-4 py-2 text-right font-medium">Monto a pagar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {facturas.map((comp) => {
                const sel = selFacturas[comp.id];
                const nro = `${comp.punto_venta}-${comp.numero}`;
                return (
                  <tr
                    key={comp.id}
                    className={`transition-colors ${sel.checked ? 'bg-accent/5' : 'opacity-50'}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={sel.checked}
                        onChange={() => toggleFactura(comp.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-text-soft tabular-nums">{fmtDate(comp.fecha)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text">{nro}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red font-medium">
                      {money(comp.total)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-red">
                      {money(comp.saldo)}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={comp.saldo}
                        step="0.01"
                        value={sel.monto}
                        onChange={(e) => setMontoFactura(comp.id, e.target.value)}
                        disabled={!sel.checked}
                        className="w-full rounded-lg border border-line-2 px-2 py-1 text-sm outline-none focus:border-accent text-right tabular-nums disabled:opacity-40"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-surface-2 text-sm font-semibold">
                <td className="px-4 py-2" colSpan={4} />
                <td className="px-4 py-2 text-right text-text-soft text-xs">Total facturas</td>
                <td className="px-4 py-2 text-right tabular-nums text-red">
                  {money(totalFacturas)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Notas de crédito disponibles */}
      {notasCredito.length > 0 && (
        <div className="rounded-xl border border-emerald-600/30 overflow-hidden">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 border-b border-emerald-600/20">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              Notas de crédito disponibles
            </p>
            <p className="text-xs text-text-mute mt-0.5">
              Podés aplicar créditos del proveedor para reducir el importe a pagar en efectivo.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/50 text-text-soft text-xs">
                <th className="px-4 py-2 text-left w-8" />
                <th className="px-4 py-2 text-left font-medium">Fecha</th>
                <th className="px-4 py-2 text-left font-medium">Nro.</th>
                <th className="px-4 py-2 text-right font-medium">Total NC</th>
                <th className="px-4 py-2 text-right font-medium">Crédito disponible</th>
                <th className="px-4 py-2 text-right font-medium">Monto a aplicar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {notasCredito.map((nc) => {
                const sel = selNCs[nc.id];
                const nro = `${nc.punto_venta}-${nc.numero}`;
                const credito = Math.abs(nc.saldo);
                return (
                  <tr
                    key={nc.id}
                    className={`transition-colors ${sel.checked ? 'bg-emerald-600/5' : 'opacity-50'}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={sel.checked}
                        onChange={() => toggleNC(nc.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-text-soft tabular-nums">{fmtDate(nc.fecha)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text">{nro}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                      {money(nc.total)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {money(credito)}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={credito}
                        step="0.01"
                        value={sel.monto}
                        onChange={(e) => setMontoNC(nc.id, e.target.value)}
                        disabled={!sel.checked}
                        className="w-full rounded-lg border border-line-2 px-2 py-1 text-sm outline-none focus:border-accent text-right tabular-nums disabled:opacity-40"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totalNCs > 0 && (
              <tfoot>
                <tr className="border-t border-line bg-emerald-50 dark:bg-emerald-900/20 text-sm font-semibold">
                  <td className="px-4 py-2" colSpan={4} />
                  <td className="px-4 py-2 text-right text-text-soft text-xs">Total NC aplicadas</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    − {money(totalNCs)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Resumen antes de pago */}
      {(totalFacturas > 0 || totalNCs > 0) && (
        <div className="rounded-xl border border-line-2 bg-surface-2 px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-text-soft">
            {totalNCs > 0
              ? `Facturas ${money(totalFacturas)} − NC ${money(totalNCs)} =`
              : 'Total a pagar en efectivo:'}
          </span>
          <span className={`text-lg font-bold tabular-nums ${totalEfectivo > 0 ? 'text-text' : 'text-emerald-600'}`}>
            {totalEfectivo > 0 ? money(totalEfectivo) : `${money(Math.abs(totalFacturas - totalNCs))} a favor`}
          </span>
        </div>
      )}

      {/* Forma de pago — solo si hay efectivo a pagar */}
      {totalEfectivo > 0 && (
        <div className="rounded-xl border border-line-2 bg-surface p-4 space-y-3">
          <p className="text-xs font-semibold text-text-soft uppercase tracking-wide">Forma de pago</p>
          <PaymentSplitEditor accounts={accounts} lines={payments} onChange={setPayments} />

          {totalEfectivo > 0 && Math.abs(totalEfectivo - totalPagos) > 1 && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              Diferencia: {money(Math.abs(totalEfectivo - totalPagos))} —{' '}
              el total de formas de pago debe coincidir con {money(totalEfectivo)}.
            </p>
          )}
        </div>
      )}

      {totalEfectivo === 0 && totalFacturas > 0 && totalNCs >= totalFacturas && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-600/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          Las notas de crédito cubren el total de las facturas seleccionadas. No es necesario registrar pago en efectivo.
        </div>
      )}

      {/* Impacta caja — solo si hay efectivo */}
      {totalEfectivo > 0 && (
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={impactaCaja}
            onChange={(e) => setImpactaCaja(e.target.checked)}
            className="w-4 h-4 cursor-pointer accent-accent"
          />
          <span className="text-sm text-text">
            Impactar en caja diaria{' '}
            <span className="text-text-mute text-xs">(registra el egreso en el turno de caja abierto)</span>
          </span>
        </label>
      )}

      {/* Notas */}
      <div>
        <label className={labelCls}>Notas / observaciones</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className={inputCls}
          placeholder="Opcional"
        />
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <div className="flex gap-3">
        <a
          href={`/panel/proveedores/${proveedorId}`}
          className="flex-1 rounded-lg border border-line-2 text-text-soft text-sm font-semibold py-2.5 text-center hover:border-accent hover:text-accent"
        >
          Cancelar
        </a>
        <button
          type="button"
          onClick={submit}
          disabled={pending || (facturas.length === 0 && notasCredito.length === 0)}
          className="flex-1 rounded-lg bg-accent text-white font-semibold text-sm py-2.5 disabled:opacity-60"
        >
          {pending
            ? 'Guardando…'
            : totalFacturas > 0
            ? `Registrar pago${totalEfectivo > 0 ? ` − ${money(totalEfectivo)} efectivo` : ' (cubierto por NC)'}`
            : 'Registrar pago'}
        </button>
      </div>
    </div>
  );
}
