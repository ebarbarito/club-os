'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

async function requireAdmin() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede gestionar empleados');
  return profile;
}

export async function createEmployee(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from('employees').insert({
    tenant_id: profile.tenantId,
    name: String(formData.get('name') ?? ''),
    last_name: String(formData.get('last_name') ?? ''),
    dni: String(formData.get('dni') ?? ''),
    salary: Number(formData.get('salary') ?? 0),
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/empleados');
  revalidatePath('/panel/caja');
  return {};
}

export async function updateEmployee(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id'));
  const { error } = await supabase
    .from('employees')
    .update({
      name: String(formData.get('name') ?? ''),
      last_name: String(formData.get('last_name') ?? ''),
      dni: String(formData.get('dni') ?? ''),
      salary: Number(formData.get('salary') ?? 0),
      active: formData.get('active') === 'on',
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/panel/empleados');
  revalidatePath('/panel/caja');
  return {};
}
