import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ModalTrigger } from '@/components/modal-trigger';
import { money, fmtDateTime, fmtDate } from '@/lib/format';
import { ROLES } from '@/lib/roles';
import { OpenShiftForm } from './open-shift-form';
import { MovementForm } from './movement-form';
import { CloseShiftForm } from './close-shift-form';
import { EditMovementForm } from './edit-movement-form';
import { ShiftSummary } from './shift-summary';
import { TransferToDiariaForm } from './transfer-to-diaria-form';
import { groupByReceipt } from './group-by-receipt';

type Account = { id: string; name: string; is_cash: boolean; currency: string; exchange_rate: number };
type LedgerRow = {
  id: string;
  type: 'ingreso' | 'egreso';
  category: string;
  concept: string;
  amount: number;
  amount_local: number;
  exchange_rate: number;
  account_id: string;
  created_at: string;
  source_shift_id: string | null;
  receipt_number: number | null;
  account: Account | Account[] | null;
  dispensa: { member: { member_number: number; name: string } | { member_number: number; name: string }[] | null } | { member: { member_number: number; name: string } | { member_number: number; name: string }[] | null }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function netAmount(rows: LedgerRow[], accountId: string | undefined, field: 'amount' | 'amount_local'): number {
  if (!accountId) return 0;
  return rows
    .filter((m) => m.account_id === accountId)
    .reduce((s, m) => s + (m.type === 'ingreso' ? m[field] : -m[field]), 0);
}

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin' && profile.role !== 'dispensador') redirect(`/panel/${ROLES[profile.role].home}`);
  const isAdmin = profile.role === 'admin';

  const { tab } = await searchParams;
  // Un dispensador solo tiene Caja diaria, sin importar lo que diga la URL.
  const activeTab = isAdmin && tab === 'general' ? 'general' : 'diaria';

  const supabase = await createClient();
  const { data: accountRows } = await supabase.from('payment_accounts').select('*').eq('active', true).order('name');
  const accounts = accountRows ?? [];
  const cashAccount = accounts.find((a) => a.is_cash);
  // La moneda extranjera no sigue un código fijo (hay tenants con "u$s",
  // "USD", etc.) — lo que la distingue es no ser ARS ni la cuenta cash.
  const usdAccount = accounts.find((a) => !a.is_cash && a.currency !== 'ARS');
  const otherAccounts = accounts.filter((a) => !a.is_cash && a.id !== usdAccount?.id);

  const [{ data: diariaShift }, { data: generalShift }] = await Promise.all([
    supabase.from('caja_shifts').select('*').eq('kind', 'diaria').is('closed_at', null).maybeSingle(),
    isAdmin
      ? supabase.from('caja_shifts').select('*').eq('kind', 'general').is('closed_at', null).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const ledgerSelect =
    '*, account:payment_accounts(id, name, is_cash, currency), dispensa:dispensas(member:members(member_number, name))';

  const [{ data: diariaMovs }, { data: generalMovs }] = await Promise.all([
    diariaShift
      ? supabase.from('ledger').select(ledgerSelect).eq('shift_id', diariaShift.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as LedgerRow[] }),
    generalShift
      ? supabase.from('ledger').select(ledgerSelect).eq('shift_id', generalShift.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as LedgerRow[] }),
  ]);
  const diariaMovements = (diariaMovs ?? []) as unknown as LedgerRow[];
  const generalMovements = (generalMovs ?? []) as unknown as LedgerRow[];

  const diariaCash = diariaShift ? diariaShift.opening_cash + netAmount(diariaMovements, cashAccount?.id, 'amount_local') : 0;
  const generalCash = generalShift ? generalShift.opening_cash + netAmount(generalMovements, cashAccount?.id, 'amount_local') : 0;
  const diariaUsd = diariaShift ? diariaShift.opening_usd + netAmount(diariaMovements, usdAccount?.id, 'amount') : 0;
  const generalUsd = generalShift ? generalShift.opening_usd + netAmount(generalMovements, usdAccount?.id, 'amount') : 0;

  const TABS = [
    { key: 'diaria', label: 'Caja diaria' },
    { key: 'general', label: 'Caja general' },
  ] as const;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Caja</h1>
      <p className="text-text-soft mb-4">Turnos, movimientos y arqueo</p>

      {isAdmin && (
        <div className="flex gap-1 mb-4 border-b border-line">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === 'diaria' ? '/panel/caja' : '/panel/caja?tab=general'}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                activeTab === t.key ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-soft hover:text-text'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {activeTab === 'diaria' ? (
        <DiariaTab
          shift={diariaShift}
          movements={diariaMovements}
          accounts={accounts}
          cashAccount={cashAccount}
          usdAccount={usdAccount}
          expectedCash={diariaCash}
          expectedUsd={diariaUsd}
        />
      ) : (
        <GeneralTab
          shift={generalShift}
          movements={generalMovements}
          diariaMovements={diariaMovements}
          accounts={accounts}
          cashAccount={cashAccount}
          usdAccount={usdAccount}
          otherAccounts={otherAccounts}
          expectedCash={generalCash}
          diariaCash={diariaCash}
          diariaUsd={diariaUsd}
          generalUsd={generalUsd}
        />
      )}
    </div>
  );
}

