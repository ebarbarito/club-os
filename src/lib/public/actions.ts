'use server';

import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { slugFromHost } from '@/lib/tenant/resolve';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADICIONALES, ENTREGAS, PLANES } from '@/lib/alta/opciones';
import { aplicarPlan, documentosParaSocio, personalizarDocumento } from '@/lib/alta/documentos';

// Documentos de alta: bucket PRIVADO (no público como "media") — DNI,
// constancia REPROCANN e indicación médica son datos sensibles, se sirven
// solo vía signed URL generada server-side para un admin autenticado (ver
// Socios/[id]). La etapa 1 solo admite la constancia REPROCANN; el resto
// se pide en la etapa 2.
const DOCUMENT_FIELDS_ETAPA2: { field: string; label: string }[] = [
  { field: 'dni_frente', label: 'DNI (frente)' },
  { field: 'dni_dorso', label: 'DNI (dorso)' },
  { field: 'reprocann_doc', label: 'Constancia REPROCANN' },
  { field: 'indicacion_medica', label: 'Indicación médica' },
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

// Sube los adjuntos que vinieron en el form y los registra como
// documentos del socio. Un upload fallido no bloquea el alta.
async function guardarDocumentos(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  memberId: string,
  formData: FormData,
  fields: { field: string; label: string }[],
) {
  for (const { field, label } of fields) {
    const file = formData.get(field);
    if (!(file instanceof File) || file.size === 0) continue;

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${tenantId}/${memberId}/${field}-${randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from('documentos')
      .upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (uploadError) continue;

    await admin.from('member_documents').insert({
      tenant_id: tenantId,
      member_id: memberId,
      storage_path: path,
      label,
    });
  }
}

// La firma viaja como PNG data URL en un input hidden (ver SignaturePad)
// -- se decodifica y se guarda como un documento más, mismo circuito que
// DNI/REPROCANN.
async function guardarFirma(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  memberId: string,
  firmaDataUrl: string,
) {
  if (!firmaDataUrl.startsWith('data:image/png;base64,')) return;
  const buffer = Buffer.from(firmaDataUrl.slice('data:image/png;base64,'.length), 'base64');
  const path = `${tenantId}/${memberId}/firma-${randomUUID()}.png`;
  const { error: uploadError } = await admin.storage
    .from('documentos')
    .upload(path, buffer, { contentType: 'image/png' });
  if (uploadError) return;
  await admin.from('member_documents').insert({
    tenant_id: tenantId,
    member_id: memberId,
    storage_path: path,
    label: 'Firma del solicitante',
  });
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

// ETAPA 1 — Pre-inscripción (link público /alta-socio). Datos personales,
// categoría y REPROCANN propio. Si no tiene REPROCANN queda asentado en
// `reprocann` ('tramite' | 'no') y se completa en la etapa 2.
export async function createMemberPublic(formData: FormData) {
  const tenant = await getRequestTenant();
  if (!tenant) return { error: 'Club no encontrado' };

  const birth = String(formData.get('birth') ?? '');
  // La pre-inscripción ya no pide categoría de socio (la reemplazó el plan,
  // según la "Propuesta para pacientes"): sin la categoría "Adherente —
  // Menor", todos tienen que ser mayores de edad. Un menor se gestiona a
  // mano desde el panel.
  if (!birth || !isAdult(birth)) {
    return { error: 'Tenés que ser mayor de 18 años para asociarte' };
  }

  const plan = str(formData, 'plan_solicitado');
  if (!plan || !PLANES.some((p) => p.value === plan)) return { error: 'Elegí un plan' };
  const adicionales = formData
    .getAll('adicionales_solicitados')
    .map(String)
    .filter((a) => ADICIONALES.some((o) => o.value === a));

  // En la etapa 1 ya se juntan datos personales (y el estado REPROCANN,
  // que es dato de salud): el consentimiento de la Ley 25.326 va acá. El
  // del estatuto y el de veracidad se firman en la etapa 2.
  if (formData.get('consiente_datos') !== 'on') {
    return { error: 'Tenés que aceptar el tratamiento de tus datos personales' };
  }

  const reprocann = str(formData, 'reprocann') ?? 'no';
  if (!['vigente', 'tramite', 'no'].includes(reprocann)) return { error: 'Opción de REPROCANN inválida' };
  const tieneReprocann = reprocann === 'vigente';
  // Paciente o autocultivador: se pregunta siempre (define qué documentos
  // firma en la segunda parte).
  const tipoInscripcion = str(formData, 'reprocann_type');
  if (!tipoInscripcion || !['paciente', 'autocultivador'].includes(tipoInscripcion)) {
    return { error: 'Contanos si te inscribís como paciente o como autocultivador' };
  }
  const tramite = str(formData, 'tramite_reprocann');
  if (!tieneReprocann && (!tramite || !['propio', 'acompanado'].includes(tramite))) {
    return { error: 'Contanos cómo vas a tramitar tu REPROCANN' };
  }
  if (tieneReprocann && (!str(formData, 'repr_num') || !str(formData, 'repr_exp'))) {
    return { error: 'Completá el número y el vencimiento de tu credencial REPROCANN' };
  }

  // Nombre y apellido llegan separados: `name` se arma como "Apellido
  // Nombre" (mismo formato que el resto del padrón) y el nombre de pila se
  // guarda aparte para el saludo de los mensajes de WhatsApp.
  const nombre = str(formData, 'nombre');
  const apellido = str(formData, 'apellido');
  if (!nombre || !apellido) return { error: 'Completá tu nombre y apellido' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('members')
    .insert({
      tenant_id: tenant.id,
      name: `${apellido} ${nombre}`,
      nombre_pila: nombre,
      dni: String(formData.get('dni') ?? '').trim(),
      birth,
      phone: str(formData, 'phone'),
      email: str(formData, 'email'),
      zona: str(formData, 'zona'),
      address: str(formData, 'address'),
      nacionalidad: str(formData, 'nacionalidad'),
      estado_civil: str(formData, 'estado_civil'),
      cuil_cuit: str(formData, 'cuil_cuit'),
      localidad: str(formData, 'localidad'),
      provincia: str(formData, 'provincia'),
      codigo_postal: str(formData, 'codigo_postal'),
      plan_solicitado: plan,
      adicionales_solicitados: adicionales,
      reprocann,
      reprocann_type: tipoInscripcion,
      repr_num: tieneReprocann ? str(formData, 'repr_num') : null,
      repr_exp: tieneReprocann ? str(formData, 'repr_exp') : null,
      tramite_reprocann: tieneReprocann ? null : tramite,
      consiente_datos: true,
      status: 'preinscripto',
    })
    .select('id')
    .single();

  if (error) {
    // unique (tenant_id, dni): ya se pre-inscribió antes (o ya es socio).
    if (error.code === '23505') {
      return { error: 'Ya hay una solicitud con ese DNI en el club. Escribinos por WhatsApp y lo vemos.' };
    }
    return { error: 'No pudimos enviar tu solicitud. Probá de nuevo en unos minutos.' };
  }
  const memberId = data.id as string;

  if (tieneReprocann) {
    await guardarDocumentos(admin, tenant.id, memberId, formData, [
      { field: 'reprocann_doc', label: 'Constancia REPROCANN' },
    ]);
  }

  return { memberId };
}

// ETAPA 2 — Formulario de adhesión. El link es personal: el token lo
// genera el club desde la ficha del socio (ver socios/actions.ts) y solo
// sirve mientras el socio siga pre-inscripto. Se valida contra el tenant
// del Host igual que todo lo demás de este archivo.
async function memberPorToken(token: string) {
  const tenant = await getRequestTenant();
  if (!tenant || !token) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('members')
    .select('id, name, dni, address, localidad, provincia, email, reprocann, reprocann_type, repr_num, repr_exp, plan_solicitado, adicionales_solicitados')
    .eq('tenant_id', tenant.id)
    .eq('etapa2_token', token)
    .eq('status', 'preinscripto')
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  return { tenant, member: data };
}

// Documentos a firmar, ya personalizados con los datos del socio. Se
// arman siempre del lado del servidor (nunca con texto que mande el
// navegador): lo que se guarda como aceptado es exactamente esto.
type MemberDoc = {
  name: string;
  dni: string;
  reprocann_type: string | null;
  address: string | null;
  localidad: string | null;
  provincia: string | null;
  email: string | null;
};

async function documentosParaFirmar(tenant: { id: string; name: string }, member: MemberDoc) {
  const admin = createAdminClient();
  const { data } = await admin.from('tenants').select('documentos_adhesion').eq('id', tenant.id).single();
  const fecha = new Date();
  const esAutocultivador = member.reprocann_type === 'autocultivador';
  return documentosParaSocio(data?.documentos_adhesion, esAutocultivador).map((d) => ({
    titulo: d.titulo,
    texto: personalizarDocumento(d.texto, {
      club: tenant.name,
      nombreCompleto: member.name,
      dni: member.dni,
      domicilio: [member.address, member.localidad, member.provincia].filter(Boolean).join(', '),
      email: member.email ?? '',
      tipo: member.reprocann_type,
      fecha,
    }),
  }));
}

// Lo mínimo para armar la pantalla: el link de la etapa 2 no expone más
// datos personales que el nombre (si se reenvía por error, no filtra la
// ficha completa).
export async function getEtapa2(token: string) {
  const res = await memberPorToken(token);
  if (!res) return null;
  return {
    tenantName: res.tenant.name,
    nombre: res.member.name as string,
    reprocann: res.member.reprocann as 'vigente' | 'tramite' | 'no',
    // Lo que eligió en la pre-inscripción: se precarga para que lo confirme
    // (o lo ajuste) ya con la indicación médica en la mano.
    plan: (res.member.plan_solicitado as string | null) ?? '',
    adicionales: (res.member.adicionales_solicitados as string[] | null) ?? [],
    documentos: await documentosParaFirmar(res.tenant, res.member as MemberDoc),
  };
}

export async function completarEtapa2(token: string, formData: FormData) {
  const res = await memberPorToken(token);
  if (!res) return { error: 'Este link ya no es válido. Pedile al club uno nuevo por WhatsApp.' };
  const { tenant, member } = res;

  // Cada documento tiene que venir aceptado ("Leí y acepto"), en el mismo
  // orden en que se mostró.
  const documentos = await documentosParaFirmar(tenant, member as MemberDoc);
  if (documentos.some((_, i) => formData.get(`acepta_doc_${i}`) !== 'on')) {
    return { error: 'Tenés que leer y aceptar todos los documentos' };
  }
  const firma = String(formData.get('firma_data_url') ?? '');
  if (!firma.startsWith('data:image/png;base64,')) return { error: 'Falta tu firma' };

  const plan = str(formData, 'plan_solicitado');
  if (!plan || !PLANES.some((p) => p.value === plan)) return { error: 'Elegí un plan' };
  const entrega = str(formData, 'entrega_preferida');
  if (!entrega || !ENTREGAS.some((e) => e.value === entrega)) return { error: 'Elegí retiro o envío' };
  const adicionales = formData
    .getAll('adicionales_solicitados')
    .map(String)
    .filter((a) => ADICIONALES.some((o) => o.value === a));

  const dosis = str(formData, 'dosis_mensual');
  if (!str(formData, 'doctor') || !str(formData, 'patologia') || !str(formData, 'producto_prescripto') || !dosis) {
    return { error: 'Completá los datos de tu indicación médica' };
  }

  // REPROCANN: si en la etapa 1 quedó pendiente, se actualiza acá. Si ya
  // estaba vigente no se toca (lo cargó en la etapa 1 y el club lo revisó).
  const reprocannUpdate: Record<string, string | null> = {};
  if (member.reprocann !== 'vigente') {
    const reprocann = str(formData, 'reprocann') ?? member.reprocann;
    if (!['vigente', 'tramite', 'no'].includes(reprocann)) return { error: 'Opción de REPROCANN inválida' };
    if (reprocann === 'vigente' && (!str(formData, 'repr_num') || !str(formData, 'repr_exp'))) {
      return { error: 'Completá el número y el vencimiento de tu credencial REPROCANN' };
    }
    reprocannUpdate.reprocann = reprocann;
    if (reprocann === 'vigente') {
      reprocannUpdate.repr_num = str(formData, 'repr_num');
      reprocannUpdate.repr_exp = str(formData, 'repr_exp');
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('members')
    .update({
      ...reprocannUpdate,
      doctor: str(formData, 'doctor'),
      especialidad_institucion: str(formData, 'especialidad_institucion'),
      matricula: str(formData, 'matricula'),
      patologia: str(formData, 'patologia'),
      producto_prescripto: str(formData, 'producto_prescripto'),
      dosis_mensual: Number(dosis),
      dosis_unidad: str(formData, 'dosis_unidad'),
      plan_solicitado: plan,
      adicionales_solicitados: adicionales,
      entrega_preferida: entrega,
      consiente_estatuto: true,
      consiente_veracidad: true,
      status: 'pending',
      etapa2_completada_at: new Date().toISOString(),
      // El link se quema al usarlo: no se puede volver a pisar la ficha.
      etapa2_token: null,
    })
    .eq('id', member.id)
    .eq('tenant_id', tenant.id)
    .eq('status', 'preinscripto');
  if (error) return { error: 'No pudimos guardar tu formulario. Probá de nuevo en unos minutos.' };

  // Constancia de lo aceptado: texto exacto, fecha, IP y navegador.
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const userAgent = h.get('user-agent')?.slice(0, 500) || null;
  await admin.from('member_aceptaciones').insert(
    documentos.map((d, i) => ({
      tenant_id: tenant.id,
      member_id: member.id,
      orden: i,
      documento_titulo: d.titulo,
      // Con los datos del plan que efectivamente envió.
      documento_texto: aplicarPlan(d.texto, plan, adicionales),
      ip,
      user_agent: userAgent,
    })),
  );

  await guardarDocumentos(admin, tenant.id, member.id, formData, DOCUMENT_FIELDS_ETAPA2);
  await guardarFirma(admin, tenant.id, member.id, firma);

  return {};
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
