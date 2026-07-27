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

  const supabase = await createClient();
  const { data: strain, error } = await supabase
    .from('strains')
    .insert({
      tenant_id: profile.tenantId,
      name: String(formData.get('name') ?? ''),
      type: String(formData.get('type') ?? 'Híbrida'),
      thc: formData.get('thc') ? Number(formData.get('thc')) : null,
      cbd: formData.get('cbd') ? Number(formData.get('cbd')) : null,
      price_per_gram: Number(formData.get('price_per_gram') ?? 0),
      cross_info: (formData.get('cross_info') as string) || null,
      composition: (formData.get('composition') as string) || null,
      aroma: (formData.get('aroma') as string) || null,
      effects: (formData.get('effects') as string) || null,
      notes: (formData.get('notes') as string) || null,
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
  const supabase = await createClient();
  const { error } = await supabase
    .from('strains')
    .update({
      name: String(formData.get('name') ?? ''),
      type: String(formData.get('type') ?? 'Híbrida'),
      thc: formData.get('thc') ? Number(formData.get('thc')) : null,
      cbd: formData.get('cbd') ? Number(formData.get('cbd')) : null,
      price_per_gram: Number(formData.get('price_per_gram') ?? 0),
      active: formData.get('active') === 'on',
      cross_info: (formData.get('cross_info') as string) || null,
      composition: (formData.get('composition') as string) || null,
      aroma: (formData.get('aroma') as string) || null,
      effects: (formData.get('effects') as string) || null,
      notes: (formData.get('notes') as string) || null,
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
