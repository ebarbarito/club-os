'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

function requireAdmin(role: string) {
  if (role !== 'admin') throw new Error('Solo un administrador puede gestionar el catálogo');
}

// Crear una genética también provisiona su fila de stock (grams=0) —
// así aparece de una en Stock sin pasos manuales extra.
export async function createStrain(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  requireAdmin(profile.role);

  const itemType = String(formData.get('item_type') ?? 'genetica');
  const isGenetica = itemType === 'genetica';

  const supabase = await createClient();
  const { data: strain, error } = await supabase
    .from('strains')
    .insert({
      tenant_id: profile.tenantId,
      item_type: itemType,
      code: (formData.get('code') as string) || null,
      name: String(formData.get('name') ?? ''),
      type: isGenetica ? String(formData.get('type') ?? 'Híbrida') : null,
      thc: isGenetica && formData.get('thc') ? Number(formData.get('thc')) : null,
      cbd: isGenetica && formData.get('cbd') ? Number(formData.get('cbd')) : null,
      price_per_gram: Number(formData.get('price_per_gram') ?? 0),
      cross_info: isGenetica ? (formData.get('cross_info') as string) || null : null,
      composition: isGenetica ? (formData.get('composition') as string) || null : null,
      aroma: isGenetica ? (formData.get('aroma') as string) || null : null,
      effects: isGenetica ? (formData.get('effects') as string) || null : null,
      notes: isGenetica ? (formData.get('notes') as string) || null : null,
      description: (formData.get('description') as string) || null,
    })
    .select()
    .single();
  if (error) return { error: error.message };

  const { error: stockError } = await supabase.from('stock').insert({
    tenant_id: profile.tenantId,
    strain_id: strain.id,
    grams: 0,
    min_grams: 0,
  });
  if (stockError) return { error: stockError.message };

  revalidatePath('/panel/catalogo');
  revalidatePath('/panel/stock');
  return {};
}

export async function updateStrain(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  requireAdmin(profile.role);

  const id = String(formData.get('id'));
  const itemType = String(formData.get('item_type') ?? 'genetica');
  const isGenetica = itemType === 'genetica';

  const supabase = await createClient();
  const { error } = await supabase
    .from('strains')
    .update({
      item_type: itemType,
      code: (formData.get('code') as string) || null,
      name: String(formData.get('name') ?? ''),
      type: isGenetica ? String(formData.get('type') ?? 'Híbrida') : null,
      thc: isGenetica && formData.get('thc') ? Number(formData.get('thc')) : null,
      cbd: isGenetica && formData.get('cbd') ? Number(formData.get('cbd')) : null,
      price_per_gram: Number(formData.get('price_per_gram') ?? 0),
      status: String(formData.get('status') ?? 'activa'),
      cross_info: isGenetica ? (formData.get('cross_info') as string) || null : null,
      composition: isGenetica ? (formData.get('composition') as string) || null : null,
      aroma: isGenetica ? (formData.get('aroma') as string) || null : null,
      effects: isGenetica ? (formData.get('effects') as string) || null : null,
      notes: isGenetica ? (formData.get('notes') as string) || null : null,
      description: (formData.get('description') as string) || null,
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/panel/catalogo');
  revalidatePath('/panel/stock');
  revalidatePath('/');
  return {};
}

export async function uploadStrainImages(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  requireAdmin(profile.role);

  const strainId = String(formData.get('strain_id'));
  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: 'Elegí al menos una foto' };

  const admin = createAdminClient();
  const uploadedUrls: string[] = [];
  for (const file of files) {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `catalogo/${profile.tenantId}/${strainId}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from('media')
      .upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (uploadError) return { error: uploadError.message };
    uploadedUrls.push(admin.storage.from('media').getPublicUrl(path).data.publicUrl);
  }

  const { data: current, error: readError } = await admin
    .from('strains')
    .select('images')
    .eq('id', strainId)
    .single();
  if (readError) return { error: readError.message };

  const { error } = await admin
    .from('strains')
    .update({ images: [...(current.images ?? []), ...uploadedUrls] })
    .eq('id', strainId);
  if (error) return { error: error.message };

  revalidatePath('/panel/catalogo');
  revalidatePath('/');
  return {};
}

export async function removeStrainImage(strainId: string, url: string) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  requireAdmin(profile.role);

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from('strains')
    .select('images')
    .eq('id', strainId)
    .single();
  if (readError) return { error: readError.message };

  const { error } = await admin
    .from('strains')
    .update({ images: (current.images ?? []).filter((u: string) => u !== url) })
    .eq('id', strainId);
  if (error) return { error: error.message };

  const path = url.split('/media/')[1];
  if (path) await admin.storage.from('media').remove([path]);

  revalidatePath('/panel/catalogo');
  revalidatePath('/');
  return {};
}

// "Juan Pérez #4" → "juanperez4": para emparejar archivos con artículos.
function clave(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Fotos en lote: cada archivo se asigna al artículo cuyo nombre coincide con
// el nombre del archivo (sin extensión, sin acentos ni signos). La foto nueva
// queda primera; con "reemplazar", se sacan las que tenía.
export async function subirFotoPorNombre(formData: FormData): Promise<{ error?: string; articulo?: string }> {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  requireAdmin(profile.role);

  const file = formData.get('foto');
  if (!(file instanceof File) || file.size === 0) return { error: 'Archivo vacío' };
  const reemplazar = formData.get('reemplazar') === '1';
  const buscado = clave(file.name.replace(/\.[^.]+$/, ''));
  if (!buscado) return { error: 'El archivo no tiene nombre' };

  const admin = createAdminClient();
  const { data: articulos } = await admin
    .from('strains')
    .select('id, name, images')
    .eq('tenant_id', profile.tenantId);
  const art = (articulos ?? []).find((a) => clave(String(a.name)) === buscado);
  if (!art) return { error: 'No hay ningún artículo con ese nombre' };

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `catalogo/${profile.tenantId}/${art.id}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage.from('media').upload(path, file, { contentType: file.type || 'image/jpeg' });
  if (uploadError) return { error: uploadError.message };
  const url = admin.storage.from('media').getPublicUrl(path).data.publicUrl;

  const actuales = ((art.images as string[] | null) ?? []).filter((u) => u !== url);
  const { error } = await admin
    .from('strains')
    .update({ images: reemplazar ? [url] : [url, ...actuales] })
    .eq('id', art.id);
  if (error) return { error: error.message };

  if (reemplazar) {
    // Borra del almacenamiento las fotos reemplazadas de este artículo.
    const viejas = actuales
      .map((u) => u.split('/storage/v1/object/public/media/')[1])
      .filter((p): p is string => Boolean(p));
    if (viejas.length) await admin.storage.from('media').remove(viejas);
  }
  return { articulo: String(art.name) };
}

export async function refrescarCatalogo() {
  revalidatePath('/panel/catalogo');
  revalidatePath('/');
  revalidatePath('/panel/sede/pedidos');
}
