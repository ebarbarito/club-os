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

  const { error } = await supabase.from('ledger').insert({
    tenant_id: profile.tenantId,
    shift_id: shift.id,
    type: String(formData.get('type')),
    category: String(formData.get('category') ?? 'Otro'),
    concept: String(formData.get('concept') ?? ''),
    amount: Number(formData.get('amount') ?? 0),
    method: String(formData.get('method') ?? 'efectivo'),
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/caja');
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
    .select('type, amount, method')
    .eq('shift_id', shift.id)
    .eq('method', 'efectivo');

  const ingEfectivo = (movs ?? []).filter((m) => m.type === 'ingreso').reduce((s, m) => s + m.amount, 0);
  const egEfectivo = (movs ?? []).filter((m) => m.type === 'egreso').reduce((s, m) => s + m.amount, 0);
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
