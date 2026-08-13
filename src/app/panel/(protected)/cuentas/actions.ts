'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

function requireAdmin(role: string) {
  if (role !== 'admin') throw new Error('Solo un administrador puede gestionar cuentas');
}

export async function createAccount(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  requireAdmin(profile.role);

  const supabase = await createClient();
  const { error } = await supabase.from('payment_accounts').insert({
    tenant_id: profile.tenantId,
    name: String(formData.get('name') ?? ''),
    currency: String(formData.get('currency') ?? 'ARS'),
    exchange_rate: Number(formData.get('exchange_rate') ?? 1),
    is_cash: formData.get('is_cash') === 'on',
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/cuentas');
  return {};
}

export async function updateAccount(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  requireAdmin(profile.role);

  const id = String(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase
    .from('payment_accounts')
    .update({
      name: String(formData.get('name') ?? ''),
      currency: String(formData.get('currency') ?? 'ARS'),
      exchange_rate: Number(formData.get('exchange_rate') ?? 1),
      is_cash: formData.get('is_cash') === 'on',
      active: formData.get('active') === 'on',
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/panel/cuentas');
  return {};
}
