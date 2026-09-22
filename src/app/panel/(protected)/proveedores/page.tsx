import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { money } from '@/lib/format';
import { ProveedorForm } from './proveedor-form';

export default async function ProveedoresPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();

  // Fetch proveedores with saldo (deuda - pago)
  const { data: proveedores } = await supabase
    .from('proveedores')
    .select('id, name, rubro, contact_name, phone, email')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  // Fetch movimientos to calculate balances
  const { data: movimientos } = await supabase
    .from('proveedor_movimientos')
    .select('proveedor_id, type, amount, exchange_rate');

  // Calculate saldo per proveedor (en pesos)
  const saldoMap: Record<string, number> = {};
  for (const mov of movimientos ?? []) {
    const prev = saldoMap[mov.proveedor_id] ?? 0;
    const amountLocal = mov.amount * (mov.exchange_rate ?? 1);
    saldoMap[mov.proveedor_id] = mov.type === 'deuda' ? prev + amountLocal : prev - amountLocal;
  }

  const rows = (proveedores ?? []).map((p) => ({
    ...p,
    saldo: saldoMap[p.id] ?? 0,
  }));

  const totalSaldo = rows.reduce((s, r) => s + r.saldo, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Proveedores</h1>
          <p className="text-text-soft">Cuenta corriente y pagos a proveedores</p>
        </div>
        <ModalTrigger label="+ Nuevo proveedor" title="Nuevo proveedor">
          <ProveedorForm />
        </ModalTrigger>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-line-2 bg-surface p-12 text-center text-text-soft text-sm">
          No hay proveedores registrados. Creá el primero con el botón de arriba.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-line-2 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-text-soft text-xs">
                  <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                  <th className="px-4 py-3 text-left font-medium">Rubro</th>
                  <th className="px-4 py-3 text-left font-medium">Contacto</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/panel/proveedores/${p.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-soft">{p.rubro ?? '—'}</td>
                    <td className="px-4 py-3 text-text-soft">
                      {p.contact_name ?? ''}
                      {p.contact_name && p.phone ? ' · ' : ''}
                      {p.phone ?? ''}
                      {!p.contact_name && !p.phone ? '—' : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.saldo > 0 ? (
                        <span className="font-semibold text-red">{money(p.saldo)}</span>
                      ) : p.saldo < 0 ? (
                        <span className="font-semibold text-green-600">{money(Math.abs(p.saldo))} a favor</span>
                      ) : (
                        <span className="text-text-mute">Sin deuda</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-surface-2 text-xs font-semibold">
                  <td className="px-4 py-2 text-text-soft" colSpan={3}>
                    {rows.length} proveedor{rows.length !== 1 ? 'es' : ''}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {totalSaldo > 0 ? (
                      <span className="text-red">Total: {money(totalSaldo)}</span>
                    ) : totalSaldo < 0 ? (
                      <span className="text-green-600">Total: {money(Math.abs(totalSaldo))} a favor</span>
                    ) : (
                      <span className="text-text-mute">Sin deuda total</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
