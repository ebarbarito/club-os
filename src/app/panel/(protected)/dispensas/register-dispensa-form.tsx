'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { money } from '@/lib/format';
import { MemberSearch, type SearchableMember } from '@/components/member-search';
import { MEMBER_STATUS } from '@/lib/status-meta';
import { ItemSearch, type ItemSearchHandle } from '@/components/item-search';
import { PaymentSplitEditor, newPaymentLine, type PaymentAccount, type PaymentLine } from '@/components/payment-split';
import { registerDispensa, updateDispensa, cobrarCuotasSociales, fetchStrainHistory } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';
const ITEM_GRID_CLS = 'sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_5rem_5rem_7rem_4rem]';

export type CatalogItem = { id: string; code: string | null; name: string; item_type: 'genetica' | 'accesorio'; price_per_gram: number; grams: number };
export type ItemRow = { strainId: string; description: string; quantity: string; unitPrice: string; bonif1: string; bonif2: string };
export type PendingCuota = { id: string; periodo: string; amount: number; paid_amount: number };
export type HistoryEntry = { date: string; memberName: string; memberNumber: number | null; quantity: number };
type HistoryState = HistoryEntry[] | 'loading' | 'error';

function formatPeriodo(periodo: string): string {
  const d = new Date(periodo + 'T12:00:00Z');
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function formatFechaCuota(periodo: string): string {
  const d = new Date(periodo + 'T12:00:00Z');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

function formatComprobante(periodo: string): string {
  const d = new Date(periodo + 'T12:00:00Z');
  const mes = d.toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' });
  return `cuota social ${mes}`;
}

function lineTotal(row: ItemRow): number {
  const qty = Number(row.quantity) || 0;
  const price = Number(row.unitPrice) || 0;
  const b1 = Number(row.bonif1) || 0;
  const b2 = Number(row.bonif2) || 0;
  return qty * price * (1 - b1 / 100) * (1 - b2 / 100);
}

export function RegisterDispensaForm({
  members,
  items,
  accounts,
  mode = 'create',
  dispensaId,
  initialMemberId,
  initialNote,
  initialRows,
  initialPayments,
  creditsByMember = {},
  virtualAccountId,
  generalCreditsByMember = {},
  generalAccountId,
  pendingCuotasByMember = {},
}: {
  members: SearchableMember[];
  items: CatalogItem[];
  accounts: PaymentAccount[];
  mode?: 'create' | 'edit';
  dispensaId?: string;
  initialMemberId?: string;
  initialNote?: string;
  initialRows?: ItemRow[];
  initialPayments?: PaymentLine[];
  creditsByMember?: Record<string, number>;
  virtualAccountId?: string | null;
  generalCreditsByMember?: Record<string, number>;
  generalAccountId?: string | null;
  pendingCuotasByMember?: Record<string, PendingCuota[]>;
}) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [memberId, setMemberId] = useState(initialMemberId ?? '');
  const [note, setNote] = useState(initialNote ?? '');
  const [rows, setRows] = useState<ItemRow[]>(initialRows ?? []);
  const [payments, setPayments] = useState<PaymentLine[]>(() => initialPayments ?? [newPaymentLine(accounts)]);
  const [useCredit, setUseCredit] = useState('');
  const [useGeneralCredit, setUseGeneralCredit] = useState('');
  const itemRefs = useRef<Array<ItemSearchHandle | null>>([]);

  // Panel cuota social paralela
  const [cuotaPending, startCuotaTransition] = useTransition();
  const [cuotaError, setCuotaError] = useState<string | null>(null);
  const [cuotaOpen, setCuotaOpen] = useState(false);
  const [cuotaCobros, setCuotaCobros] = useState<Record<string, string>>({});
  const [cuotaPayments, setCuotaPayments] = useState<PaymentLine[]>(() => [newPaymentLine(accounts)]);

  // Historial de movimientos por artículo
  const [historyOpenIdx, setHistoryOpenIdx] = useState<number | null>(null);
  const [historyCache, setHistoryCache] = useState<Record<string, HistoryState>>({});

  // Clamp a 0: el balance puede ser negativo en la DB si un comprobante de
  // cuota social fue anulado después de haberse consumido en una dispensa.
  // No se usa estado local: revalidatePath en cobrarCuotasSociales ya dispara
  // el re-render del server component con el valor actualizado de la DB.
  const availableCredit = Math.max(0, creditsByMember[memberId] ?? 0);
  const availableGeneralCredit = Math.max(0, generalCreditsByMember[memberId] ?? 0);
  const selectedMember = members.find((m) => m.id === memberId);
  const memberNotValid = !!selectedMember && selectedMember.status !== 'valid';

  // Cuotas pendientes del socio seleccionado
  const pendingCuotas = memberId ? (pendingCuotasByMember[memberId] ?? []) : [];
  const cuotaTotalCobros = pendingCuotas.reduce((s, c) => s + (Number(cuotaCobros[c.id]) || 0), 0);
  const cuotaTotalPago = cuotaPayments.reduce((s, p) => s + (Number(p.amount) || 0) * (Number(p.exchangeRate) || 1), 0);

  const suggestedTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const item = items.find((it) => it.id === r.strainId);
      const qty = Number(r.quantity) || 0;
      return sum + qty * (item?.price_per_gram ?? 0);
    }, 0);
  }, [rows, items]);

  const realTotal = rows.reduce((sum, r) => sum + lineTotal(r), 0);
  const creditUsed = Math.min(Number(useCredit) || 0, availableCredit);
  const generalCreditUsed = Math.min(Number(useGeneralCredit) || 0, availableGeneralCredit);
  const paidTotal =
    payments.reduce((sum, p) => sum + (Number(p.amount) || 0) * (Number(p.exchangeRate) || 0), 0) + creditUsed + generalCreditUsed;
  const saldo = realTotal - paidTotal;

  function updateRow(i: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function selectItem(i: number, strainId: string) {
    const item = items.find((it) => it.id === strainId);
    updateRow(i, { strainId, description: item?.name ?? '', unitPrice: item ? String(item.price_per_gram) : '' });
  }

  function addRow() {
    const newIndex = rows.length;
    setRows((prev) => [...prev, { strainId: '', description: '', quantity: '', unitPrice: '', bonif1: '0', bonif2: '0' }]);
    requestAnimationFrame(() => itemRefs.current[newIndex]?.focus());
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    if (historyOpenIdx === i) setHistoryOpenIdx(null);
  }

  function toggleHistory(i: number) {
    const strainId = rows[i]?.strainId;
    if (!strainId) return;
    if (historyOpenIdx === i) { setHistoryOpenIdx(null); return; }
    setHistoryOpenIdx(i);
    if (historyCache[strainId]) return;
    setHistoryCache((prev) => ({ ...prev, [strainId]: 'loading' }));
    fetchStrainHistory(strainId).then((result) => {
      setHistoryCache((prev) => ({ ...prev, [strainId]: result.error ? 'error' : (result.data ?? []) }));
    });
  }

  function cobrarCuotas() {
    setCuotaError(null);
    const cobros = pendingCuotas
      .map((c) => ({ charge_id: c.id, amount: Number(cuotaCobros[c.id]) || 0 }))
      .filter((c) => c.amount > 0);
    if (cobros.length === 0) {
      setCuotaError('Ingresá al menos un importe a cobrar');
      return;
    }
    const validPayments = cuotaPayments.filter((p) => Number(p.amount) > 0);
    if (validPayments.length === 0) {
      setCuotaError('Elegí una forma de pago');
      return;
    }
    const formData = new FormData();
    formData.set('member_id', memberId);
    formData.set('cobros', JSON.stringify(cobros));
    formData.set('payments', JSON.stringify(validPayments.map((p) => ({
      account_id: p.accountId,
      amount: Number(p.amount),
      exchange_rate: Number(p.exchangeRate) || 1,
    }))));
    startCuotaTransition(async () => {
      const res = await cobrarCuotasSociales(formData);
      if (res?.error) {
        setCuotaError(res.error);
        return;
      }
      // revalidatePath en el server action dispara el re-render del server
      // component automáticamente — el crédito aparece en creditsByMember
      // sin necesidad de estado local.
      setCuotaCobros({});
      setCuotaPayments([newPaymentLine(accounts)]);
      setCuotaOpen(false);
    });
  }

  function submit() {
    setError(null);
    if (!memberId) {
      setError('Elegí un socio');
      return;
    }
    if (memberNotValid && !confirm('Este socio no está validado. ¿Confirmás que querés dispensarle igual?')) {
      return;
    }
    const validRows = rows.filter((r) => r.strainId && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      setError('Cargá al menos un artículo');
      return;
    }
    // Pago en $0 es válido: el importe entero pasa a cuenta corriente.
    const validPayments = payments.filter((p) => Number(p.amount) > 0);

    if (saldo > 0.01 && !confirm(`Van a quedar ${money(saldo)} en cuenta corriente de este socio. ¿Confirmás?`)) {
      return;
    }
    if (saldo < -0.01 && !confirm(`Va a quedar ${money(-saldo)} de saldo a favor en la cuenta corriente de este socio. ¿Confirmás?`)) {
      return;
    }

    const formData = new FormData();
    if (mode === 'edit' && dispensaId) formData.set('dispensa_id', dispensaId);
    formData.set('member_id', memberId);
    formData.set('suggested_amount', String(suggestedTotal));
    formData.set('note', note);
    formData.set(
      'items',
      JSON.stringify(
        validRows.map((r) => ({
          strain_id: r.strainId,
          description: r.description,
          quantity: Number(r.quantity),
          unit_price: Number(r.unitPrice) || 0,
          bonif1_pct: Number(r.bonif1) || 0,
          bonif2_pct: Number(r.bonif2) || 0,
        })),
      ),
    );
    const payloadPayments = validPayments.map((p) => ({
      account_id: p.accountId,
      amount: Number(p.amount),
      exchange_rate: Number(p.exchangeRate) || 1,
    }));
    if (creditUsed > 0 && virtualAccountId) {
      payloadPayments.push({ account_id: virtualAccountId, amount: creditUsed, exchange_rate: 1 });
    }
    if (generalCreditUsed > 0 && generalAccountId) {
      payloadPayments.push({ account_id: generalAccountId, amount: generalCreditUsed, exchange_rate: 1 });
    }
    formData.set('payments', JSON.stringify(payloadPayments));

    startTransition(async () => {
      const res = mode === 'edit' ? await updateDispensa(formData) : await registerDispensa(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  if (members.length === 0) {
    return <p className="text-text-soft text-sm">No hay socios cargados.</p>;
  }
  if (items.length === 0) {
    return <p className="text-text-soft text-sm">No hay artículos con stock cargado. Cargá stock primero.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Socio</label>
        <MemberSearch
          members={members}
          value={memberId}
          onChange={setMemberId}
          onSelected={() => itemRefs.current[0]?.focus()}
          autoFocus
        />
        {memberNotValid && (
          <p className="mt-1.5 text-xs font-medium text-amber-tx">
            ⚠ Este socio no está validado (estado: {MEMBER_STATUS[selectedMember!.status as keyof typeof MEMBER_STATUS]?.label ?? selectedMember!.status}). Se puede dispensar igual.
          </p>
        )}
      </div>

      {/* Panel cuota social paralela */}
      {pendingCuotas.length > 0 && (
        <div className="rounded-lg border border-red/40 bg-red/5">
          <button
            type="button"
            onClick={() => { setCuotaOpen((v) => !v); setCuotaError(null); }}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          >
            <span className="text-sm font-semibold text-red">
              ⚠ Cuota social adeudada ({pendingCuotas.length} período{pendingCuotas.length > 1 ? 's' : ''})
            </span>
            <span className="text-xs text-red/70">{cuotaOpen ? '▲ cerrar' : '▼ cobrar'}</span>
          </button>

          {cuotaOpen && (
            <div className="px-3 pb-3 space-y-3 border-t border-red/20 pt-3">
              {/* Tabla de cargos */}
              <div className="rounded-lg border border-line-2 overflow-hidden">
                <div className="hidden sm:grid grid-cols-[5.5rem_1fr_7rem_7rem_6rem] gap-2 bg-surface-2 px-3 py-2 text-xs font-medium text-text-soft">
                  <span>Fecha</span>
                  <span>Comprobante</span>
                  <span className="text-right">Importe</span>
                  <span className="text-right">Adeudado</span>
                  <span className="text-right">Cobro</span>
                </div>
                <div className="divide-y divide-line-2">
                  {pendingCuotas.map((c) => {
                    const pendiente = c.amount - c.paid_amount;
                    return (
                      <div key={c.id} className="grid grid-cols-[5.5rem_1fr_7rem_7rem_6rem] gap-2 items-center px-3 py-2">
                        <span className="text-xs text-text-soft whitespace-nowrap">{formatFechaCuota(c.periodo)}</span>
                        <span className="text-sm text-text capitalize font-medium">{formatComprobante(c.periodo)}</span>
                        <span className="text-sm text-right text-text-soft">{money(c.amount)}</span>
                        <span className="text-sm text-right font-medium text-red">{money(pendiente)}</span>
                        <input
                          type="number"
                          min="0"
                          max={pendiente}
                          step="1"
                          placeholder="0"
                          value={cuotaCobros[c.id] ?? ''}
                          onChange={(e) => setCuotaCobros((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          className="w-full rounded-lg border border-line-2 px-2 py-1 text-sm text-right outline-none focus:border-accent"
                        />
                      </div>
                    );
                  })}
                </div>
                {cuotaTotalCobros > 0 && (
                  <div className="flex justify-end px-3 py-2 bg-surface-2 text-xs font-medium text-text-soft border-t border-line-2">
                    Total a cobrar: <span className="ml-1 text-text">{money(cuotaTotalCobros)}</span>
                  </div>
                )}
              </div>

              {/* Forma de pago cuota social */}
              <div>
                <label className={labelCls}>Forma de pago (cuota social)</label>
                <PaymentSplitEditor accounts={accounts} lines={cuotaPayments} onChange={setCuotaPayments} />
              </div>

              {cuotaError && <p className="text-red text-xs">{cuotaError}</p>}

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-soft">
                  {cuotaTotalPago > 0 && cuotaTotalCobros > 0
                    ? `Pago: ${money(cuotaTotalPago)} · Cobros: ${money(cuotaTotalCobros)}`
                    : null}
                </span>
                <button
                  type="button"
                  disabled={cuotaPending || cuotaTotalCobros <= 0}
                  onClick={cobrarCuotas}
                  className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
                >
                  {cuotaPending ? 'Procesando…' : 'Aceptar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className={labelCls}>Artículos</label>
        <div className="rounded-lg border border-line-2">
          <div className={`hidden sm:grid ${ITEM_GRID_CLS} gap-2 bg-surface-2 px-3 py-2 text-xs font-medium text-text-soft rounded-t-lg`}>
            <span>Artículo</span>
            <span>Cantidad</span>
            <span>Precio unit.</span>
            <span>Bonif. 1 %</span>
            <span>Bonif. 2 %</span>
            <span className="text-right">Total línea</span>
            <span />
          </div>
          <div className="divide-y divide-line-2">
            {rows.map((row, i) => (
              <div key={i}>
                <div className={`p-3 space-y-2 sm:space-y-0 sm:grid ${ITEM_GRID_CLS} sm:gap-2 sm:items-center`}>
                  <div>
                    <label className={`${labelCls} sm:hidden`}>Artículo</label>
                    <ItemSearch
                      ref={(el) => {
                        itemRefs.current[i] = el;
                      }}
                      items={items}
                      value={row.strainId}
                      onChange={(strainId) => selectItem(i, strainId)}
                    />
                  </div>
                  <div>
                    <label className={`${labelCls} sm:hidden`}>Cantidad</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0"
                      value={row.quantity}
                      onChange={(e) => updateRow(i, { quantity: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={`${labelCls} sm:hidden`}>Precio unitario</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={row.unitPrice}
                      onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={`${labelCls} sm:hidden`}>Bonificación 1 (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={row.bonif1}
                      onChange={(e) => updateRow(i, { bonif1: e.target.value })}
                      className={inputCls}
                      title="Porcentaje de descuento sobre el precio unitario"
                    />
                  </div>
                  <div>
                    <label className={`${labelCls} sm:hidden`}>Bonificación 2 (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={row.bonif2}
                      onChange={(e) => updateRow(i, { bonif2: e.target.value })}
                      className={inputCls}
                      title="Segundo descuento, se aplica sobre el resultado de la Bonificación 1"
                    />
                  </div>
                  <div className="flex items-center justify-between sm:block sm:text-right">
                    <span className={`${labelCls} sm:hidden !mb-0`}>Total línea</span>
                    <span className="text-sm font-semibold text-text">{money(lineTotal(row))}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    {row.strainId && (
                      <button
                        type="button"
                        onClick={() => toggleHistory(i)}
                        className={`text-sm shrink-0 ${historyOpenIdx === i ? 'text-accent' : 'text-text-mute hover:text-accent'}`}
                        title="Ver historial de movimientos"
                      >
                        ⏱
                      </button>
                    )}
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-red text-xs font-semibold shrink-0"
                        aria-label="Quitar línea"
                        title="Quitar línea"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                {historyOpenIdx === i && row.strainId && (() => {
                  const h = historyCache[row.strainId];
                  return (
                    <div className="px-3 pb-3 border-t border-line-2">
                      {h === 'loading' && <p className="text-xs text-text-soft pt-2">Cargando historial…</p>}
                      {h === 'error' && <p className="text-xs text-red pt-2">Error al cargar historial</p>}
                      {Array.isArray(h) && h.length === 0 && <p className="text-xs text-text-mute pt-2">Sin movimientos registrados</p>}
                      {Array.isArray(h) && h.length > 0 && (
                        <table className="w-full text-xs mt-2">
                          <thead>
                            <tr className="text-text-soft">
                              <th className="text-left py-1 pr-4 font-medium">Fecha</th>
                              <th className="text-left py-1 pr-4 font-medium">Socio</th>
                              <th className="text-right py-1 font-medium">Cantidad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {h.map((entry, j) => (
                              <tr key={j} className="border-t border-line-2">
                                <td className="py-1 pr-4 text-text-soft">
                                  {new Date(entry.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </td>
                                <td className="py-1 pr-4 text-text">
                                  {entry.memberNumber != null ? <span className="text-text-mute mr-1">#{entry.memberNumber}</span> : null}
                                  {entry.memberName}
                                </td>
                                <td className="py-1 text-right font-medium text-text">{entry.quantity} g</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
        <button type="button" onClick={addRow} className="text-accent text-xs font-semibold mt-2">
          + Agregar artículo
        </button>
      </div>

      <div className="rounded-lg bg-surface-2 p-3 text-sm flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-text-mute text-xs">Total dispensa</p>
          <p className="text-text font-bold text-base">{money(realTotal)}</p>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-text-mute text-xs">Total cobrado</p>
            <p className="text-text font-medium">{money(paidTotal)}</p>
          </div>
          <div>
            <p className="text-text-mute text-xs">{saldo < -0.01 ? 'Saldo a favor (a cta cte)' : 'Saldo (a cta cte)'}</p>
            <p className={`font-bold text-base ${saldo > 0.01 ? 'text-red' : saldo < -0.01 ? 'text-accent' : 'text-text-mute'}`}>
              {saldo < -0.01 ? `+${money(-saldo)}` : money(Math.max(saldo, 0))}
            </p>
          </div>
        </div>
      </div>

      {virtualAccountId && availableCredit > 0.01 && (
        <div className="rounded-lg border border-amber/40 bg-amber-bg px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-medium text-amber-tx">
              🪙 Crédito cuota social disponible: {money(availableCredit)}
            </label>
            <input
              type="number"
              min="0"
              max={availableCredit}
              step="1"
              placeholder="0"
              value={useCredit}
              onChange={(e) => setUseCredit(e.target.value)}
              className="w-28 rounded-lg border border-line-2 px-2 py-1 text-sm text-right outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      {generalAccountId && availableGeneralCredit > 0.01 && (
        <div className="rounded-lg border border-line-2 bg-surface-2 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-medium text-text">
              💰 Saldo a favor disponible: {money(availableGeneralCredit)}
            </label>
            <input
              type="number"
              min="0"
              max={availableGeneralCredit}
              step="1"
              placeholder="0"
              value={useGeneralCredit}
              onChange={(e) => setUseGeneralCredit(e.target.value)}
              className="w-28 rounded-lg border border-line-2 px-2 py-1 text-sm text-right outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Forma de pago</label>
        <PaymentSplitEditor accounts={accounts} lines={payments} onChange={setPayments} />
      </div>

      <div>
        <label className={labelCls}>Nota (opcional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Observaciones sobre esta dispensa…"
          className={inputCls}
        />
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? (mode === 'edit' ? 'Guardando…' : 'Registrando…') : mode === 'edit' ? 'Guardar cambios' : 'Registrar dispensa'}
      </button>
    </div>
  );
}
