'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

async function requireAdminProfile() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede operar la caja general');
  return profile;
}

// Caja diaria: admin y dispensador. Caja general: solo admin.
async function requireCajaAccess(kind: string) {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role === 'admin') return profile;
  if (profile.role === 'dispensador' && kind === 'diaria') return profile;
  throw new Error('No tenés acceso a esta caja');
}

export async function openShift(formData: FormData) {
  const kind = String(formData.get('kind') ?? 'diaria');
  const profile = await requireCajaAccess(kind);
  const supabase = await createClient();

  const { error } = await supabase.from('caja_shifts').insert({
    tenant_id: profile.tenantId,
    kind,
    opened_by: profile.userId,
    opening_cash: Number(formData.get('opening_cash') ?? 0),
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/caja');
  return {};
}

// Cuánto efectivo queda disponible ahora mismo en un turno (apertura +
// ingresos - egresos de la cuenta marcada is_cash). Se usa para no dejar
// nunca la caja diaria en negativo.
async function expectedCash(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shiftId: string,
  openingCash: number,
): Promise<number> {
  const { data: cashAccount } = await supabase.from('payment_accounts').select('id').eq('is_cash', true).maybeSingle();
  if (!cashAccount) return openingCash;

  const { data: movs } = await supabase
    .from('ledger')
    .select('type, amount_local')
    .eq('shift_id', shiftId)
    .eq('account_id', cashAccount.id);

  const net = (movs ?? []).reduce((s, m) => s + (m.type === 'ingreso' ? m.amount_local : -m.amount_local), 0);
  return openingCash + net;
}

export async function addMovement(formData: FormData) {
  const kind = String(formData.get('kind') ?? 'diaria');
  const profile = await requireCajaAccess(kind);
  const supabase = await createClient();

  const { data: shift } = await supabase
    .from('caja_shifts')
    .select('id, kind, opening_cash')
    .eq('kind', kind)
    .is('closed_at', null)
    .maybeSingle();
  if (!shift) return { error: `No hay un turno de caja ${kind} abierto` };

  const type = String(formData.get('type'));
  const category = String(formData.get('category') ?? 'Otro');
  const concept = String(formData.get('concept') ?? '');
  const payments = JSON.parse(String(formData.get('payments') ?? '[]')) as {
    account_id: string;
    amount: number;
    exchange_rate: number;
  }[];
  if (payments.length === 0) return { error: 'Cargá al menos una cuenta' };

  // Caja diaria nunca queda en efectivo negativo — se valida antes de
  // insertar nada.
  if (kind === 'diaria' && type === 'egreso') {
    const { data: cashAccount } = await supabase.from('payment_accounts').select('id').eq('is_cash', true).maybeSingle();
    const cashEgreso = payments
      .filter((p) => p.account_id === cashAccount?.id)
      .reduce((s, p) => s + p.amount * p.exchange_rate, 0);
    if (cashEgreso > 0) {
      const current = await expectedCash(supabase, shift.id, shift.opening_cash);
      if (cashEgreso > current + 0.01) {
        return { error: `El efectivo en caja (${current}) no alcanza para este egreso` };
      }
    }
  }

  // Un movimiento (este llamado a "Registrar movimiento") es un solo
  // renglón en Caja aunque se divida en varias cuentas — comparten
  // receipt_number. Otro movimiento, aunque sea idéntico, es un llamado
  // distinto y saca su propio número (next_receipt_number() es atómico:
  // dos registros al mismo tiempo no pueden terminar con el mismo).
  const { data: receiptNumber, error: receiptError } = await supabase.rpc('next_receipt_number');
  if (receiptError) return { error: receiptError.message };

  const { error } = await supabase.from('ledger').insert(
    payments.map((p) => ({
      tenant_id: profile.tenantId,
      shift_id: shift.id,
      type,
      category,
      concept,
      amount: p.amount,
      exchange_rate: p.exchange_rate,
      amount_local: p.amount * p.exchange_rate,
      account_id: p.account_id,
      receipt_number: receiptNumber,
    })),
  );
  if (error) return { error: error.message };

  revalidatePath('/panel/caja');
  revalidatePath('/panel/balance');
  return {};
}

// No se edita un movimiento que vino de una dispensa (category='Dispensa'
// o 'Cuenta corriente') — ese registro tiene que quedar en sync con
// dispensa_payments/dispensas. Solo se editan movimientos manuales.
export async function editMovement(formData: FormData) {
  const supabase = await createClient();

  const id = String(formData.get('id'));
  const { data: current } = await supabase
    .from('ledger')
    .select('category, shift:caja_shifts(kind)')
    .eq('id', id)
    .maybeSingle();
  if (!current) return { error: 'Movimiento no encontrado' };

  const shift = Array.isArray(current.shift) ? current.shift[0] : current.shift;
  const profile = await requireCajaAccess(shift?.kind ?? 'diaria');

  if (current.category === 'Dispensa' || current.category === 'Cuenta corriente') {
    return { error: 'Este movimiento viene de una dispensa — se edita/anula desde ahí, no desde Caja' };
  }
  if (current.category === 'Cierre de caja' || current.category === 'Envío a caja diaria') {
    return { error: 'Este movimiento es automático, no se edita' };
  }

  const amount = Number(formData.get('amount') ?? 0);
  const exchangeRate = Number(formData.get('exchange_rate') ?? 1);
  const accountId = String(formData.get('account_id'));

  const { error } = await supabase
    .from('ledger')
    .update({
      category: String(formData.get('category') ?? 'Otro'),
      concept: String(formData.get('concept') ?? ''),
      amount,
      exchange_rate: exchangeRate,
      amount_local: amount * exchangeRate,
      account_id: accountId,
    })
    .eq('id', id)
    .eq('tenant_id', profile.tenantId);
  if (error) return { error: error.message };

  revalidatePath('/panel/caja');
  revalidatePath('/panel/balance');
  return {};
}

// Cierra la caja diaria via RPC (arqueo + reapertura automatica con lo
// contado + volcado a caja general si hay una abierta) — ver
// close_caja_diaria en supabase/migrations. Devuelve el id del turno
// recien cerrado para poder ofrecer imprimir el arqueo.
export async function closeCajaDiaria(formData: FormData) {
  await requireCajaAccess('diaria');
  const supabase = await createClient();

  const { data: shiftId, error } = await supabase.rpc('close_caja_diaria', {
    p_counted_cash: Number(formData.get('counted_cash') ?? 0),
    p_counted_usd: Number(formData.get('counted_usd') ?? 0),
    p_leave_cash: Number(formData.get('leave_cash') ?? 0),
    p_leave_usd: Number(formData.get('leave_usd') ?? 0),
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/caja');
  return { shiftId: shiftId as string };
}

// Envío manual de caja general -> caja diaria (ver transfer_general_to_diaria).
export async function transferGeneralToDiaria(formData: FormData) {
  await requireAdminProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc('transfer_general_to_diaria', {
    p_cash_amount: Number(formData.get('cash_amount') ?? 0),
    p_usd_amount: Number(formData.get('usd_amount') ?? 0),
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/caja');
  return {};
}

// Mismo formato que la diaria (ver close_caja_general). Devuelve el id
// del turno recien cerrado para poder ofrecer imprimir el arqueo.
export async function closeCajaGeneral(formData: FormData) {
  await requireAdminProfile();
  const supabase = await createClient();

  const { data: shiftId, error } = await supabase.rpc('close_caja_general', {
    p_counted_cash: Number(formData.get('counted_cash') ?? 0),
    p_counted_usd: Number(formData.get('counted_usd') ?? 0),
    p_leave_cash: Number(formData.get('leave_cash') ?? 0),
    p_leave_usd: Number(formData.get('leave_usd') ?? 0),
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/caja');
  return { shiftId: shiftId as string };
}

// Datos de un turno cerrado para el flujo "¿desea imprimir el arqueo?"
// del lado del cliente (ShiftSummaryView los recibe como props, sin
// volver a pasar por un Server Component).
export async function getClosedShiftSummary(shiftId: string) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };

  const supabase = await createClient();
  const [{ data: shift }, { data: movements }] = await Promise.all([
    supabase.from('caja_shifts').select('*, opened_by_profile:profiles(name)').eq('id', shiftId).maybeSingle(),
    supabase
      .from('ledger')
      .select('id, type, category, concept, amount, amount_local, account_id, receipt_number, created_at, account:payment_accounts(name)')
      .eq('shift_id', shiftId)
      .order('created_at'),
  ]);
  if (!shift) return { error: 'Turno no encontrado' };

  return { shift, movements: movements ?? [] };
}
