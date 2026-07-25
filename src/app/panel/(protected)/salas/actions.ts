'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

function requireAdmin(role: string) {
  if (role !== 'admin') throw new Error('Solo un administrador puede hacer esto');
}

export async function upsertSala(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  requireAdmin(profile.role);

  const id = formData.get('id') as string | null;
  const supabase = await createClient();

  const payload = {
    tenant_id: profile.tenantId,
    name: String(formData.get('name') ?? ''),
    strain_id: (formData.get('strain_id') as string) || null,
    etapa: String(formData.get('etapa') ?? 'vegetativo'),
    etapa_dias: Number(formData.get('etapa_dias') ?? 0),
    plants: Number(formData.get('plants') ?? 0),
    capacity: Number(formData.get('capacity') ?? 0),
    cosecha_estimada: (formData.get('cosecha_estimada') as string) || null,
    responsable: (formData.get('responsable') as string) || null,
    temp_min: formData.get('temp_min') ? Number(formData.get('temp_min')) : null,
    temp_max: formData.get('temp_max') ? Number(formData.get('temp_max')) : null,
    hum_min: formData.get('hum_min') ? Number(formData.get('hum_min')) : null,
    hum_max: formData.get('hum_max') ? Number(formData.get('hum_max')) : null,
    sensor_id: (formData.get('sensor_id') as string) || null,
  };

  const { error } = id
    ? await supabase.from('salas').update(payload).eq('id', id)
    : await supabase.from('salas').insert(payload);
  if (error) return { error: error.message };

  revalidatePath('/panel/salas');
  return {};
}

export async function closeCiclo(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  requireAdmin(profile.role);

  const salaId = String(formData.get('sala_id'));
  const items = JSON.parse(String(formData.get('items') ?? '[]'));

  const supabase = await createClient();
  const { error } = await supabase.rpc('close_ciclo', { p_sala_id: salaId, p_items: items });
  if (error) return { error: error.message };

  revalidatePath('/panel/salas');
  revalidatePath('/panel/stock');
  return {};
}
