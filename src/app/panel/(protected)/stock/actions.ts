'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

export async function createStrain(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };

  const supabase = await createClient();
  const { data: strain, error } = await supabase
    .from('strains')
    .insert({
      tenant_id: profile.tenantId,
      name: String(formData.get('name') ?? ''),
      type: String(formData.get('type') ?? 'Híbrida'),
      price_per_gram: Number(formData.get('price_per_gram') ?? 0),
    })
    .select()
    .single();
  if (error) return { error: error.message };

  const { error: stockError } = await supabase.from('stock').insert({
    tenant_id: profile.tenantId,
    strain_id: strain.id,
    grams: Number(formData.get('grams') ?? 0),
    min_grams: Number(formData.get('min_grams') ?? 0),
  });
  if (stockError) return { error: stockError.message };

  revalidatePath('/panel/stock');
  return {};
}

export async function adjustStock(formData: FormData) {
  const strainId = String(formData.get('strain_id'));
  const mode = String(formData.get('mode')); // 'add' | 'remove' | 'set'
  const value = Number(formData.get('value'));

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from('stock')
    .select('grams')
    .eq('strain_id', strainId)
    .single();
  if (readError) return { error: readError.message };

  const newGrams =
    mode === 'set' ? value : mode === 'add' ? current.grams + value : Math.max(0, current.grams - value);

  const { error } = await supabase
    .from('stock')
    .update({ grams: newGrams, updated_at: new Date().toISOString() })
    .eq('strain_id', strainId);
  if (error) return { error: error.message };

  revalidatePath('/panel/stock');
  return {};
}
