'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createConcept(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from('ledger_concepts').insert({
    name: String(formData.get('name') ?? '').trim(),
    allows_ingreso: formData.get('allows_ingreso') === 'true',
    allows_egreso: formData.get('allows_egreso') === 'true',
  });
  if (error) return { error: error.message };
  revalidatePath('/panel/configuracion');
  revalidatePath('/panel/caja');
  return {};
}

export async function updateConcept(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ledger_concepts')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      allows_ingreso: formData.get('allows_ingreso') === 'true',
      allows_egreso: formData.get('allows_egreso') === 'true',
      active: formData.get('active') === 'true',
    })
    .eq('id', String(formData.get('id')));
  if (error) return { error: error.message };
  revalidatePath('/panel/configuracion');
  revalidatePath('/panel/caja');
  return {};
}

export async function deleteConcept(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('ledger_concepts').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/panel/configuracion');
  revalidatePath('/panel/caja');
  return {};
}
