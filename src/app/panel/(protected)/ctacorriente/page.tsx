import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { money, fmtDateTime } from '@/lib/format';
import { MemberPicker } from './member-picker';
import { ComprobantesTable } from './comprobantes-table';

type Debtor = { id: string; name: string; dni: string; memberNumber: number | null; adeudado: number };

export default async function CtaCorrientePage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; tab?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');

  const { member: memberId, tab } = await searchParams;
  const activeTab = tab === 'resumen' ? 'resumen' : 'buscar';
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
  const searchableDebtors = debtors.map((d) => ({
    id: d.id,
    name: d.name,
    dni: d.dni,
    member_number: d.memberNumber ?? 0,
    adeudado: d.adeudado,
  }));
  const totalGeneral = debtors.reduce((s, d) => s + d.adeudado, 0);

  let comprobantes: {
    id: string;
    number: number;
    created_at: string;
    amount: number;
    adeudado: number;
    items: { description: string; quantity: number; unit_price: number; bonif1_pct: number; bonif2_pct: number; total: number }[];
    payments: { receipt_number: number; created_at: string; amount_local: number; account_name: string }[];
  }[] = [];
  let selectedMemberName = '—';
  let saldoAFavor = 0;
  type HistorialEntry = { date: string; label: string; amount: number; voided: boolean };
  const historial: HistorialEntry[] = [];

  if (memberId) {
    const [{ data: member }, { data: dispensas }, { data: creditRows }] = await Promise.all([
      supabase.from('members').select('name').eq('id', memberId).maybeSingle(),
      supabase
        .from('dispensas')
        .select(
          'id, number, created_at, amount, voided_at, items:dispensa_items(description, quantity, unit_price, bonif1_pct, bonif2_pct, total), payments:dispensa_payments(receipt_number, created_at, amount_local, account:payment_accounts(name))',
        )
        .eq('member_id', memberId)
        .order('created_at', { ascending: true }),
      supabase.from('member_credits').select('amount, description, created_at').eq('member_id', memberId),
    ]);

    selectedMemberName = member?.name ?? '—';
    saldoAFavor = (creditRows ?? []).reduce((s, r) => s + r.amount, 0);

    const allComprobantes = (dispensas ?? []).map((d) => {
      const payments = (d.payments ?? []).map(
        (p: { receipt_number: number; created_at: string; amount_local: number; account: { name: string } | { name: string }[] | null }) => {
          const account = Array.isArray(p.account) ? p.account[0] : p.account;
          return { receipt_number: p.receipt_number, created_at: p.created_at, amount_local: p.amount_local, account_name: account?.name ?? '—' };
        },
      );
      const paid = payments.reduce((s, p) => s + p.amount_local, 0);
      return {
        id: d.id,
        number: d.number,
        created_at: d.created_at,
        amount: d.amount,
        voided: !!d.voided_at,
        adeudado: d.amount - paid,
        items: d.items ?? [],
        payments,
      };
    });

    comprobantes = allComprobantes.filter((d) => !d.voided && d.adeudado > 0.01);

    for (const d of allComprobantes) {
      historial.push({ date: d.created_at, label: `Dispensa N° ${d.number}${d.voided ? ' (anulada)' : ''}`, amount: d.amount, voided: d.voided });
      for (const p of d.payments) {
        historial.push({ date: p.created_at, label: `Pago Dispensa N° ${d.number} · rec${String(p.receipt_number).padStart(2, '0')} · ${p.account_name}`, amount: -p.amount_local, voided: false });
      }
    }
    for (const c of creditRows ?? []) {
      historial.push({ date: c.created_at, label: c.description, amount: -c.amount, voided: false });
    }
    historial.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Cuenta Corriente</h1>
      <p className="text-text-soft mb-4">Comprobantes adeudados por socio</p>

      <div className="flex gap-1 mb-4 border-b border-line">
        <Link
          href="/panel/ctacorriente"
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${activeTab === 'buscar' ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-soft hover:text-text'}`}
        >
          Buscar socio
        </Link>
        <Link
          href="/panel/ctacorriente?tab=resumen"
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${activeTab === 'resumen' ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-soft hover:text-text'}`}
        >
          Resumen de deudores
        </Link>
      </div>

      {activeTab === 'resumen' ? (
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="bg-surface-2 text-text-soft text-xs font-medium px-4 py-2.5 flex justify-between">
            <span>Socio</span>
            <span>Adeudado</span>
          </div>
          <div className="divide-y divide-line">
            {debtors.map((d) => (
              <Link
                key={d.id}
                href={`/panel/ctacorriente?member=${d.id}`}
                className="flex justify-between items-center px-4 py-2.5 text-sm hover:bg-surface-2"
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
      ) : (
        <MemberPicker members={searchableDebtors} value={memberId ?? ''} />
      )}

      {activeTab === 'buscar' && memberId && (
        <div className="mt-4 space-y-4">
          {saldoAFavor > 0.01 && (
            <div className="rounded-xl border border-accent/30 bg-surface-2 px-4 py-3 flex justify-between items-center">
              <span className="text-text-soft text-sm">Saldo a favor del socio</span>
              <span className="text-accent font-semibold">{money(saldoAFavor)}</span>
            </div>
          )}

          <ComprobantesTable comprobantes={comprobantes} memberName={selectedMemberName} accounts={accounts ?? []} />

          {historial.length > 0 && (
            <details className="rounded-xl border border-line bg-surface">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-text">
                Historial de movimientos ({historial.length})
              </summary>
              <div className="border-t border-line divide-y divide-line">
                {historial.map((h, i) => (
                  <div key={i} className={`flex justify-between px-4 py-2 text-sm ${h.voided ? 'opacity-50' : ''}`}>
                    <span className="text-text-soft">
                      {fmtDateTime(h.date)} · {h.label}
                    </span>
                    <span className={`font-medium ${h.amount >= 0 ? 'text-text' : 'text-accent'}`}>
                      {h.amount >= 0 ? '+' : ''}
                      {money(h.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
