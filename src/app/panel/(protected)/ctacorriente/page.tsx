import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ModalTrigger } from '@/components/modal-trigger';
import { money, fmtDate } from '@/lib/format';
import { MemberPicker } from './member-picker';
import { PayDispensaForm } from './pay-dispensa-form';
import { DispensaDetail } from './dispensa-detail';

export default async function CtaCorrientePage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');

  const { member: memberId } = await searchParams;
  const supabase = await createClient();

  const { data: members } = await supabase.from('members').select('id, name, dni, member_number').order('member_number');
  const { data: accounts } = await supabase.from('payment_accounts').select('*').eq('active', true).order('name');

  let comprobantes: {
    id: string;
    created_at: string;
    amount: number;
    adeudado: number;
    items: { description: string; quantity: number; unit_price: number; bonif1_pct: number; bonif2_pct: number; total: number }[];
    payments: { amount_local: number; account_name: string }[];
  }[] = [];

  if (memberId) {
    const { data: dispensas } = await supabase
      .from('dispensas')
      .select(
        'id, created_at, amount, items:dispensa_items(description, quantity, unit_price, bonif1_pct, bonif2_pct, total), payments:dispensa_payments(amount_local, account:payment_accounts(name))',
      )
      .eq('member_id', memberId)
      .is('voided_at', null)
      .order('created_at', { ascending: true });

    comprobantes = (dispensas ?? [])
      .map((d) => {
        const payments = (d.payments ?? []).map((p: { amount_local: number; account: { name: string } | { name: string }[] | null }) => {
          const account = Array.isArray(p.account) ? p.account[0] : p.account;
          return { amount_local: p.amount_local, account_name: account?.name ?? '—' };
        });
        const paid = payments.reduce((s, p) => s + p.amount_local, 0);
        return { id: d.id, created_at: d.created_at, amount: d.amount, adeudado: d.amount - paid, items: d.items ?? [], payments };
      })
      .filter((d) => d.adeudado > 0.01);
  }

  const totalAdeudado = comprobantes.reduce((s, c) => s + c.adeudado, 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Cuenta Corriente</h1>
      <p className="text-text-soft mb-4">Comprobantes adeudados por socio</p>

      <MemberPicker members={members ?? []} value={memberId ?? ''} />

      {memberId && (
        <div className="mt-4 rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-soft text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Comprobante</th>
                <th className="px-4 py-2.5 font-medium">Importe</th>
                <th className="px-4 py-2.5 font-medium">Adeudado</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {comprobantes.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-2.5 text-text-soft">{fmtDate(c.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <ModalTrigger
                      label={`#${c.id.slice(0, 8)}`}
                      className="text-accent text-sm font-medium hover:underline"
                      title="Detalle del comprobante"
                    >
                      <DispensaDetail createdAt={c.created_at} items={c.items} payments={c.payments} amount={c.amount} />
                    </ModalTrigger>
                  </td>
                  <td className="px-4 py-2.5 text-text-soft">{money(c.amount)}</td>
                  <td className="px-4 py-2.5 font-medium text-red">{money(c.adeudado)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <ModalTrigger
                      label="Cobrar"
                      className="rounded-lg bg-accent text-white text-xs font-semibold px-3 py-1.5"
                      title="Cobrar comprobante"
                    >
                      <PayDispensaForm dispensaId={c.id} adeudado={c.adeudado} accounts={accounts ?? []} />
                    </ModalTrigger>
                  </td>
                </tr>
              ))}
              {comprobantes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-text-mute">
                    Este socio no tiene comprobantes adeudados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {comprobantes.length > 0 && (
            <div className="px-4 py-3 border-t border-line flex justify-between font-semibold text-text">
              <span>Total adeudado</span>
              <span>{money(totalAdeudado)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
