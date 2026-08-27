import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ModalTrigger } from '@/components/modal-trigger';
import { money, fmtDate } from '@/lib/format';
import { MemberPicker } from './member-picker';
import { PayDispensaForm } from './pay-dispensa-form';
import { DispensaDetail } from './dispensa-detail';

type Debtor = { id: string; name: string; dni: string; memberNumber: number | null; adeudado: number };

export default async function CtaCorrientePage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');

  const { member: memberId } = await searchParams;
  const supabase = await createClient();

  const [{ data: accounts }, { data: allDispensas }] = await Promise.all([
    supabase.from('payment_accounts').select('*').eq('active', true).order('name'),
    supabase
      .from('dispensas')
      .select('member_id, amount, payments:dispensa_payments(amount_local), member:members(name, dni, member_number)')
      .is('voided_at', null),
  ]);

  const debtorMap = new Map<string, Debtor>();
  for (const d of allDispensas ?? []) {
    const member = Array.isArray(d.member) ? d.member[0] : d.member;
    const paid = (d.payments ?? []).reduce((s, p) => s + p.amount_local, 0);
    const adeudado = d.amount - paid;
    if (adeudado <= 0.01) continue;
    const existing = debtorMap.get(d.member_id);
    if (existing) existing.adeudado += adeudado;
    else
      debtorMap.set(d.member_id, {
        id: d.member_id,
        name: member?.name ?? '—',
        dni: member?.dni ?? '',
        memberNumber: member?.member_number ?? null,
        adeudado,
      });
  }
  // Combo de búsqueda y resumen: mismo universo, solo socios con deuda.
  const debtors = [...debtorMap.values()].sort((a, b) => b.adeudado - a.adeudado);
  const searchableDebtors = debtors.map((d) => ({ id: d.id, name: d.name, dni: d.dni, member_number: d.memberNumber ?? 0 }));
  const totalGeneral = debtors.reduce((s, d) => s + d.adeudado, 0);
  const selectedMember = debtors.find((d) => d.id === memberId);

  let comprobantes: {
    id: string;
    number: number;
    created_at: string;
    amount: number;
    adeudado: number;
    items: { description: string; quantity: number; unit_price: number; bonif1_pct: number; bonif2_pct: number; total: number }[];
    payments: { receipt_number: number; created_at: string; amount_local: number; account_name: string }[];
  }[] = [];

  if (memberId) {
    const { data: dispensas } = await supabase
      .from('dispensas')
      .select(
        'id, number, created_at, amount, items:dispensa_items(description, quantity, unit_price, bonif1_pct, bonif2_pct, total), payments:dispensa_payments(receipt_number, created_at, amount_local, account:payment_accounts(name))',
      )
      .eq('member_id', memberId)
      .is('voided_at', null)
      .order('created_at', { ascending: true });

    comprobantes = (dispensas ?? [])
      .map((d) => {
        const payments = (d.payments ?? []).map(
          (p: { receipt_number: number; created_at: string; amount_local: number; account: { name: string } | { name: string }[] | null }) => {
            const account = Array.isArray(p.account) ? p.account[0] : p.account;
            return { receipt_number: p.receipt_number, created_at: p.created_at, amount_local: p.amount_local, account_name: account?.name ?? '—' };
          },
        );
        const paid = payments.reduce((s, p) => s + p.amount_local, 0);
        return { id: d.id, number: d.number, created_at: d.created_at, amount: d.amount, adeudado: d.amount - paid, items: d.items ?? [], payments };
      })
      .filter((d) => d.adeudado > 0.01);
  }

  const totalAdeudado = comprobantes.reduce((s, c) => s + c.adeudado, 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Cuenta Corriente</h1>
      <p className="text-text-soft mb-4">Comprobantes adeudados por socio</p>

      <MemberPicker members={searchableDebtors} value={memberId ?? ''} />

      <div className="mt-4 rounded-xl border border-line bg-surface overflow-hidden">
        <div className="bg-surface-2 text-text-soft text-xs font-medium px-4 py-2.5 flex justify-between">
          <span>Socio</span>
          <span>Adeudado</span>
        </div>
        <div className="divide-y divide-line">
          {debtors.map((d) => (
            <Link
              key={d.id}
              href={`/panel/ctacorriente?member=${d.id}`}
              className={`flex justify-between items-center px-4 py-2.5 text-sm hover:bg-surface-2 ${d.id === memberId ? 'bg-surface-2' : ''}`}
            >
              <span className="text-text font-medium">
                {d.memberNumber != null ? `N° ${d.memberNumber} — ` : ''}
                {d.name}
              </span>
              <span className="text-red font-semibold">{money(d.adeudado)}</span>
            </Link>
          ))}
          {debtors.length === 0 && <p className="px-4 py-6 text-center text-text-mute text-sm">No hay deudores.</p>}
        </div>
        {debtors.length > 0 && (
          <div className="px-4 py-3 border-t border-line flex justify-between font-semibold text-text bg-surface-2">
            <span>Total adeudado</span>
            <span>{money(totalGeneral)}</span>
          </div>
        )}
      </div>

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
                      label={`N° ${c.number}`}
                      className="text-accent text-sm font-medium hover:underline"
                      title="Detalle del comprobante"
                    >
                      <DispensaDetail
                        number={c.number}
                        memberName={selectedMember?.name ?? '—'}
                        createdAt={c.created_at}
                        items={c.items}
                        payments={c.payments}
                        amount={c.amount}
                      />
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
