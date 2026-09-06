import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { money, fmtDateTime } from '@/lib/format';
import { MemberPicker } from './member-picker';
import { ComprobantesTable } from './comprobantes-table';
import { CuotaSocialTab } from './cuota-social-tab';

type Debtor = { id: string; name: string; dni: string; memberNumber: number | null; adeudado: number };

function adeudadoDe(amount: number, paid: number, esCuotaSocial: boolean, acreditadoAt: string | null): number {
  if (esCuotaSocial && acreditadoAt) return 0;
  return amount - paid;
}

export default async function CtaCorrientePage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; tab?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  const isAdmin = profile.role === 'admin';

  const { member: memberId, tab } = await searchParams;
  const activeTab = tab === 'resumen' ? 'resumen' : tab === 'cuota_social' && isAdmin ? 'cuota_social' : 'buscar';
  const supabase = await createClient();

  const [{ data: accounts }, { data: allDispensas }] = await Promise.all([
    supabase.from('payment_accounts').select('*').eq('active', true).eq('is_virtual', false).order('name'),
    supabase
      .from('dispensas')
      .select('member_id, amount, es_cuota_social, acreditado_at, payments:dispensa_payments(amount_local), member:members(name, dni, member_number)')
      .is('voided_at', null),
  ]);

  const debtorMap = new Map<string, Debtor>();
  for (const d of allDispensas ?? []) {
    const member = Array.isArray(d.member) ? d.member[0] : d.member;
    const paid = (d.payments ?? []).reduce((s, p) => s + p.amount_local, 0);
    const adeudado = adeudadoDe(d.amount, paid, d.es_cuota_social, d.acreditado_at);
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
  let saldoAFavorGeneral = 0;
  let saldoCuotaSocial = 0;
  type HistorialEntry = { date: string; label: string; amount: number; voided: boolean };
  const historial: HistorialEntry[] = [];

  if (memberId && activeTab === 'buscar') {
    const [{ data: member }, { data: dispensas }, { data: creditRows }] = await Promise.all([
      supabase.from('members').select('name').eq('id', memberId).maybeSingle(),
      supabase
        .from('dispensas')
        .select(
          'id, number, created_at, amount, voided_at, note, es_cuota_social, acreditado_at, items:dispensa_items(description, quantity, unit_price, bonif1_pct, bonif2_pct, total), payments:dispensa_payments(receipt_number, created_at, amount_local, account:payment_accounts(name))',
        )
        .eq('member_id', memberId)
        .order('created_at', { ascending: true }),
      supabase.from('member_credits').select('amount, description, created_at, kind').eq('member_id', memberId),
    ]);

    selectedMemberName = member?.name ?? '—';
    saldoAFavorGeneral = (creditRows ?? []).filter((r) => r.kind === 'general').reduce((s, r) => s + r.amount, 0);
    saldoCuotaSocial = (creditRows ?? []).filter((r) => r.kind === 'cuota_social').reduce((s, r) => s + r.amount, 0);

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
        esCuotaSocial: d.es_cuota_social,
        acreditadoAt: d.acreditado_at,
        label: d.es_cuota_social ? (d.note ?? `Cuota social`) : `Dispensa N° ${d.number}`,
        adeudado: adeudadoDe(d.amount, paid, d.es_cuota_social, d.acreditado_at),
        items: d.items ?? [],
        payments,
      };
    });

    comprobantes = allComprobantes.filter((d) => !d.voided && d.adeudado > 0.01);

    for (const d of allComprobantes) {
      const suffix = d.voided ? ' (anulada)' : d.esCuotaSocial ? (d.acreditadoAt ? ' (acreditada)' : ' (pendiente)') : '';
      historial.push({ date: d.created_at, label: `${d.label}${suffix}`, amount: d.amount, voided: d.voided });
      for (const p of d.payments) {
        historial.push({ date: p.created_at, label: `Pago ${d.label} · rec${String(p.receipt_number).padStart(2, '0')} · ${p.account_name}`, amount: -p.amount_local, voided: false });
      }
    }
    for (const c of creditRows ?? []) {
      historial.push({ date: c.created_at, label: c.description, amount: -c.amount, voided: false });
    }
    historial.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  let cuotaSocialCandidates: { memberId: string; memberName: string; memberNumber: number | null; cuotaSocial: number }[] = [];
  let cuotaSocialPending: { dispensaId: string; number: number; memberName: string; amount: number; createdAt: string }[] = [];
  let periodoLabel = '';
  if (activeTab === 'cuota_social') {
    const now = new Date();
    const periodoIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    periodoLabel = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const [{ data: eligible }, { data: alreadyGenerated }, { data: pendingRows }] = await Promise.all([
      supabase.from('members').select('id, name, member_number, cuota_social').eq('factura_automatica', true).eq('status', 'valid'),
      supabase.from('dispensas').select('member_id').eq('es_cuota_social', true).eq('cuota_social_periodo', periodoIso),
      supabase
        .from('dispensas')
        .select('id, number, amount, created_at, member:members(name)')
        .eq('es_cuota_social', true)
        .is('acreditado_at', null)
        .is('voided_at', null)
        .order('created_at', { ascending: false }),
    ]);

    const generatedSet = new Set((alreadyGenerated ?? []).map((d) => d.member_id));
    cuotaSocialCandidates = (eligible ?? [])
      .filter((m) => !generatedSet.has(m.id))
      .map((m) => ({ memberId: m.id, memberName: m.name, memberNumber: m.member_number, cuotaSocial: m.cuota_social ?? 0 }));

    cuotaSocialPending = (pendingRows ?? []).map((d) => {
      const member = Array.isArray(d.member) ? d.member[0] : d.member;
      return { dispensaId: d.id, number: d.number, memberName: member?.name ?? '—', amount: d.amount, createdAt: d.created_at };
    });
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
        {isAdmin && (
          <Link
            href="/panel/ctacorriente?tab=cuota_social"
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${activeTab === 'cuota_social' ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-soft hover:text-text'}`}
          >
            Cuota social
          </Link>
        )}
      </div>

      {activeTab === 'resumen' && (
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
      )}

      {activeTab === 'cuota_social' && (
        <CuotaSocialTab candidates={cuotaSocialCandidates} pending={cuotaSocialPending} periodoLabel={periodoLabel} />
      )}

      {activeTab === 'buscar' && <MemberPicker members={searchableDebtors} value={memberId ?? ''} />}

      {activeTab === 'buscar' && memberId && (
        <div className="mt-4 space-y-4">
          {(saldoAFavorGeneral > 0.01 || saldoCuotaSocial > 0.01) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {saldoAFavorGeneral > 0.01 && (
                <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                  <p className="text-text-mute text-xs">Saldo a favor general</p>
                  <p className="text-accent font-semibold">{money(saldoAFavorGeneral)}</p>
                  <p className="text-text-mute text-xs mt-0.5">Usable para cualquier comprobante</p>
                </div>
              )}
              {saldoCuotaSocial > 0.01 && (
                <div className="rounded-xl border border-gold/30 bg-amber-bg px-4 py-3">
                  <p className="text-amber-tx text-xs">Crédito cuota social</p>
                  <p className="text-amber-tx font-semibold">{money(saldoCuotaSocial)}</p>
                  <p className="text-amber-tx text-xs mt-0.5 opacity-80">Solo se aplica al retirar producto (Registrar Dispensa)</p>
                </div>
              )}
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
