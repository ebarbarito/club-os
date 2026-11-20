import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/badge';
import { ModalTrigger } from '@/components/modal-trigger';
import { ORDER_STATUS, nextOrderStatus } from '@/lib/status-meta';
import { createAdminClient } from '@/lib/supabase/admin';
import { vencerReservas } from '@/lib/pedidos/disponibilidad';
import { ESTADOS_QUE_VENCEN, horasRestantes } from '@/lib/pedidos/reglas';
import { RegisterDispensaForm, type ItemRow } from './register-dispensa-form';
import { AdvanceButton } from './advance-button';
import { DispensaRow } from './dispensa-row';

type ItemPedido = {
  grams: number;
  strain_id: string | null;
  strain: { name: string; price_per_gram: number } | { name: string; price_per_gram: number }[] | null;
};

// Artículos del pedido como filas de la dispensa (precio de lista actual).
function filasDelPedido(items: ItemPedido[]): ItemRow[] {
  return items
    .filter((it) => it.strain_id && it.grams > 0)
    .map((it) => {
      const strain = Array.isArray(it.strain) ? it.strain[0] : it.strain;
      return {
        strainId: it.strain_id!,
        description: strain?.name ?? '',
        quantity: String(it.grams),
        unitPrice: String(strain?.price_per_gram ?? 0),
        bonif1: '0',
        bonif2: '0',
      };
    });
}

