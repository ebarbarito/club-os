'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

async function requireAdmin() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede purgar los asientos');
  return profile;
}

export async function purgeAuditLog({ from, to }: { from?: string; to?: string }) {
  await requireAdmin();
  const supabase = await createClient();

  let query = supabase
    .from('audit_log')
    .delete()
    .gte('created_at', from ? `${from}T00:00:00` : '1970-01-01T00:00:00Z');
  if (to) query = query.lte('created_at', `${to}T23:59:59`);

  const { error } = await query;
  if (error) return { error: error.message };
  revalidatePath('/panel/asientos');
  return {};
}
