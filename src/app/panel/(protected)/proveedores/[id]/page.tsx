import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { money, fmtDate } from '@/lib/format';
import { ProveedorForm } from '../proveedor-form';
import { MovimientoForm } from '../movimiento-form';
import type { PaymentAccount } from '@/components/payment-split';
import { DeleteMovimientoButton } from './delete-movimiento-button';
import { DeleteProveedorButton } from './delete-proveedor-button';
import { DeleteComprobanteButton } from './comprobantes/delete-comprobante-button';
import { DeletePagoButton } from './pagos/delete-pago-button';

export default async function ProveedorDetailPage({
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
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!proveedor) notFound();

  const { data: movimientos } = await supabase
    .from('proveedor_movimientos')
    .select('id, type, amount, exchange_rate, description, date, account_id, created_at, payment_accounts(name)')
    .eq('proveedor_id', id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  const { data: comprobantes } = await supabase
    .from('proveedor_comprobantes')
    .select('id, tipo, fecha, punto_venta, numero, subtotal, iva, total, saldo, notas, created_at')
    .eq('proveedor_id', id)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  const { data: pagos } = await supabase
    .from('proveedor_pagos')
    .select('id, fecha, total, notas, impacta_caja, created_at, proveedor_pago_comprobantes(count)')
    .eq('proveedor_id', id)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  const saldoComprobantes = (comprobantes ?? []).reduce((s, c) => s + (c.saldo as number), 0);

  // Hay facturas pendientes → habilita el botón de pago (aunque haya NC para aplicar)
  const hasFacturasPendientes = (comprobantes ?? []).some(
    (c) => c.tipo === 'factura' && c.saldo > 0,
  );

  // Hay NC disponibles para aplicar
  const hasNCDisponibles = (comprobantes ?? []).some(
    (c) => c.tipo === 'nota_credito' && c.saldo < 0,
  );

  const { data: accounts } = await supabase
    .from('payment_accounts')
    .select('id, name, currency, exchange_rate, is_cash')
    .eq('active', true)
    .order('name');

  // Calcular saldos
  let totalDeuda = 0;
  let totalPagado = 0;
  for (const mov of movimientos ?? []) {
    const amountLocal = mov.amount * (mov.exchange_rate ?? 1);
    if (mov.type === 'deuda') totalDeuda += amountLocal;
    else totalPagado += amountLocal;
  }
  const saldo = totalDeuda - totalPagado;

  function one<T>(v: T | T[] | null): T | null {
    return Array.isArray(v) ? (v[0] ?? null) : v;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/panel/proveedores" className="text-xs text-text-mute hover:text-accent mb-1 inline-block">
            ← Proveedores
          </Link>
          <h1 className="font-display text-2xl font-bold text-text">{proveedor.name}</h1>
          {proveedor.rubro && <p className="text-text-soft text-sm">{proveedor.rubro}</p>}
        </div>
        <div className="flex gap-2">
          <ModalTrigger label="Editar" title="Editar proveedor">
            <ProveedorForm proveedor={proveedor} />
          </ModalTrigger>
          <DeleteProveedorButton id={id} name={proveedor.name} />
        </div>
      </div>

      {/* Info card */}
      {(proveedor.cuit || proveedor.contact_name || proveedor.phone || proveedor.email || proveedor.address || proveedor.notes) && (
        <div className="rounded-xl border border-line-2 bg-surface p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {proveedor.cuit && (
            <div>
              <span className="text-text-mute text-xs">CUIT</span>
              <p className="text-text">{proveedor.cuit}</p>
            </div>
          )}
          {proveedor.contact_name && (
            <div>
              <span className="text-text-mute text-xs">Contacto</span>
              <p className="text-text">{proveedor.contact_name}</p>
            </div>
          )}
          {proveedor.phone && (
            <div>
              <span className="text-text-mute text-xs">Teléfono</span>
              <p className="text-text">{proveedor.phone}</p>
            </div>
          )}
          {proveedor.email && (
            <div>
              <span className="text-text-mute text-xs">Email</span>
              <p className="text-text">{proveedor.email}</p>
            </div>
          )}
          {proveedor.address && (
            <div className="col-span-2">
              <span className="text-text-mute text-xs">Domicilio</span>
              <p className="text-text">{proveedor.address}</p>
            </div>
          )}
          {proveedor.notes && (
            <div className="col-span-2">
              <span className="text-text-mute text-xs">Notas</span>
              <p className="text-text">{proveedor.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Saldo tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line-2 bg-surface p-4">
          <p className="text-xs text-text-mute mb-1">Deuda (movimientos)</p>
          <p className="text-lg font-semibold text-red">{money(totalDeuda)}</p>
        </div>
        <div className="rounded-xl border border-line-2 bg-surface p-4">
          <p className="text-xs text-text-mute mb-1">Saldo comprobantes</p>
          <p className={`text-lg font-semibold ${saldoComprobantes > 0 ? 'text-red' : 'text-text-soft'}`}>
            {saldoComprobantes > 0 ? money(saldoComprobantes) : 'Sin deuda'}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${saldo > 0 ? 'border-red/30 bg-red/5' : saldo < 0 ? 'border-green-600/30 bg-green-600/5' : 'border-line-2 bg-surface'}`}>
          <p className="text-xs text-text-mute mb-1">Saldo mov. pendiente</p>
          <p className={`text-lg font-bold ${saldo > 0 ? 'text-red' : saldo < 0 ? 'text-green-600' : 'text-text-soft'}`}>
            {saldo === 0 ? 'Sin deuda' : saldo > 0 ? money(saldo) : `${money(Math.abs(saldo))} a favor`}
          </p>
        </div>
      </div>

      {/* Comprobantes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text">Comprobantes</h2>
          <div className="flex gap-2">
            <Link
              href={`/panel/proveedores/${id}/estado-cuenta`}
              className="rounded-lg border border-line-2 text-text-soft text-sm font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
            >
              Estado de cuenta
            </Link>
            {hasFacturasPendientes && (
              <Link
                href={`/panel/proveedores/${id}/pagos/new`}
                className="rounded-lg bg-accent text-white text-sm font-semibold px-3 py-1.5 hover:bg-accent/90"
              >
                + Registrar pago
              </Link>
            )}
            <Link
              href={`/panel/proveedores/${id}/comprobantes/new`}
              className="rounded-lg border border-line-2 text-text-soft text-sm font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
            >
              + Ingresar comprobante
            </Link>
          </div>
        </div>

        {(comprobantes ?? []).length === 0 ? (
          <div className="rounded-xl border border-line-2 bg-surface p-8 text-center text-text-soft text-sm">
            No hay comprobantes registrados.{' '}
            <Link href={`/panel/proveedores/${id}/comprobantes/new`} className="text-accent hover:underline">
              Ingresar el primero
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-line-2 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-text-soft text-xs">
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Nro.</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(comprobantes ?? []).map((comp) => {
                  const isFactura = comp.tipo === 'factura';
                  const nro = `${comp.punto_venta}-${comp.numero}`;
                  return (
                    <tr key={comp.id} className="hover:bg-surface-2/50">
                      <td className="px-4 py-3 text-text-soft tabular-nums">{fmtDate(comp.fecha)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isFactura ? 'bg-red/10 text-red' : 'bg-accent/10 text-accent'
                        }`}>
                          {isFactura ? 'Factura' : 'Nota de crédito'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text font-mono text-xs">{nro}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isFactura ? 'text-red' : 'text-accent'}`}>
                        {isFactura ? '' : '−'}{money(comp.total)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${comp.saldo > 0 ? 'text-red font-semibold' : comp.saldo < 0 ? 'text-accent font-semibold' : 'text-text-mute'}`}>
                        {comp.saldo === 0 ? 'Cancelado' : comp.saldo > 0 ? money(comp.saldo) : `${money(Math.abs(comp.saldo))} a favor`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeleteComprobanteButton id={comp.id} proveedorId={id} label={nro} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-surface-2 text-xs text-text-soft">
                  <td className="px-4 py-2" colSpan={6}>{(comprobantes ?? []).length} comprobante{(comprobantes ?? []).length !== 1 ? 's' : ''}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Pagos por comprobante */}
      {(pagos ?? []).length > 0 && (
        <div>
          <h2 className="font-semibold text-text mb-3">Pagos registrados</h2>
          <div className="rounded-xl border border-line-2 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-text-soft text-xs">
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Comprobantes</th>
                  <th className="px-4 py-3 text-left font-medium">Notas</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(pagos ?? []).map((pago) => {
                  const cnt = Array.isArray(pago.proveedor_pago_comprobantes)
                    ? (pago.proveedor_pago_comprobantes[0] as { count: number } | undefined)?.count ?? 0
                    : 0;
                  return (
                    <tr key={pago.id} className="hover:bg-surface-2/50">
                      <td className="px-4 py-3 text-text-soft tabular-nums">{fmtDate(pago.fecha)}</td>
                      <td className="px-4 py-3 text-text-soft">
                        {cnt} comprobante{cnt !== 1 ? 's' : ''}
                        {pago.impacta_caja && (
                          <span className="ml-2 text-xs text-accent bg-accent/10 rounded-full px-1.5 py-0.5">caja</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-soft text-xs">{pago.notas ?? ''}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-accent">
                        {money(pago.total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeletePagoButton id={pago.id} proveedorId={id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movimientos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text">Movimientos manuales</h2>
          <div className="flex gap-2">
            <ModalTrigger label="+ Registrar deuda" title="Registrar deuda">
              <MovimientoForm
                proveedorId={id}
                defaultType="deuda"
                accounts={(accounts ?? []) as PaymentAccount[]}
              />
            </ModalTrigger>
            <ModalTrigger label="+ Registrar pago" title="Registrar pago">
              <MovimientoForm
                proveedorId={id}
                defaultType="pago"
                accounts={(accounts ?? []) as PaymentAccount[]}
              />
            </ModalTrigger>
          </div>
        </div>

        {(movimientos ?? []).length === 0 ? (
          <div className="rounded-xl border border-line-2 bg-surface p-8 text-center text-text-soft text-sm">
            No hay movimientos registrados.
          </div>
        ) : (
          <div className="rounded-xl border border-line-2 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-text-soft text-xs">
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Descripción</th>
                  <th className="px-4 py-3 text-left font-medium">Forma de pago</th>
                  <th className="px-4 py-3 text-right font-medium">Importe</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(movimientos ?? []).map((mov) => {
                  const account = one(mov.payment_accounts as { name: string } | { name: string }[] | null);
                  const amountLocal = mov.amount * (mov.exchange_rate ?? 1);
                  const isDeuda = mov.type === 'deuda';
                  return (
                    <tr key={mov.id} className="hover:bg-surface-2/50">
                      <td className="px-4 py-3 text-text-soft tabular-nums">
                        {fmtDate(mov.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isDeuda ? 'bg-red/10 text-red' : 'bg-accent/10 text-accent'
                          }`}
                        >
                          {isDeuda ? 'Deuda' : 'Pago'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text">{mov.description}</td>
                      <td className="px-4 py-3 text-text-soft">
                        {account?.name ?? (isDeuda ? '—' : 'Sin especificar')}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isDeuda ? 'text-red' : 'text-green-600'}`}>
                        {isDeuda ? '+' : '−'}{money(amountLocal)}
                        {mov.exchange_rate !== 1 && (
                          <span className="block text-xs text-text-mute font-normal">
                            USD {mov.amount.toLocaleString('es-AR')} × {mov.exchange_rate}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeleteMovimientoButton movId={mov.id} proveedorId={id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
