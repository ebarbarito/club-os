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
export async function confirmarCuotaSocial(entries: { memberId: string; amount: number; bonificada?: boolean }[]) {
  const profile = await requireAdmin();
  if (entries.length === 0) return { error: 'No hay nada para generar' };

  const supabase = await createClient();
  const periodo = new Date();
  const periodoIso = `${periodo.getFullYear()}-${String(periodo.getMonth() + 1).padStart(2, '0')}-01`;
  const nota = `Cuota social ${periodo.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`;
  const ahora = new Date().toISOString();

  const regular = entries.filter((e) => !e.bonificada);
  const bonificadas = entries.filter((e) => e.bonificada);

  // Insertar dispensas regulares (con deuda)
  if (regular.length > 0) {
    const { error } = await supabase.from('dispensas').insert(
      regular.map((e) => ({
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
  }

  // Insertar dispensas bonificadas ($0, ya acreditadas) + crédito de producto automático
  for (const e of bonificadas) {
    const { error: errDisp } = await supabase.from('dispensas').insert({
      tenant_id: profile.tenantId,
      member_id: e.memberId,
      amount: 0,
      suggested_amount: e.amount,
      registered_by: profile.userId,
      note: `${nota} (bonificada)`,
      es_cuota_social: true,
      cuota_social_periodo: periodoIso,
      acreditado_at: ahora,
    });
    if (errDisp) return { error: errDisp.message };

    // Acreditar el importe original como crédito de producto (cuota_social)
    const { error: errCredit } = await supabase.from('member_credits').insert({
      tenant_id: profile.tenantId,
      member_id: e.memberId,
      amount: e.amount,
      kind: 'cuota_social',
      description: `${nota} — crédito bonificación`,
      created_by: profile.userId,
    });
    if (errCredit) return { error: errCredit.message };
  }

  revalidatePath('/panel/ctacorriente');
  return {};
}

// Deshace la generación de cuotas sociales de un período completo.
// Solo elimina dispensas sin pagos — si alguna ya cobró, lanza error.
export async function deshacerGeneracionCuotaSocial(periodoIso: string) {
  await requireAdmin();
  const supabase = await createClient();

  // Verificar que ninguna tiene pagos
  const { data: conPagos } = await supabase
    .from('dispensas')
    .select('id, dispensa_payments(id)')
    .eq('es_cuota_social', true)
    .eq('cuota_social_periodo', periodoIso);

  const conPagosFiltradas = (conPagos ?? []).filter(
    (d: { id: string; dispensa_payments: { id: string }[] }) => d.dispensa_payments?.length > 0,
  );
  if (conPagosFiltradas.length > 0) {
    return { error: `No se puede deshacer: ${conPagosFiltradas.length} cuota(s) ya tienen pagos registrados.` };
  }

  const { error } = await supabase
    .from('dispensas')
    .delete()
    .eq('es_cuota_social', true)
    .eq('cuota_social_periodo', periodoIso);

  if (error) return { error: error.message };
  revalidatePath('/panel/ctacorriente');
  return {};
}
