import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { Badge } from '@/components/badge';
import { AccountForm } from './account-form';

export default async function CuentasPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();
  const [{ data: accounts }, { data: taxRows }] = await Promise.all([
    supabase.from('payment_accounts').select('*').order('name'),
    supabase.from('account_taxes').select('*').order('name'),
  ]);

  const taxesByAccount = new Map<string, { id: string; name: string; pct: number; applies_to: string }[]>();
  for (const t of taxRows ?? []) {
    const list = taxesByAccount.get(t.account_id) ?? [];
    list.push(t);
    taxesByAccount.set(t.account_id, list);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Cuentas</h1>
          <p className="text-text-soft">Medios de pago disponibles para Dispensa, Cuenta Corriente y Caja</p>
        </div>
        <ModalTrigger label="+ Nueva cuenta" title="Nueva cuenta">
          <AccountForm />
        </ModalTrigger>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Cuenta</th>
              <th className="px-4 py-2.5 font-medium">Moneda</th>
              <th className="px-4 py-2.5 font-medium">Cotización</th>
              <th className="px-4 py-2.5 font-medium">Efectivo</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(accounts ?? []).map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="px-4 py-2.5 font-medium text-text">{a.name}</td>
                <td className="px-4 py-2.5 text-text-soft">{a.currency}</td>
                <td className="px-4 py-2.5 text-text-soft">{a.exchange_rate}</td>
                <td className="px-4 py-2.5 text-text-soft">{a.is_cash ? 'Sí' : '—'}</td>
                <td className="px-4 py-2.5">
                  <Badge label={a.active ? 'Activa' : 'Inactiva'} color={a.active ? 'green' : 'gray'} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ModalTrigger
                    label="Editar"
                    className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                    title={`Editar — ${a.name}`}
                  >
                    <AccountForm account={a} taxes={taxesByAccount.get(a.id) ?? []} />
                  </ModalTrigger>
                </td>
              </tr>
            ))}
            {(accounts ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-mute">
                  Sin cuentas cargadas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
