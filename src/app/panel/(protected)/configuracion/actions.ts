'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { CAMPOS_DATOS, type DatosMensajes } from '@/lib/alta/mensajes';

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

// Datos del club que completan los corchetes de los mensajes para socios.
export async function guardarDatosMensajes(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  if (profile.role !== 'admin') return { error: 'Solo un administrador puede cambiar esto' };

  const datos: DatosMensajes = {};
  for (const { key } of CAMPOS_DATOS) {
    const v = String(formData.get(key) ?? '').trim();
    if (v) datos[key] = v.slice(0, 300);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('tenants').update({ datos_mensajes: datos }).eq('id', profile.tenantId);
  if (error) return { error: error.message };

  revalidatePath('/panel/configuracion');
  revalidatePath('/panel/socios', 'layout');
  return {};
}