function DiariaTab({
  shift,
  movements,
  accounts,
  cashAccount,
  usdAccount,
  expectedCash,
  expectedUsd,
}: {
  shift: { id: string; opening_cash: number; opening_usd: number } | null;
  movements: LedgerRow[];
  accounts: Account[];
  cashAccount: Account | undefined;
  usdAccount: Account | undefined;
  expectedCash: number;
  expectedUsd: number;
}) {
  const NO_EDIT_CATEGORIES = new Set(['Dispensa', 'Cuenta corriente', 'Cierre de caja', 'Envío a caja diaria']);
  const groups = groupByReceipt(movements);

  return (
    <div>
      {!shift ? (
        <div className="rounded-xl border border-line bg-surface p-6 text-center">
          <p className="text-text-soft mb-4">No hay un turno de caja diaria abierto.</p>
          <ModalTrigger label="Abrir caja" title="Abrir caja diaria">
            <OpenShiftForm kind="diaria" />
          </ModalTrigger>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-line bg-surface p-5 mb-4">
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p className="text-text-mute">Efectivo en caja</p>
                <p className="font-display font-bold text-text">{money(expectedCash)}</p>
              </div>
              <div>
                <p className="text-text-mute">Dólares en caja</p>
                <p className="font-display font-bold text-text">US$ {expectedUsd.toLocaleString('es-AR')}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <ModalTrigger
                label="+ Movimiento"
                className="rounded-lg border border-line-2 text-sm font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                title="Registrar movimiento"
              >
                <MovementForm accounts={accounts} kind="diaria" />
              </ModalTrigger>
              <ModalTrigger
                label="Cerrar caja (arqueo)"
                className="ml-auto rounded-lg bg-accent text-white text-sm font-semibold px-3 py-1.5"
                title="Arqueo de cierre"
              >
                <CloseShiftForm expected={expectedCash} expectedUsd={expectedUsd} kind="diaria" />
              </ModalTrigger>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-soft text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Concepto</th>
                  <th className="px-4 py-2.5 font-medium">Socio</th>
                  <th className="px-4 py-2.5 font-medium text-right">Efectivo</th>
                  <th className="px-4 py-2.5 font-medium text-right">Dólares</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cuentas</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const first = g.rows[0];
                  const dispensa = one(first.dispensa);
                  const member = dispensa ? one(dispensa.member) : null;
                  const cashVal = cashAccount ? g.byAccountLocal.get(cashAccount.id) : undefined;
                  const usdVal = usdAccount ? g.byAccountAmount.get(usdAccount.id) : undefined;
                  const cuentasVal = [...g.byAccountLocal.entries()]
                    .filter(([accId]) => accId !== cashAccount?.id && accId !== usdAccount?.id)
                    .reduce((s, [, v]) => s + v, 0);
                  const totalLocal = [...g.byAccountLocal.values()].reduce((s, v) => s + v, 0);
                  const editable = g.rows.length === 1 && !NO_EDIT_CATEGORIES.has(first.category);
                  return (
                    <tr key={g.key} className="border-t border-line">
                      <td className="px-4 py-2.5 text-text">{first.concept}</td>
                      <td className="px-4 py-2.5 text-text-soft">{member ? `#${member.member_number} ${member.name}` : '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${cashVal ? (cashVal >= 0 ? 'text-accent' : 'text-red') : 'text-text-mute'}`}>
                        {cashVal ? money(cashVal) : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium ${usdVal ? (usdVal >= 0 ? 'text-accent' : 'text-red') : 'text-text-mute'}`}>
                        {usdVal ? `US$ ${usdVal.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium ${cuentasVal ? (cuentasVal >= 0 ? 'text-accent' : 'text-red') : 'text-text-mute'}`}>
                        {cuentasVal ? money(cuentasVal) : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${totalLocal >= 0 ? 'text-accent' : 'text-red'}`}>{money(totalLocal)}</td>
                      <td className="px-4 py-2.5 text-text-soft">{fmtDateTime(first.created_at)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {editable && (
                          <ModalTrigger
                            label="Editar"
                            className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                            title="Editar movimiento"
                          >
                            <EditMovementForm movement={first} accounts={accounts} />
                          </ModalTrigger>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-text-mute">
                      Sin movimientos en este turno.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function GeneralTab({
  shift,
  movements,
  diariaMovements,
  accounts,
  cashAccount,
  usdAccount,
  otherAccounts,
  expectedCash,
  diariaCash,
  diariaUsd,
  generalUsd,
}: {
  shift: { id: string; opening_cash: number } | null;
  movements: LedgerRow[];
  diariaMovements: LedgerRow[];
  accounts: Account[];
  cashAccount: Account | undefined;
  usdAccount: Account | undefined;
  otherAccounts: Account[];
  expectedCash: number;
  diariaCash: number;
  diariaUsd: number;
  generalUsd: number;
}) {
  // Agrupa en un solo renglon: los depositos de un mismo cierre de caja
  // diaria (por source_shift_id), y cualquier otra operacion dividida en
  // varias cuentas (por receipt_number) — un movimiento manual sin split
  // ni recibo asociado queda solo, en su propio grupo.
  type GroupedRow = {
    key: string;
    concept: string;
    created_at: string;
    sourceShiftId: string | null;
    byAccount: Map<string, number>;
    byAccountRaw: Map<string, number>;
    rows: LedgerRow[];
  };
  const grouped = new Map<string, GroupedRow>();
  for (const m of movements) {
    const key = m.source_shift_id ?? (m.receipt_number != null ? `r${m.receipt_number}` : m.id);
    const signed = m.type === 'ingreso' ? m.amount_local : -m.amount_local;
    // Cantidad "cruda" en la moneda propia de la cuenta — para dolares es
    // la cantidad de dolares, no el valor convertido a pesos (amount_local).
    const signedRaw = m.type === 'ingreso' ? m.amount : -m.amount;
    const existing = grouped.get(key);
    if (existing) {
      existing.byAccount.set(m.account_id, (existing.byAccount.get(m.account_id) ?? 0) + signed);
      existing.byAccountRaw.set(m.account_id, (existing.byAccountRaw.get(m.account_id) ?? 0) + signedRaw);
      existing.rows.push(m);
    } else {
      grouped.set(key, {
        key,
        concept: m.concept,
        created_at: m.created_at,
        sourceShiftId: m.source_shift_id,
        byAccount: new Map([[m.account_id, signed]]),
        byAccountRaw: new Map([[m.account_id, signedRaw]]),
        rows: [m],
      });
    }
  }
  const rows = [...grouped.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const NO_EDIT_CATEGORIES = new Set(['Dispensa', 'Cuenta corriente', 'Cierre de caja', 'Envío a caja diaria']);

  return (
    <div>
      <div className="rounded-xl border border-line bg-surface p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
          <div>
            <p className="text-text-mute">Apertura (caja general)</p>
            <p className="font-display font-bold text-text">{shift ? money(shift.opening_cash) : '—'}</p>
          </div>
          <div>
            <p className="text-text-mute">Efectivo en caja</p>
            <p className="font-display font-bold text-text">
              {money(diariaCash)} <span className="text-text-mute font-normal text-sm">/ {money(expectedCash)}</span>
            </p>
            <p className="text-text-mute text-xs">diaria / general · total {money(diariaCash + expectedCash)}</p>
          </div>
          <div>
            <p className="text-text-mute">Dólares en caja</p>
            <p className="font-display font-bold text-text">
              US$ {diariaUsd.toLocaleString('es-AR')} <span className="text-text-mute font-normal text-sm">/ US$ {generalUsd.toLocaleString('es-AR')}</span>
            </p>
            <p className="text-text-mute text-xs">diaria / general · total US$ {(diariaUsd + generalUsd).toLocaleString('es-AR')}</p>
          </div>
        </div>
        {otherAccounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
            {otherAccounts.map((a) => {
              const d = netAmount(diariaMovements, a.id, 'amount_local');
              const g = netAmount(movements, a.id, 'amount_local');
              return (
                <div key={a.id}>
                  <p className="text-text-mute">{a.name}</p>
                  <p className="font-display font-bold text-text">
                    {money(d)} <span className="text-text-mute font-normal text-sm">/ {money(g)}</span>
                  </p>
                  <p className="text-text-mute text-xs">diaria / general · total {money(d + g)}</p>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {shift ? (
            <>
              <ModalTrigger
                label="+ Movimiento"
                className="rounded-lg border border-line-2 text-sm font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                title="Registrar movimiento"
              >
                <MovementForm accounts={accounts} kind="general" />
              </ModalTrigger>
              <ModalTrigger
                label="Enviar a caja diaria"
                className="rounded-lg border border-line-2 text-sm font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                title="Enviar a caja diaria"
              >
                <TransferToDiariaForm availableCash={expectedCash} availableUsd={generalUsd} />
              </ModalTrigger>
              <ModalTrigger
                label="Cerrar caja (arqueo)"
                className="ml-auto rounded-lg bg-accent text-white text-sm font-semibold px-3 py-1.5"
                title="Arqueo de cierre — caja general"
              >
                <CloseShiftForm expected={expectedCash} expectedUsd={generalUsd} kind="general" />
              </ModalTrigger>
            </>
          ) : (
            <ModalTrigger label="Abrir caja general" title="Abrir caja general">
              <OpenShiftForm kind="general" />
            </ModalTrigger>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Fecha</th>
              <th className="px-4 py-2.5 font-medium">Concepto</th>
              <th className="px-4 py-2.5 font-medium text-right">Efectivo</th>
              <th className="px-4 py-2.5 font-medium text-right">Dólares</th>
              {otherAccounts.map((a) => (
                <th key={a.id} className="px-4 py-2.5 font-medium text-right">
                  {a.name}
                </th>
              ))}
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cashVal = cashAccount ? r.byAccount.get(cashAccount.id) : undefined;
              const usdVal = usdAccount ? r.byAccountRaw.get(usdAccount.id) : undefined;
              return (
                <tr key={r.key} className="border-t border-line">
                  <td className="px-4 py-2.5 text-text-soft">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-2.5">
                    {r.sourceShiftId ? (
                      <ModalTrigger label={r.concept} className="text-accent font-medium hover:underline" title="Resumen del cierre">
                        <ShiftSummary shiftId={r.sourceShiftId} />
                      </ModalTrigger>
                    ) : (
                      <span className="text-text">{r.concept}</span>
                    )}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${cashVal ? (cashVal >= 0 ? 'text-accent' : 'text-red') : 'text-text-mute'}`}>
                    {cashVal ? money(cashVal) : '—'}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${usdVal ? (usdVal >= 0 ? 'text-accent' : 'text-red') : 'text-text-mute'}`}>
                    {usdVal ? `US$ ${usdVal.toLocaleString('es-AR')}` : '—'}
                  </td>
                  {otherAccounts.map((a) => {
                    const val = r.byAccount.get(a.id);
                    return (
                      <td key={a.id} className={`px-4 py-2.5 text-right font-medium ${val ? (val >= 0 ? 'text-accent' : 'text-red') : 'text-text-mute'}`}>
                        {val ? money(val) : '—'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right">
                    {!r.sourceShiftId && r.rows.length === 1 && !NO_EDIT_CATEGORIES.has(r.rows[0].category) && (
                      <ModalTrigger
                        label="Editar"
                        className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                        title="Editar movimiento"
                      >
                        <EditMovementForm movement={r.rows[0]} accounts={accounts} />
                      </ModalTrigger>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5 + otherAccounts.length} className="px-4 py-8 text-center text-text-mute">
                  Sin movimientos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ClosedGeneralShifts />
    </div>
  );
}

async function ClosedGeneralShifts() {
  const supabase = await createClient();
  const { data: history } = await supabase
    .from('caja_shifts')
    .select('*')
    .eq('kind', 'general')
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(20);

  return (
    <>
      <h2 className="font-display font-bold text-text mb-2">Historial de cierres</h2>
      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Cierre</th>
              <th className="px-4 py-2.5 font-medium">Apertura</th>
              <th className="px-4 py-2.5 font-medium">Contado</th>
              <th className="px-4 py-2.5 font-medium">Diferencia</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(history ?? []).map((h) => (
              <tr key={h.id} className="border-t border-line">
                <td className="px-4 py-2.5 text-text-soft">{fmtDateTime(h.closed_at)}</td>
                <td className="px-4 py-2.5 text-text-soft">{money(h.opening_cash)}</td>
                <td className="px-4 py-2.5 text-text-soft">{money(h.counted_cash ?? 0)}</td>
                <td className={`px-4 py-2.5 font-medium ${h.difference === 0 ? 'text-accent' : 'text-red'}`}>
                  {h.difference === 0 ? 'Exacto' : money(h.difference ?? 0)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ModalTrigger label="Ver" className="text-accent text-xs font-semibold hover:underline" title="Resumen del cierre">
                    <ShiftSummary shiftId={h.id} />
                  </ModalTrigger>
                </td>
              </tr>
            ))}
            {(history ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-mute">
                  Sin cierres anteriores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
