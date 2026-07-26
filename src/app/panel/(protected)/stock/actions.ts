'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
