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

  const { data: accounts } = await supabase
    .from('payment_accounts')
    .select('id, name, currency, exchange_rate, is_cash')
    .eq('is_active', true)
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
          <p className="text-xs text-text-mute mb-1">Total deuda</p>
          <p className="text-lg font-semibold text-red">{money(totalDeuda)}</p>
        </div>
        <div className="rounded-xl border border-line-2 bg-surface p-4">
          <p className="text-xs text-text-mute mb-1">Total pagado</p>
          <p className="text-lg font-semibold text-green-600">{money(totalPagado)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${saldo > 0 ? 'border-red/30 bg-red/5' : saldo < 0 ? 'border-green-600/30 bg-green-600/5' : 'border-line-2 bg-surface'}`}>
          <p className="text-xs text-text-mute mb-1">Saldo pendiente</p>
          <p className={`text-lg font-bold ${saldo > 0 ? 'text-red' : saldo < 0 ? 'text-green-600' : 'text-text-soft'}`}>
            {saldo === 0 ? 'Sin deuda' : saldo > 0 ? money(saldo) : `${money(Math.abs(saldo))} a favor`}
          </p>
        </div>
      </div>

      {/* Movimientos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text">Cuenta corriente</h2>
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