export default async function DispensaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === 'dispensas' ? 'dispensas' : 'pedidos';

  const supabase = await createClient();
  await vencerReservas(createAdminClient());

  const [{ data: orders }, { data: dispensas }, { data: allMembers }, { data: stockRows }, { data: accountRows }] =
    await Promise.all([
      supabase
        .from('orders')
        .select('*, member:members(name, dni), items:order_items(grams, strain_id, strain:strains(name, price_per_gram))')
        .order('created_at', { ascending: false }),
      supabase
        .from('dispensas')
        .select(
          '*, member:members(name, dni), by:profiles!dispensas_registered_by_fkey(name), items:dispensa_items(strain_id, description, quantity, unit_price, bonif1_pct, bonif2_pct, total, strain:strains(name, item_type)), payments:dispensa_payments(account_id, receipt_number, created_at, amount, exchange_rate, amount_local, account:payment_accounts(name))',
        )
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('members').select('id, name, dni, member_number, status').is('deleted_at', null).order('member_number'),
      supabase.from('stock').select('grams, strain:strains(id, code, name, item_type, price_per_gram, status)'),
      supabase.from('payment_accounts').select('*').eq('active', true).eq('is_virtual', false).order('name'),
    ]);

  const [{ data: virtualAccounts }, { data: creditRows }, { data: cuotaChargeRows }] = await Promise.all([
    supabase.from('payment_accounts').select('id, virtual_kind').eq('is_virtual', true),
    supabase.from('member_credits').select('member_id, amount, kind').in('kind', ['cuota_social', 'general']),
    supabase.from('cuota_social_charges').select('id, member_id, periodo, amount, paid_amount').is('paid_at', null).order('periodo'),
  ]);
  const cuotaSocialAccountId = (virtualAccounts ?? []).find((a) => a.virtual_kind === 'cuota_social')?.id ?? null;
  const generalAccountId = (virtualAccounts ?? []).find((a) => a.virtual_kind === 'general')?.id ?? null;
  const creditsByMember: Record<string, number> = {};
  const generalCreditsByMember: Record<string, number> = {};
  for (const c of creditRows ?? []) {
    if (c.kind === 'cuota_social') creditsByMember[c.member_id] = (creditsByMember[c.member_id] ?? 0) + c.amount;
    else generalCreditsByMember[c.member_id] = (generalCreditsByMember[c.member_id] ?? 0) + c.amount;
  }

  const pendingCuotasByMember: Record<string, { id: string; periodo: string; amount: number; paid_amount: number }[]> = {};
  for (const c of cuotaChargeRows ?? []) {
    if (!pendingCuotasByMember[c.member_id]) pendingCuotasByMember[c.member_id] = [];
    pendingCuotasByMember[c.member_id].push({ id: c.id, periodo: c.periodo, amount: c.amount, paid_amount: c.paid_amount });
  }

  const items = (stockRows ?? [])
    .map((s) => {
      const strain = Array.isArray(s.strain) ? s.strain[0] : s.strain;
      return strain && strain.status === 'activa'
        ? { id: strain.id, code: strain.code, name: strain.name, item_type: strain.item_type, price_per_gram: strain.price_per_gram, grams: s.grams }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const accounts = accountRows ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Dispensa</h1>
          <p className="text-text-soft">Pedidos y dispensas registradas</p>
        </div>
        <ModalTrigger label="+ Registrar dispensa" title="Registrar dispensa" size="xl">
          <RegisterDispensaForm
            members={allMembers ?? []}
            items={items}
            accounts={accounts}
            creditsByMember={creditsByMember}
            virtualAccountId={cuotaSocialAccountId}
            generalCreditsByMember={generalCreditsByMember}
            generalAccountId={generalAccountId}
            pendingCuotasByMember={pendingCuotasByMember}
          />
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
                      {o.canal === 'tablet' && (
                        <span className="mt-1 inline-block rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                          Pedido en la tablet
                        </span>
                      )}
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
                      {o.nota && <div className="mt-1 text-xs italic text-text-mute">“{o.nota}”</div>}
                    </td>
                    <td className="px-4 py-2.5 text-text-soft capitalize">{o.delivery}</td>
                    <td className="px-4 py-2.5 text-text-soft capitalize">{o.method ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {o.status === 'cancelado' && o.vencida_at ? (
                        <Badge label="Vencida (24 h)" color="gray" />
                      ) : (
                        <Badge label={meta.label} color={meta.color} />
                      )}
                      {ESTADOS_QUE_VENCEN.includes(o.status) && (
                        <div className={`mt-1 text-xs ${horasRestantes(o.created_at) < 3 ? 'text-red font-semibold' : 'text-text-mute'}`}>
                          {horasRestantes(o.created_at) >= 1
                            ? `Vence en ${Math.floor(horasRestantes(o.created_at))} h`
                            : 'Vence en menos de 1 h'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {next === 'entregado' ? (
                        // Al entregar se registra la dispensa: socio y artículos del pedido ya
                        // cargados, solo falta elegir cómo paga. Al guardarla, el pedido pasa a Entregado.
                        <div className="inline-block text-left">
                        <ModalTrigger
                          label="Registrar dispensa"
                          className="rounded-lg bg-accent text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90"
                          title={`Registrar dispensa · ${member?.name ?? 'Socio'}`}
                          size="xl"
                        >
                          <RegisterDispensaForm
                            members={allMembers ?? []}
                            items={items}
                            accounts={accounts}
                            creditsByMember={creditsByMember}
                            virtualAccountId={cuotaSocialAccountId}
                            generalCreditsByMember={generalCreditsByMember}
                            generalAccountId={generalAccountId}
                            pendingCuotasByMember={pendingCuotasByMember}
                            orderId={o.id}
                            initialMemberId={o.member_id}
                            initialNote={o.nota ?? ''}
                            initialRows={filasDelPedido(o.items ?? [])}
                          />
                        </ModalTrigger>
                        </div>
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
                <th className="px-4 py-2.5 font-medium">N°</th>
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
                const rowItems = ((d.items ?? []) as {
                  strain_id: string | null;
                  description: string;
                  quantity: number;
                  unit_price: number;
                  bonif1_pct: number;
                  bonif2_pct: number;
                  total: number;
                  strain: { name: string; item_type: string } | { name: string; item_type: string }[] | null;
                }[]).map((it) => {
                  const strain = Array.isArray(it.strain) ? it.strain[0] : it.strain;
                  return {
                    strainId: it.strain_id ?? undefined,
                    description: it.description,
                    quantity: it.quantity,
                    unit_price: it.unit_price,
                    bonif1_pct: it.bonif1_pct,
                    bonif2_pct: it.bonif2_pct,
                    total: it.total,
                    itemType: strain?.item_type,
                  };
                });
                const rowPayments = ((d.payments ?? []) as {
                  account_id: string | null;
                  receipt_number: number;
                  created_at: string;
                  amount: number;
                  exchange_rate: number;
                  amount_local: number;
                  account: { name: string } | { name: string }[] | null;
                }[]).map((p) => {
                  const account = Array.isArray(p.account) ? p.account[0] : p.account;
                  return {
                    accountId: p.account_id ?? undefined,
                    receipt_number: p.receipt_number,
                    created_at: p.created_at,
                    amount: p.amount,
                    exchangeRate: p.exchange_rate,
                    amount_local: p.amount_local,
                    account_name: account?.name ?? '—',
                  };
                });
                return (
                  <DispensaRow
                    key={d.id}
                    id={d.id}
                    number={d.number}
                    createdAt={d.created_at}
                    amount={d.amount}
                    suggestedAmount={d.suggested_amount}
                    note={d.note}
                    voided={!!d.voided_at}
                    memberId={d.member_id}
                    memberName={member?.name ?? '—'}
                    byName={by?.name ?? '—'}
                    items={rowItems}
                    payments={rowPayments}
                    members={allMembers ?? []}
                    catalogItems={items}
                    accounts={accounts}
                    creditsByMember={creditsByMember}
                    virtualAccountId={cuotaSocialAccountId}
                    generalCreditsByMember={generalCreditsByMember}
                    generalAccountId={generalAccountId}
                  />
                );
              })}
              {(dispensas ?? []).length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-text-mute">
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
