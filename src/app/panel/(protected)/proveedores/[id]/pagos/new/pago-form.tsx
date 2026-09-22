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
  saldo: number;
};

type Seleccion = {
  checked: boolean;
  monto: string;
};

function initSelecciones(comprobantes: ComprobantePendiente[]): Record<string, Seleccion> {
  return Object.fromEntries(
    comprobantes.map((c) => [c.id, { checked: true, monto: String(c.saldo) }]),
  );
}

export function PagoForm({
  proveedorId,
  proveedorName,
  comprobantes,
  accounts,
}: {
  proveedorId: string;
  proveedorName: string;
  comprobantes: ComprobantePendiente[];
  accounts: PaymentAccount[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');
  const [impactaCaja, setImpactaCaja] = useState(true);
  const [selecciones, setSelecciones] = useState<Record<string, Seleccion>>(() =>
    initSelecciones(comprobantes),
  );
  const [payments, setPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);

  const totalSeleccionado = useMemo(
    () =>
      Object.entries(selecciones)
        .filter(([, s]) => s.checked)
        .reduce((sum, [, s]) => sum + (Number(s.monto) || 0), 0),
    [selecciones],
  );

  const totalPagos = payments.reduce(
    (sum, l) => sum + (Number(l.amount) || 0) * (Number(l.exchangeRate) || 1),
    0,
  );

  const checkedCount = Object.values(selecciones).filter((s) => s.checked).length;
  const allChecked = checkedCount === comprobantes.length;
  const someChecked = checkedCount > 0 && !allChecked;

  function toggleAll() {
    setSelecciones((prev) => {
      const next = { ...prev };
      const shouldCheck = !allChecked;
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], checked: shouldCheck };
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelecciones((prev) => ({
      ...prev,
      [id]: { ...prev[id], checked: !prev[id].checked },
    }));
  }

  function setMonto(id: string, value: string) {
    setSelecciones((prev) => ({
      ...prev,
      [id]: { ...prev[id], monto: value },
    }));
  }

  function submit() {
    setError(null);

    const items = comprobantes
      .filter((c) => selecciones[c.id]?.checked)
      .map((c) => ({ comprobante_id: c.id, monto: Number(selecciones[c.id].monto) || 0 }))
      .filter((item) => item.monto > 0);

    if (items.length === 0) {
      setError('Seleccioná al menos un comprobante con monto mayor a cero');
      return;
    }

    const diff = Math.abs(totalSeleccionado - totalPagos);
    if (diff > 1) {
      setError(
        `El total de las formas de pago (${money(totalPagos)}) no coincide con el total imputado a comprobantes (${money(totalSeleccionado)})`,
      );
      return;
    }

    if (totalPagos <= 0) {
      setError('Ingresá los montos en las formas de pago');
      return;
    }

    startTransition(async () => {
      const res = await createPagoComprobante(proveedorId, {
        fecha,
        total: totalSeleccionado,
        notas,
        impacta_caja: impactaCaja,
        items,
        payments: payments
          .filter((p) => p.accountId && Number(p.amount) > 0)
          .map((p) => ({
            account_id: p.accountId,
            amount: (Number(p.amount) || 0) * (Number(p.exchangeRate) || 1),
            exchange_rate: Number(p.exchangeRate) || 1,
          })),
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
            Comprobantes a cancelar
          </p>
        </div>

        {comprobantes.length === 0 ? (
          <div className="p-8 text-center text-text-soft text-sm">
            No hay comprobantes con saldo pendiente.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/50 text-text-soft text-xs">
                <th className="px-4 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll}
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
              {comprobantes.map((comp) => {
                const sel = selecciones[comp.id];
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
                        onChange={() => toggleOne(comp.id)}
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
                        onChange={(e) => setMonto(comp.id, e.target.value)}
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
                <td className="px-4 py-2 text-right text-text-soft text-xs">Total a imputar</td>
                <td className="px-4 py-2 text-right tabular-nums text-accent">
                  {money(totalSeleccionado)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Forma de pago */}
      <div className="rounded-xl border border-line-2 bg-surface p-4 space-y-3">
        <p className="text-xs font-semibold text-text-soft uppercase tracking-wide">Forma de pago</p>
        <PaymentSplitEditor accounts={accounts} lines={payments} onChange={setPayments} />

        {totalSeleccionado > 0 && Math.abs(totalSeleccionado - totalPagos) > 1 && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            Diferencia: {money(Math.abs(totalSeleccionado - totalPagos))} —{' '}
            el total de formas de pago debe coincidir con el total imputado.
          </p>
        )}
      </div>

      {/* Impacta caja */}
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
          disabled={pending || comprobantes.length === 0}
          className="flex-1 rounded-lg bg-accent text-white font-semibold text-sm py-2.5 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : `Registrar pago ${totalSeleccionado > 0 ? money(totalSeleccionado) : ''}`}
        </button>
      </div>
    </div>
  );
}
