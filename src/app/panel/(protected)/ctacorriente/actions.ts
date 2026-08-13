'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function payDispensa(dispensaId: string, payments: { account_id: string; amount: number; exchange_rate: number }[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('pay_dispensa', { p_dispensa_id: dispensaId, p_payments: payments });
  if (error) return { error: error.message };
  revalidatePath('/panel/ctacorriente');
  revalidatePath('/panel/dispensas');
  revalidatePath('/panel/caja');
  return {};
}
