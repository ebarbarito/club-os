import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/badge';
import { ModalTrigger } from '@/components/modal-trigger';
import { ORDER_STATUS, nextOrderStatus } from '@/lib/status-meta';
import { money, fmtDateTime } from '@/lib/format';
import { RegisterDispensaForm } from './register-dispensa-form';
import { AdvanceButton } from './advance-button';
import { ConfirmDeliveryForm } from './confirm-delivery-form';
import { VoidDispensaForm } from './void-dispensa-form';

export default async function DispensaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === 'dispensas' ? 'dispensas' : 'pedidos';

  const supabase = await createClient();

  const [{ data: orders }, { data: dispensas }, { data: validMembers }, { data: stockRows }, { data: accountRows }] =
    await Promise.all([
      supabase
        .from('orders')
        .select('*, member:members(name, dni), items:order_items(grams, strain:strains(name, price_per_gram))')
        .order('created_at', { ascending: false }),
      supabase
        .from('dispensas')
        .select(
          '*, member:members(name, dni), by:profiles(name), items:dispensa_items(quantity, total, strain:strains(name, item_type)), payments:dispensa_payments(amount_local, account:payment_accounts(name))',
        )
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('members').select('id, name, dni, member_number').eq('status', 'valid').order('member_number'),
      supabase.from('stock').select('grams, strain:strains(id, code, name, item_type, price_per_gram, status)'),
      supabase.from('payment_accounts').select('*').eq('active', true).order('name'),
    ]);

  const items = (stockRows ?? [])
    .map((s) => {
      const strain = Array.isArray(s.strain) ? s.strain[0] : s.strain;
      return strain && strain.status === 'activa'
        ? { id: strain.id, code: strain.code, name: strain.name, item_type: strain.item_type, price_per_gram: strain.price_per_gram, grams: s.grams }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const accounts = accountRows ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Dispensa</h1>
          <p className="text-text-soft">Pedidos y dispensas registradas</p>
        </div>
        <ModalTrigger label="+ Registrar dispensa" title="Registrar dispensa" size="xl">
          <RegisterDispensaForm members={validMembers ?? []} items={items} accounts={accounts} />
        </ModalTrigger>
      </div>

      <div className="flex gap-1 mb-4 border-b border-line">
        <Link
          href="/panel/dispensas"
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${activeTab === 'pedidos' ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-soft hover:text-text'}`}
        >
          Pedidos
        </Link>
        <Link
          href="/panel/dispensas?tab=dispensas"
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${activeTab === 'dispensas' ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-soft hover:text-text'}`}
        >
          Dispensas registradas
        </Link>
      </div>

      {activeTab === 'pedidos' ? (
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-soft text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Socio</th>
                <th className="px-4 py-2.5 font-medium">Items</th>
                <th className="px-4 py-2.5 font-medium">Entrega</th>
                <th className="px-4 py-2.5 font-medium">Forma de pago</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o) => {
                const member = Array.isArray(o.member) ? o.member[0] : o.member;
                const meta = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];
                const next = nextOrderStatus(o.status as never, o.delivery);
                return (
                  <tr key={o.id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-text">{member?.name ?? '—'}</div>
                      <div className="text-text-mute text-xs">DNI {member?.dni}</div>
                    </td>
                    <td className="px-4 py-2.5 text-text-soft">
                      {o.items?.map((it: { grams: number; strain: { name: string } | { name: string }[] | null }, i: number) => {
                        const strain = Array.isArray(it.strain) ? it.strain[0] : it.strain;
                        return (
                          <div key={i}>
                            {strain?.name} · {it.grams} g
                          </div>
                        );
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-text-soft capitalize">{o.delivery}</td>
                    <td className="px-4 py-2.5 text-text-soft capitalize">{o.method ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge label={meta.label} color={meta.color} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {next === 'entregado' ? (
                        <ModalTrigger
                          label={`→ ${ORDER_STATUS.entregado.label}`}
                          className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                          title="Confirmar entrega"
                        >
                          <ConfirmDeliveryForm orderId={o.id} defaultMethod={o.method} />
                        </ModalTrigger>
                      ) : (
                        next && (
                          <AdvanceButton
                            orderId={o.id}
                            status={o.status}
                            delivery={o.delivery}
                            label={ORDER_STATUS[next].label}
                          />
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {(orders ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-text-mute">
                    Sin pedidos todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-soft text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Socio</th>
                <th className="px-4 py-2.5 font-medium">Artículos</th>
                <th className="px-4 py-2.5 font-medium">Sugerido</th>
                <th className="px-4 py-2.5 font-medium">Cobrado</th>
                <th className="px-4 py-2.5 font-medium">Diferencia</th>
                <th className="px-4 py-2.5 font-medium">Medios de pago</th>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Registró</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(dispensas ?? []).map((d) => {
                const member = Array.isArray(d.member) ? d.member[0] : d.member;
                const by = Array.isArray(d.by) ? d.by[0] : d.by;
                const paid = (d.payments ?? []).reduce((s: number, p: { amount_local: number }) => s + p.amount_local, 0);
                const diff = d.suggested_amount != null ? d.amount - d.suggested_amount : null;
                const voided = !!d.voided_at;
                return (
                  <tr key={d.id} className={`border-t border-line ${voided ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-text">{member?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-text-soft">
                      {(d.items ?? []).map((it: { quantity: number; strain: { name: string; item_type: string } | { name: string; item_type: string }[] | null }, i: number) => {
                        const strain = Array.isArray(it.strain) ? it.strain[0] : it.strain;
                        return (
                          <div key={i}>
                            {strain?.name} · {it.quantity} {strain?.item_type === 'genetica' ? 'g' : 'u.'}
                          </div>
                        );
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-text-soft">{d.suggested_amount != null ? money(d.suggested_amount) : '—'}</td>
                    <td className="px-4 py-2.5 text-text font-medium">{money(paid)}</td>
                    <td className={`px-4 py-2.5 ${diff == null || diff === 0 ? 'text-text-mute' : diff > 0 ? 'text-accent' : 'text-red'}`}>
                      {diff == null ? '—' : diff === 0 ? 'Exacto' : `${diff > 0 ? '+' : ''}${money(diff)}`}
                    </td>
                    <td className="px-4 py-2.5 text-text-soft">
                      {(d.payments ?? []).map((p: { amount_local: number; account: { name: string } | { name: string }[] | null }, i: number) => {
                        const account = Array.isArray(p.account) ? p.account[0] : p.account;
                        return (
                          <div key={i}>
                            {account?.name ?? '—'} · {money(p.amount_local)}
                          </div>
                        );
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-text-soft">{fmtDateTime(d.created_at)}</td>
                    <td className="px-4 py-2.5 text-text-soft">{by?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {voided ? (
                        <Badge label="Anulada" color="red" />
                      ) : (
                        <ModalTrigger
                          label="Anular"
                          className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-red hover:text-red"
                          title="Anular dispensa"
                        >
                          <VoidDispensaForm dispensaId={d.id} />
                        </ModalTrigger>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(dispensas ?? []).length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-text-mute">
                    Sin dispensas registradas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
