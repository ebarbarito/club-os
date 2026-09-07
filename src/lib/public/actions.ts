'use server';

import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { slugFromHost } from '@/lib/tenant/resolve';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';
import { createAdminClient } from '@/lib/supabase/admin';

// Documentos de alta: bucket PRIVADO (no público como "media") — DNI y
// constancia REPROCANN son datos sensibles, se sirven solo vía signed
// URL generada server-side para un admin autenticado (ver Socios/[id]).
const DOCUMENT_FIELDS: { field: string; label: string }[] = [
  { field: 'dni_frente', label: 'DNI (frente)' },
  { field: 'dni_dorso', label: 'DNI (dorso)' },
  { field: 'reprocann_doc', label: 'Constancia REPROCANN' },
];

// El tenant se resuelve server-side a partir del Host (vía proxy.ts,
// header x-club-os-tenant-slug) — nunca de un campo que mande el cliente.
// Éste es el único punto de confianza para todas las escrituras/lecturas
// públicas de este archivo.
async function getRequestTenant() {
  const slug = (await headers()).get('x-club-os-tenant-slug') ?? slugFromHost((await headers()).get('host'));
  if (!slug) return null;
  return getTenantBySlug(slug);
}

function isAdult(birth: string): boolean {
  const b = new Date(birth);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age >= 18;
}

export async function createMemberPublic(formData: FormData) {
  const tenant = await getRequestTenant();
  if (!tenant) return { error: 'Club no encontrado' };

  const birth = String(formData.get('birth') ?? '');
  const categoriaSocio = (formData.get('categoria_socio') as string) || null;
  // "Adherente — Menor de edad" es la única categoría que puede ser
  // menor de 18 -- el resto sigue exigiendo mayoría de edad. La captura
  // de datos del tutor/representante legal queda pendiente (sección 3
  // del formulario todavía no definida).
  if (!birth || (categoriaSocio !== 'adherente_menor' && !isAdult(birth))) {
    return { error: 'Tenés que ser mayor de 18 años para asociarte' };
  }

  const consienteEstatuto = formData.get('consiente_estatuto') === 'on';
  const consienteDatos = formData.get('consiente_datos') === 'on';
  const consienteVeracidad = formData.get('consiente_veracidad') === 'on';
  if (!consienteEstatuto || !consienteDatos || !consienteVeracidad) {
    return { error: 'Tenés que aceptar las 3 declaraciones de consentimiento' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('members')
    .insert({
      tenant_id: tenant.id,
      name: String(formData.get('name') ?? ''),
      dni: String(formData.get('dni') ?? ''),
      birth,
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
      categoria_socio: categoriaSocio,
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
      consiente_estatuto: consienteEstatuto,
      consiente_datos: consienteDatos,
      consiente_veracidad: consienteVeracidad,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  const memberId = data.id as string;

  for (const { field, label } of DOCUMENT_FIELDS) {
    const file = formData.get(field);
    if (!(file instanceof File) || file.size === 0) continue;

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${tenant.id}/${memberId}/${field}-${randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from('documentos')
      .upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (uploadError) continue; // no bloquea el alta si falla la subida de un documento

    await admin.from('member_documents').insert({
      tenant_id: tenant.id,
      member_id: memberId,
      storage_path: path,
      label,
    });
  }

  // La firma viaja como PNG data URL en un input hidden (ver
  // SignaturePad) -- se decodifica y se guarda como un documento más,
  // mismo circuito que DNI/REPROCANN.
  const firmaDataUrl = String(formData.get('firma_data_url') ?? '');
  if (firmaDataUrl.startsWith('data:image/png;base64,')) {
    const base64 = firmaDataUrl.slice('data:image/png;base64,'.length);
    const buffer = Buffer.from(base64, 'base64');
    const path = `${tenant.id}/${memberId}/firma-${randomUUID()}.png`;
    const { error: uploadError } = await admin.storage
      .from('documentos')
      .upload(path, buffer, { contentType: 'image/png' });
    if (!uploadError) {
      await admin.from('member_documents').insert({
        tenant_id: tenant.id,
        member_id: memberId,
        storage_path: path,
        label: 'Firma del solicitante',
      });
    }
  }

  return { memberId };
}

export async function checkMemberStatus(memberId: string) {
  const tenant = await getRequestTenant();
  if (!tenant) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('members')
    .select('status, name')
    .eq('id', memberId)
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  return data;
}

type CartItem = { strainId: string; grams: number };

export async function createReservation(formData: FormData) {
  const tenant = await getRequestTenant();
  if (!tenant) return { error: 'Club no encontrado' };

  const memberId = String(formData.get('member_id') ?? '');
  const items: CartItem[] = JSON.parse(String(formData.get('items') ?? '[]'));
  const delivery = String(formData.get('delivery') ?? 'pickup');

  if (items.length === 0) return { error: 'El carrito está vacío' };

  const admin = createAdminClient();

  const { data: member } = await admin
    .from('members')
    .select('status')
    .eq('id', memberId)
    .eq('tenant_id', tenant.id)
    .maybeSingle();
  if (!member || member.status !== 'valid') {
    return { error: 'Necesitás ser socio validado para confirmar una reserva' };
  }

  // El stock no se muestra en el sitio público, pero igual se valida acá
  // — sin revelar el número exacto disponible, solo si alcanza o no.
  const { data: stockRows } = await admin
    .from('stock')
    .select('strain_id, grams, strain:strains(name)')
    .eq('tenant_id', tenant.id)
    .in(
      'strain_id',
      items.map((it) => it.strainId),
    );
  const stockByStrain = new Map((stockRows ?? []).map((r) => [r.strain_id, r]));
  for (const it of items) {
    const row = stockByStrain.get(it.strainId);
    const strainField = row?.strain;
    const strain = Array.isArray(strainField) ? strainField[0] : strainField;
    if (!row || row.grams < it.grams) {
      return { error: `${strain?.name ?? 'Uno de los productos'} no tiene stock suficiente para la cantidad pedida` };
    }
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      tenant_id: tenant.id,
      member_id: memberId,
      delivery,
      status: 'reservado',
      pickup_day: delivery === 'pickup' ? (formData.get('pickup_day') as string) || null : null,
      pickup_time: delivery === 'pickup' ? (formData.get('pickup_time') as string) || null : null,
      address: delivery === 'shipping' ? (formData.get('address') as string) || null : null,
      zona: (formData.get('zona') as string) || null,
      method: (formData.get('method') as string) || 'efectivo',
    })
    .select('id')
    .single();
  if (orderError) return { error: orderError.message };

  const { error: itemsError } = await admin.from('order_items').insert(
    items.map((it) => ({
      tenant_id: tenant.id,
      order_id: order.id,
      strain_id: it.strainId,
      grams: it.grams,
    })),
  );
  if (itemsError) return { error: itemsError.message };

  return { orderId: order.id as string };
}
