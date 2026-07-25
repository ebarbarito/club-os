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

export async function registerDispensa(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('register_dispensa', {
    p_member_id: String(formData.get('member_id')),
    p_strain_id: String(formData.get('strain_id')),
    p_grams: Number(formData.get('grams')),
    p_method: String(formData.get('method')),
  });
  if (error) return { error: error.message };
  revalidatePath('/panel/dispensas');
  revalidatePath('/panel/stock');
  return {};
}
