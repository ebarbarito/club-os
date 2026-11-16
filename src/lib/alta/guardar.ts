import { randomUUID } from 'node:crypto';
import type { createAdminClient } from '@/lib/supabase/admin';

// Guardado de adjuntos y firma del alta (pre-inscripción web, 2ª parte y
// alta en la sede). Solo servidor.

// Documentos de alta: bucket PRIVADO (no público como "media") — DNI,
// constancia REPROCANN e indicación médica son datos sensibles, se sirven
// solo vía signed URL generada server-side para un admin autenticado (ver
// Socios/[id]). La etapa 1 solo admite la constancia REPROCANN; el resto
// se pide en la etapa 2.
export const DOCUMENT_FIELDS_ETAPA2: { field: string; label: string }[] = [
  { field: 'dni_frente', label: 'DNI (frente)' },
  { field: 'dni_dorso', label: 'DNI (dorso)' },
  { field: 'reprocann_doc', label: 'Constancia REPROCANN' },
  { field: 'indicacion_medica', label: 'Indicación médica' },
];

// Sube los adjuntos que vinieron en el form y los registra como
// documentos del socio. Un upload fallido no bloquea el alta.
export async function guardarDocumentos(
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
export async function guardarFirma(
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
