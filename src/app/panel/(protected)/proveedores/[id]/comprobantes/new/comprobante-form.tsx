'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { money, fmtDate } from '@/lib/format';
import { createComprobante } from '../../../actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';
const cellCls = 'rounded-lg border border-line-2 px-2 py-1.5 text-sm outline-none focus:border-accent w-full';

type Articulo = { id: string; code: string | null; description: string; unit: string | null };
type FacturaPendiente = { id: string; punto_venta: string; numero: string; fecha: string; saldo: number };
type LineItem = {
  articulo_id: string;
  descripcion: string;
  cantidad: string;
  precio: string;
  descuento: string;
};

function calcItemTotal(item: LineItem): number {
  const cant = Number(item.cantidad) || 0;
  const precio = Number(item.precio) || 0;
  const desc = Number(item.descuento) || 0;
  return cant * precio * (1 - desc / 100);
}

function newLine(): LineItem {
  return { articulo_id: '', descripcion: '', cantidad: '1', precio: '', descuento: '0' };
}

export function ComprobanteForm({
  proveedorId,
  proveedorName,
  articulos,
  facturasPendientes = [],
}: {
  proveedorId: string;
  proveedorName: string;
  articulos: Articulo[];
  facturasPendientes?: FacturaPendiente[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [tipo, setTipo] = useState<'factura' | 'nota_credito'>('factura');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [puntoVenta, setPuntoVenta] = useState('0001');
  const [numero, setNumero] = useState('');
  const [items, setItems] = useState<LineItem[]>([newLine()]);
  const [iva, setIva] = useState('');
  const [ivaAdicional, setIvaAdicional] = useState('');
  const [otrosImpuestos, setOtrosImpuestos] = useState('');
  const [notas, setNotas] = useState('');
  const [applyToFacturaId, setApplyToFacturaId] = useState<string | null>(null);

  const subtotal = items.reduce((s, item) => s + calcItemTotal(item), 0);
  const ivaNum = Number(iva) || 0;
  const ivaAdNum = Number(ivaAdicional) || 0;
  const otrosNum = Number(otrosImpuestos) || 0;
  const total = subtotal + ivaNum + ivaAdNum + otrosNum;

  function setItemField(i: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  }

  function selectArticulo(i: number, articuloId: string) {
    const art = articulos.find((a) => a.id === articuloId);
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === i
          ? { ...item, articulo_id: articuloId, descripcion: art ? art.description : item.descripcion }
          : item,
      ),
    );
  }

  function addLine() {
    setItems((prev) => [...prev, newLine()]);
  }

  function removeLine(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit() {
    setError(null);

    if (!numero.trim()) { setError('Ingresá el número de comprobante'); return; }

    const validItems = items.filter((item) => item.descripcion.trim() && (Number(item.cantidad) || 0) > 0);
    if (validItems.length === 0) { setError('Ingresá al menos un renglón con descripción y cantidad'); return; }
    if (total <= 0) { setError('El total del comprobante debe ser mayor a cero'); return; }

    startTransition(async () => {
      const res = await createComprobante(proveedorId, {
        tipo,
        fecha,
        punto_venta: puntoVenta.padStart(4, '0'),
        numero: numero.trim().padStart(8, '0'),
        subtotal,
        iva: ivaNum,
        iva_adicional: ivaAdNum,
        otros_impuestos: otrosNum,
        total,
        notas,
        apply_to_factura_id: tipo === 'nota_credito' ? applyToFacturaId : null,
        items: validItems.map((item, idx) => ({
          articulo_id: item.articulo_id || null,
          descripcion: item.descripcion.trim(),
          cantidad: Number(item.cantidad) || 1,
          precio_unitario: Number(item.precio) || 0,
          descuento: Number(item.descuento) || 0,
          total: calcItemTotal(item),
          orden: idx,
        })),
      });

      if (res?.error) { setError(res.error); return; }
      router.replace(`/panel/proveedores/${proveedorId}`);
      router.refresh();
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-text-mute mb-1">← <a href={`/panel/proveedores/${proveedorId}`} className="hover:text-accent">Volver a {proveedorName}</a></p>
        <h1 className="font-display text-2xl font-bold text-text">Ingresar comprobante</h1>
        <p className="text-text-soft text-sm">{proveedorName}</p>
      </div>

      {/* Tipo */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setTipo('factura'); setApplyToFacturaId(null); }}
          className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold ${
            tipo === 'factura' ? 'border-red bg-red/5 text-red' : 'border-line-2 text-text-soft hover:border-red/40'
          }`}
        >
          Factura
        </button>
        <button
          type="button"
          onClick={() => setTipo('nota_credito')}
          className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold ${
            tipo === 'nota_credito' ? 'border-accent bg-accent/10 text-accent' : 'border-line-2 text-text-soft hover:border-accent/40'
          }`}
        >
          Nota de crédito
        </button>
      </div>

      {/* Aplicar NC a factura pendiente */}
      {tipo === 'nota_credito' && (
        <div className="rounded-xl border border-line-2 bg-surface p-4 space-y-3">
          <p className="text-xs font-semibold text-text-soft uppercase tracking-wide">
            Aplicar a factura pendiente
          </p>
          {facturasPendientes.length === 0 ? (
            <p className="text-sm text-text-soft">
              No hay facturas pendientes. La nota de crédito quedará disponible como crédito para futuros pagos.
            </p>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-transparent px-2 py-1.5 hover:bg-surface-2">
                <input
                  type="radio"
                  name="apply_nc"
                  checked={applyToFacturaId === null}
                  onChange={() => setApplyToFacturaId(null)}
                  className="accent-accent"
                />
                <span className="text-sm text-text-soft">No aplicar — queda como crédito disponible</span>
              </label>
              {facturasPendientes.map((f) => {
                const nro = `${f.punto_venta}-${f.numero}`;
                return (
                  <label key={f.id} className={`flex items-center gap-3 cursor-pointer rounded-lg border px-2 py-1.5 hover:bg-surface-2 ${applyToFacturaId === f.id ? 'border-accent bg-accent/5' : 'border-transparent'}`}>
                    <input
                      type="radio"
                      name="apply_nc"
                      checked={applyToFacturaId === f.id}
                      onChange={() => setApplyToFacturaId(f.id)}
                      className="accent-accent"
                    />
                    <span className="font-mono text-xs text-text">{nro}</span>
                    <span className="text-text-soft text-xs">{fmtDate(f.fecha)}</span>
                    <span className="ml-auto text-red font-semibold tabular-nums text-sm">{money(f.saldo)}</span>
                  </label>
                );
              })}
              {applyToFacturaId && total > 0 && (() => {
                const fac = facturasPendientes.find((f) => f.id === applyToFacturaId);
                if (!fac) return null;
                const applied = Math.min(total, fac.saldo);
                const remainNC = total - applied;
                const remainFac = fac.saldo - applied;
                return (
                  <div className="mt-2 rounded-lg bg-accent/5 border border-accent/20 px-3 py-2 text-xs space-y-1 text-text-soft">
                    <p>Se aplicarán <span className="font-semibold text-accent">{money(applied)}</span> de la NC a esa factura.</p>
                    {remainFac > 0 && <p>Saldo restante de la factura: <span className="font-semibold text-red">{money(remainFac)}</span></p>}
                    {remainNC > 0 && <p>Crédito remanente de la NC: <span className="font-semibold text-accent">{money(remainNC)}</span></p>}
                    {remainFac === 0 && remainNC === 0 && <p className="text-emerald-600 font-semibold">La factura queda saldada y la NC completamente aplicada.</p>}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Datos del comprobante */}
      <div className="rounded-xl border border-line-2 bg-surface p-4 grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Fecha *</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Punto de venta *</label>
          <input
            type="text"
            maxLength={4}
            value={puntoVenta}
            onChange={(e) => setPuntoVenta(e.target.value.replace(/\D/g, ''))}
            className={inputCls}
            placeholder="0001"
          />
        </div>
        <div>
          <label className={labelCls}>Número *</label>
          <input
            type="text"
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
            className={inputCls}
            placeholder="00001234"
          />
        </div>
      </div>

      {/* Renglones */}
      <div className="rounded-xl border border-line-2 overflow-hidden">
        <div className="bg-surface-2 px-4 py-2 border-b border-line">
          <p className="text-xs font-semibold text-text-soft uppercase tracking-wide">Detalle del comprobante</p>
        </div>
        <div className="p-4 space-y-2">
          {/* Encabezados de columna */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 text-xs text-text-mute font-medium pb-1">
            <span>Descripción</span>
            <span>Cantidad</span>
            <span>Precio unit.</span>
            <span>Desc. %</span>
            <span>Total</span>
            <span className="w-6" />
          </div>

          {items.map((item, i) => {
            const itemTotal = calcItemTotal(item);
            return (
              <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                {/* Descripción: select artículo o texto libre */}
                <div className="flex gap-1">
                  {articulos.length > 0 && (
                    <select
                      value={item.articulo_id}
                      onChange={(e) => selectArticulo(i, e.target.value)}
                      className="rounded-lg border border-line-2 px-2 py-1.5 text-sm outline-none focus:border-accent w-28 shrink-0 text-text-soft"
                      title="Buscar artículo"
                    >
                      <option value="">— libre —</option>
                      {articulos.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} ` : ''}{a.description}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={item.descripcion}
                    onChange={(e) => setItemField(i, 'descripcion', e.target.value)}
                    className={cellCls}
                    placeholder="Descripción"
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={item.cantidad}
                  onChange={(e) => setItemField(i, 'cantidad', e.target.value)}
                  className={cellCls}
                  placeholder="1"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.precio}
                  onChange={(e) => setItemField(i, 'precio', e.target.value)}
                  className={cellCls}
                  placeholder="0"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.descuento}
                  onChange={(e) => setItemField(i, 'descuento', e.target.value)}
                  className={cellCls}
                  placeholder="0"
                />
                <span className="text-sm font-semibold text-right tabular-nums text-text">
                  {money(itemTotal)}
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={items.length === 1}
                  className="text-text-mute hover:text-red disabled:opacity-20 text-lg leading-none w-6 text-center"
                >
                  ×
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addLine}
            className="text-accent text-sm font-semibold hover:underline mt-1"
          >
            + Agregar renglón
          </button>
        </div>
      </div>

      {/* Impuestos y totales */}
      <div className="rounded-xl border border-line-2 bg-surface p-4">
        <div className="grid grid-cols-2 gap-6">
          {/* Impuestos manuales */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-text-soft uppercase tracking-wide">Impuestos</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>IVA</label>
                <input type="number" min="0" step="0.01" value={iva} onChange={(e) => setIva(e.target.value)} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>IVA adicional</label>
                <input type="number" min="0" step="0.01" value={ivaAdicional} onChange={(e) => setIvaAdicional(e.target.value)} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Otros impuestos</label>
                <input type="number" min="0" step="0.01" value={otrosImpuestos} onChange={(e) => setOtrosImpuestos(e.target.value)} className={inputCls} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Totales */}
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold text-text-soft uppercase tracking-wide mb-3">Resumen</p>
            <div className="flex justify-between">
              <span className="text-text-soft">Subtotal</span>
              <span className="tabular-nums font-medium">{money(subtotal)}</span>
            </div>
            {ivaNum > 0 && (
              <div className="flex justify-between">
                <span className="text-text-soft">IVA</span>
                <span className="tabular-nums">{money(ivaNum)}</span>
              </div>
            )}
            {ivaAdNum > 0 && (
              <div className="flex justify-between">
                <span className="text-text-soft">IVA adicional</span>
                <span className="tabular-nums">{money(ivaAdNum)}</span>
              </div>
            )}
            {otrosNum > 0 && (
              <div className="flex justify-between">
                <span className="text-text-soft">Otros impuestos</span>
                <span className="tabular-nums">{money(otrosNum)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 font-bold text-base">
              <span>Total</span>
              <span className={`tabular-nums ${tipo === 'factura' ? 'text-red' : 'text-accent'}`}>{money(total)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="mt-4">
          <label className={labelCls}>Notas / observaciones</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className={inputCls}
            placeholder="Opcional"
          />
        </div>
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
          disabled={pending}
          className="flex-1 rounded-lg bg-accent text-white font-semibold text-sm py-2.5 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : tipo === 'factura' ? 'Registrar factura' : 'Registrar nota de crédito'}
        </button>
      </div>
    </div>
  );
}
