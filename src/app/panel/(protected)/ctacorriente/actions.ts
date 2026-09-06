'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
