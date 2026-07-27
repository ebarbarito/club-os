'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { nextOrderStatus } from '@/lib/status-meta';

export async function advanceOrderStatus(orderId: string, currentStatus: string, delivery: 'pickup' | 'shipping') {
  const next = nextOrderStatus(currentStatus as never, delivery);
  if (!next) return { error: 'No hay siguiente estado' };

  const supabase = await createClient();
  const { error } = await supabase.from('orders').update({ status: next }).eq('id', orderId);
  if (error) return { error: error.message };
  revalidatePath('/panel/dispensas');
  return {};
}

// Transición específica a 'entregado': re-confirma la forma de pago
// (puede haber cambiado entre la reserva y la entrega real).
export async function completeDelivery(orderId: string, method: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('orders').update({ status: 'entregado', method }).eq('id', orderId);
  if (error) return { error: error.message };
  revalidatePath('/panel/dispensas');
  return {};
}

export async function registerDispensa(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('register_dispensa', {
    p_member_id: String(formData.get('member_id')),
    p_strain_id: String(formData.get('strain_id')),
    p_grams: Number(formData.get('grams')),
    p_suggested_amount: Number(formData.get('suggested_amount')),
    p_payments: JSON.parse(String(formData.get('payments') ?? '[]')),
  });
  if (error) return { error: error.message };
  revalidatePath('/panel/dispensas');
  revalidatePath('/panel/stock');
  revalidatePath('/panel/caja');
  return {};
}
