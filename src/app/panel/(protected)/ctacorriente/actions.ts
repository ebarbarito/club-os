'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

async function requireAdmin() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede gestionar la cuota social');
  return profile;
}

export async function payDispensaBatch(
  allocations: { dispensa_id: string; amount: number }[],
  payments: { account_id: string; amount: number; exchange_rate: number }[],
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('pay_dispensa_batch', { p_allocations: allocations, p_payments: payments });
  if (error) return { error: error.message };
  revalidatePath('/panel/ctacorriente');
  revalidatePath('/panel/dispensas');
  revalidatePath('/panel/caja');
  return {};
}

// Genera los cargos de cuota social del mes para los socios elegidos en
// el preview (edición/exclusión ya la hizo el admin del lado del
// cliente) — cada uno queda como una dispensa más, pendiente, igual que
// cualquier deuda de cta cte.
export async function confirmarCuotaSocial(entries: { memberId: string; amount: number }[]) {
  const profile = await requireAdmin();
  if (entries.length === 0) return { error: 'No hay nada para generar' };

  const supabase = await createClient();
  const periodo = new Date();
  const periodoIso = `${periodo.getFullYear()}-${String(periodo.getMonth() + 1).padStart(2, '0')}-01`;
  const nota = `Cuota social ${periodo.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`;

  const { error } = await supabase.from('dispensas').insert(
    entries.map((e) => ({
      tenant_id: profile.tenantId,
      member_id: e.memberId,
      amount: e.amount,
      suggested_amount: e.amount,
      registered_by: profile.userId,
      note: nota,
      es_cuota_social: true,
      cuota_social_periodo: periodoIso,
    })),
  );
  if (error) return { error: error.message };

  revalidatePath('/panel/ctacorriente');
  return {};
}
