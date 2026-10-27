'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { CAMPOS_DATOS, type DatosMensajes } from '@/lib/alta/mensajes';
import { MAX_DOCUMENTOS, MAX_TEXTO, parseDocumentos } from '@/lib/alta/documentos';

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

// Documentos que el socio lee y acepta en la segunda parte del alta.
export async function guardarDocumentosAdhesion(json: string) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  if (profile.role !== 'admin') return { error: 'Solo un administrador puede cambiar esto' };

  let docs;
  try {
    docs = parseDocumentos(JSON.parse(json));
  } catch {
    return { error: 'Formato inválido' };
  }
  if (docs.length > MAX_DOCUMENTOS) return { error: `Máximo ${MAX_DOCUMENTOS} documentos` };
  if (docs.some((d) => d.texto.length > MAX_TEXTO)) return { error: 'Algún texto es demasiado largo' };

  const supabase = await createClient();
  const { error } = await supabase.from('tenants').update({ documentos_adhesion: docs }).eq('id', profile.tenantId);
  if (error) return { error: error.message };

  revalidatePath('/panel/configuracion');
  return {};
}
