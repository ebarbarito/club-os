'use server';

import { createClient } from '@/lib/supabase/server';

export async function cambiarPassword(formData: FormData) {
  const nueva = String(formData.get('nueva') ?? '');
  if (nueva.length < 6) return { error: 'Contraseña demasiado corta' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) return { error: error.message };
  return {};
}
