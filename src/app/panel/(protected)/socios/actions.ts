'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

export async function createMember(formData: FormData, submitAs: 'draft' | 'pending') {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };

  const supabase = await createClient();
  const { error } = await supabase.from('members').insert({
    tenant_id: profile.tenantId,
    name: String(formData.get('name') ?? ''),
    dni: String(formData.get('dni') ?? ''),
    birth: (formData.get('birth') as string) || null,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    zona: (formData.get('zona') as string) || null,
    reprocann: (formData.get('reprocann') as string) || 'no',
    repr_num: (formData.get('repr_num') as string) || null,
    repr_exp: (formData.get('repr_exp') as string) || null,
    doctor: (formData.get('doctor') as string) || null,
    matricula: (formData.get('matricula') as string) || null,
    modalidad: (formData.get('modalidad') as string) || null,
    patologia: (formData.get('patologia') as string) || null,
    status: submitAs,
  });

  if (error) return { error: error.message };
  revalidatePath('/panel/socios');
  return {};
}

export async function setMemberStatus(memberId: string, status: 'valid' | 'rejected') {
  const supabase = await createClient();
  const { error } = await supabase.from('members').update({ status }).eq('id', memberId);
  if (error) return { error: error.message };
  revalidatePath('/panel/socios');
  revalidatePath(`/panel/socios/${memberId}`);
  return {};
}
