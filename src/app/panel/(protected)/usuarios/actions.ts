'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

async function requireAdminProfile() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede gestionar usuarios');
  return profile;
}

export async function createUser(formData: FormData) {
  const profile = await requireAdminProfile();
  const admin = createAdminClient();

  const email = String(formData.get('email') ?? '');
  const { data: userRes, error: userError } = await admin.auth.admin.createUser({
    email,
    password: String(formData.get('password') ?? ''),
    email_confirm: true,
  });
  if (userError) return { error: userError.message };

  const supabase = await createClient();
  const { error: profileError } = await supabase.from('profiles').insert({
    id: userRes.user.id,
    tenant_id: profile.tenantId,
    name: String(formData.get('name') ?? ''),
    role: String(formData.get('role') ?? 'dispensador'),
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userRes.user.id);
    return { error: profileError.message };
  }

  revalidatePath('/panel/usuarios');
  return {};
}

export async function deleteUser(userId: string) {
  const profile = await requireAdminProfile();
  if (userId === profile.userId) return { error: 'No podés eliminar tu propia cuenta' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath('/panel/usuarios');
  return {};
}
