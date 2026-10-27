'use server';

import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { publicUrlForSlug } from '@/lib/tenant/resolve';
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
    address: (formData.get('address') as string) || null,
    nacionalidad: (formData.get('nacionalidad') as string) || null,
    estado_civil: (formData.get('estado_civil') as string) || null,
    cuil_cuit: (formData.get('cuil_cuit') as string) || null,
    localidad: (formData.get('localidad') as string) || null,
    provincia: (formData.get('provincia') as string) || null,
    codigo_postal: (formData.get('codigo_postal') as string) || null,
    categoria_socio: (formData.get('categoria_socio') as string) || null,
    reprocann: (formData.get('reprocann') as string) || 'no',
    repr_num: (formData.get('repr_num') as string) || null,
    repr_exp: (formData.get('repr_exp') as string) || null,
    doctor: (formData.get('doctor') as string) || null,
    especialidad_institucion: (formData.get('especialidad_institucion') as string) || null,
    matricula: (formData.get('matricula') as string) || null,
    modalidad: (formData.get('modalidad') as string) || null,
    patologia: (formData.get('patologia') as string) || null,
    producto_prescripto: (formData.get('producto_prescripto') as string) || null,
    dosis_mensual: formData.get('dosis_mensual') ? Number(formData.get('dosis_mensual')) : null,
    dosis_unidad: (formData.get('dosis_unidad') as string) || null,
    servicio_pactado_tipo: (formData.get('servicio_pactado_tipo') as string) || null,
    servicio_pactado_cantidad: formData.get('servicio_pactado_cantidad') ? Number(formData.get('servicio_pactado_cantidad')) : null,
    cuota_social: formData.get('cuota_social') ? Number(formData.get('cuota_social')) : null,
    factura_automatica: formData.get('factura_automatica') === 'on',
    cuota_social_bonificada: formData.get('cuota_social_bonificada') === 'on',
    status: submitAs,
  });

  if (error) return { error: error.message };
  revalidatePath('/panel/socios');
  return {};
}

export async function setMemberStatus(memberId: string, status: 'valid' | 'rejected') {
  const supabase = await createClient();
  // Al validar o rechazar, un link de etapa 2 pendiente deja de servir.
  const { error } = await supabase.from('members').update({ status, etapa2_token: null }).eq('id', memberId);
  if (error) return { error: error.message };
  revalidatePath('/panel/socios');
  revalidatePath(`/panel/socios/${memberId}`);
  return {};
}

// Arma (o reutiliza) el link personal de la etapa 2 del alta para un
// socio pre-inscripto. El token se genera recién acá, cuando el club ya
// revisó la pre-inscripción, y se reutiliza si se reenvía (no invalida un
// link que el socio ya tenga abierto).
export async function generarLinkEtapa2(memberId: string) {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== 'admin') return { error: 'Solo un admin puede enviar la etapa 2' };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from('members')
    .select('id, status, etapa2_token')
    .eq('id', memberId)
    .eq('tenant_id', profile.tenantId)
    .maybeSingle();
  if (!member) return { error: 'Socio no encontrado' };
  if (member.status !== 'preinscripto') return { error: 'El socio no está pre-inscripto' };

  let token = member.etapa2_token as string | null;
  if (!token) token = randomBytes(24).toString('base64url');

  const { error } = await supabase
    .from('members')
    .update({ etapa2_token: token, etapa2_enviada_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('tenant_id', profile.tenantId);
  if (error) return { error: error.message };

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', profile.tenantId).single();
  const base = (tenant && publicUrlForSlug(tenant.slug)) ?? (await requestOrigin());

  revalidatePath(`/panel/socios/${memberId}`);
  return { url: `${base}/alta-socio/completar/${token}` };
}

async function requestOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function updateMember(memberId: string, formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };

  const supabase = await createClient();
  const memberNumber = formData.get('member_number');
  const { error } = await supabase
    .from('members')
    .update({
      member_number: memberNumber ? Number(memberNumber) : null,
      name: String(formData.get('name') ?? ''),
      nombre_pila: (formData.get('nombre_pila') as string)?.trim() || null,
      dni: String(formData.get('dni') ?? ''),
      birth: (formData.get('birth') as string) || null,
      phone: (formData.get('phone') as string) || null,
      email: (formData.get('email') as string) || null,
      address: (formData.get('address') as string) || null,
      zona: (formData.get('zona') as string) || null,
      nacionalidad: (formData.get('nacionalidad') as string) || null,
      estado_civil: (formData.get('estado_civil') as string) || null,
      cuil_cuit: (formData.get('cuil_cuit') as string) || null,
      localidad: (formData.get('localidad') as string) || null,
      provincia: (formData.get('provincia') as string) || null,
      codigo_postal: (formData.get('codigo_postal') as string) || null,
      categoria_socio: (formData.get('categoria_socio') as string) || null,
      reprocann: (formData.get('reprocann') as string) || 'no',
      reprocann_type: (formData.get('reprocann_type') as string) || null,
      repr_num: (formData.get('repr_num') as string) || null,
      repr_exp: (formData.get('repr_exp') as string) || null,
      doctor: (formData.get('doctor') as string) || null,
      especialidad_institucion: (formData.get('especialidad_institucion') as string) || null,
      matricula: (formData.get('matricula') as string) || null,
      modalidad: (formData.get('modalidad') as string) || null,
      patologia: (formData.get('patologia') as string) || null,
      producto_prescripto: (formData.get('producto_prescripto') as string) || null,
      dosis_mensual: formData.get('dosis_mensual') ? Number(formData.get('dosis_mensual')) : null,
      dosis_unidad: (formData.get('dosis_unidad') as string) || null,
      servicio_pactado_tipo: (formData.get('servicio_pactado_tipo') as string) || null,
      servicio_pactado_cantidad: formData.get('servicio_pactado_cantidad') ? Number(formData.get('servicio_pactado_cantidad')) : null,
      cuota_social: formData.get('cuota_social') ? Number(formData.get('cuota_social')) : null,
      factura_automatica: formData.get('factura_automatica') === 'on',
      cuota_social_bonificada: formData.get('cuota_social_bonificada') === 'on',
      status: String(formData.get('status') ?? 'draft'),
    })
    .eq('id', memberId)
    .eq('tenant_id', profile.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/panel/socios');
  revalidatePath(`/panel/socios/${memberId}`);
  return {};
}

export async function softDeleteMember(memberId: string) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('members')
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile.userId })
    .eq('id', memberId)
    .eq('tenant_id', profile.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/panel/socios');
  return {};
}
