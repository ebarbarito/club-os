'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

async function requireAdminProfile() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede operar la caja');
  return profile;
}

export async function openShift(formData: FormData) {
  const profile = await requireAdminProfile();
  const supabase = await createClient();

  const { error } = await supabase.from('caja_shifts').insert({
    tenant_id: profile.tenantId,
    opened_by: profile.userId,
    opening_cash: Number(formData.get('opening_cash') ?? 0),
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/caja');
  return {};
}

export async function addMovement(formData: FormData) {
  const profile = await requireAdminProfile();
  const supabase = await createClient();

  const { data: shift } = await supabase
    .from('caja_shifts')
    .select('id')
    .is('closed_at', null)
    .maybeSingle();
  if (!shift) return { error: 'No hay un turno de caja abierto' };

  const type = String(formData.get('type'));
  const category = String(formData.get('category') ?? 'Otro');
  const concept = String(formData.get('concept') ?? '');
  const payments = JSON.parse(String(formData.get('payments') ?? '[]')) as {
    account_id: string;
    amount: number;
    exchange_rate: number;
  }[];
  if (payments.length === 0) return { error: 'Cargá al menos una cuenta' };

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
  const profile = await requireAdminProfile();
  const supabase = await createClient();

  const id = String(formData.get('id'));
  const { data: current } = await supabase.from('ledger').select('category').eq('id', id).maybeSingle();
  if (!current) return { error: 'Movimiento no encontrado' };
  if (current.category === 'Dispensa' || current.category === 'Cuenta corriente') {
    return { error: 'Este movimiento viene de una dispensa — se edita/anula desde ahí, no desde Caja' };
  }

  const amount = Number(formData.get('amount') ?? 0);
  const exchangeRate = Number(formData.get('exchange_rate') ?? 1);

  const { error } = await supabase
    .from('ledger')
    .update({
      category: String(formData.get('category') ?? 'Otro'),
      concept: String(formData.get('concept') ?? ''),
      amount,
      exchange_rate: exchangeRate,
      amount_local: amount * exchangeRate,
      account_id: String(formData.get('account_id')),
    })
    .eq('id', id)
    .eq('tenant_id', profile.tenantId);
  if (error) return { error: error.message };

  revalidatePath('/panel/caja');
  revalidatePath('/panel/balance');
  return {};
}

export async function closeShift(formData: FormData) {
  await requireAdminProfile();
  const supabase = await createClient();

  const { data: shift } = await supabase
    .from('caja_shifts')
    .select('id, opening_cash')
    .is('closed_at', null)
    .maybeSingle();
  if (!shift) return { error: 'No hay un turno de caja abierto' };

  const { data: movs } = await supabase
    .from('ledger')
    .select('type, amount_local, account:payment_accounts(is_cash)')
    .eq('shift_id', shift.id);

  const cashMovs = (movs ?? []).filter((m) => {
    const account = Array.isArray(m.account) ? m.account[0] : m.account;
    return account?.is_cash;
  });
  const ingEfectivo = cashMovs.filter((m) => m.type === 'ingreso').reduce((s, m) => s + m.amount_local, 0);
  const egEfectivo = cashMovs.filter((m) => m.type === 'egreso').reduce((s, m) => s + m.amount_local, 0);
  const expected = shift.opening_cash + ingEfectivo - egEfectivo;
  const counted = Number(formData.get('counted_cash') ?? 0);

  const { error } = await supabase
    .from('caja_shifts')
    .update({ closed_at: new Date().toISOString(), counted_cash: counted, difference: counted - expected })
    .eq('id', shift.id);
  if (error) return { error: error.message };

  revalidatePath('/panel/caja');
  return {};
}
