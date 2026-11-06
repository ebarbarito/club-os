'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { anularPorReceiptNumber } from '@/lib/anular-ledger';

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

export async function anularPagoDispensa(receiptNumber: number, dispensaId: string, motivo: string) {
  const profile = await requireAdmin();
  if (!motivo.trim()) return { error: 'Ingresá un motivo' };

  const supabase = await createClient();

  const result = await anularPorReceiptNumber(supabase, {
    tenantId: profile.tenantId,
    receiptNumber,
    motivo,
    description: `Anulación de cobro (recibo #${receiptNumber})`,
    entityType: 'dispensa_payment',
    entityId: dispensaId,
    userId: profile.userId,
  });
  if (result.error) return { error: result.error };

  // Eliminar filas de dispensa_payments (restaura saldo adeudado)
  await supabase.from('dispensa_payments').delete().eq('receipt_number', receiptNumber);

  // Eliminar créditos a favor generados por este recibo (sobrepago)
  await supabase.from('member_credits').delete().eq('receipt_number', receiptNumber);

  revalidatePath('/panel/ctacorriente');
  revalidatePath('/panel/dispensas');
  revalidatePath('/panel/caja');
  return {};
}

export async function cobrarCuotasSocialesDesdeCtaCte(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cobrar_cuotas_sociales_paralelo', {
    p_member_id: String(formData.get('member_id')),
    p_cobros: JSON.parse(String(formData.get('cobros') ?? '[]')),
    p_payments: JSON.parse(String(formData.get('payments') ?? '[]')),
  });
  if (error) return { error: error.message };
  revalidatePath('/panel/ctacorriente');
  revalidatePath('/panel/dispensas');
  revalidatePath('/panel/caja');
  return {};
}
