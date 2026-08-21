'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

export async function setPublicSiteEnabled(enabled: boolean) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  if (profile.role !== 'admin') return { error: 'Solo un administrador puede cambiar esto' };

  const supabase = await createClient();
  const { error } = await supabase.from('tenants').update({ public_site_enabled: enabled }).eq('id', profile.tenantId);
  if (error) return { error: error.message };

  revalidatePath('/panel/configuracion');
  revalidatePath('/');
  return {};
}
