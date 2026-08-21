'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

async function requireAdminProfile() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede operar el stock general');
  return profile;
}

export async function sendStock(formData: FormData) {
  await requireAdminProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc('send_stock', {
    p_strain_id: String(formData.get('strain_id')),
    p_quantity: Number(formData.get('quantity')),
    p_type: String(formData.get('type')),
    p_note: (formData.get('note') as string) || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/stock');
  return {};
}

export async function adjustGeneralStock(formData: FormData) {
  await requireAdminProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc('adjust_stock_general', {
    p_strain_id: String(formData.get('strain_id')),
    p_mode: String(formData.get('mode')),
    p_value: Number(formData.get('value')),
    p_note: (formData.get('note') as string) || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/stock');
  return {};
}
