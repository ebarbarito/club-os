'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADICIONALES, PLANES } from '@/lib/alta/opciones';
import { aplicarDatosEtapa2, documentosParaSocio, personalizarDocumento } from '@/lib/alta/documentos';
import { DOCUMENT_FIELDS_ETAPA2, guardarDocumentos, guardarFirma } from '@/lib/alta/guardar';

type Resultado =
  | { error: string; campo?: string }
  | { ok: true; nombre: string; numero: number | null; validado: boolean; derivado: boolean };

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function esMayor(birth: string) {
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return false;
  const hoy = new Date();
  let edad = hoy.getFullYear() - b.getFullYear();
  const m = hoy.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < b.getDate())) edad--;
  return edad >= 18;
}

// Alta completa en la sede (tablet): pre-inscripción + 2ª parte en un solo
// envío. Con REPROCANN vigente queda validado; si no, queda en evaluación y,
// sin REPROCANN, derivado a Clinicann.
export async function altaEnSede(fd: FormData): Promise<Resultado> {
  const profile = await getSessionProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'sede')) {
    return { error: 'Este usuario no puede cargar altas en la sede' };
  }
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, documentos_adhesion')
    .eq('id', profile.tenantId)
    .single();
  if (!tenant) return { error: 'Club no encontrado' };

  const responsable = str(fd, 'responsable');
  if (!responsable) return { error: 'Elegí quién está asistiendo el alta', campo: 'responsable' };

  // Datos personales (mismas reglas que la pre-inscripción web).
  const requeridos: [string, string][] = [
    ['nombre', 'Completá el nombre'],
    ['apellido', 'Completá el apellido'],
    ['dni', 'Completá el DNI'],
    ['birth', 'Completá la fecha de nacimiento'],
    ['cuil_cuit', 'Completá el CUIL/CUIT'],
    ['address', 'Completá el domicilio'],
    ['localidad', 'Completá la localidad'],
    ['provincia', 'Completá la provincia'],
    ['phone', 'Completá el teléfono'],
    ['email', 'Completá el correo electrónico'],
  ];
  for (const [campo, msj] of requeridos) if (!str(fd, campo)) return { error: msj, campo };
  // El mail se escribe dos veces: ahí le llega la clave para entrar al sitio.
  const emailRepetido = str(fd, 'email_confirmacion');
  if (emailRepetido !== null && emailRepetido.toLowerCase() !== str(fd, 'email')!.toLowerCase()) {
    return { error: 'Los dos correos no coinciden', campo: 'email_confirmacion' };
  }
  const nombre = str(fd, 'nombre')!;
  const apellido = str(fd, 'apellido')!;
  const dni = str(fd, 'dni')!;
  if (dni.replace(/\D/g, '').length < 7) return { error: 'Revisá el DNI', campo: 'dni' };
  const birth = str(fd, 'birth')!;
  if (!esMayor(birth)) return { error: 'Tiene que ser mayor de 18 años para asociarse', campo: 'birth' };

  const tipo = str(fd, 'reprocann_type');
  if (tipo !== 'paciente' && tipo !== 'autocultivador') return { error: 'Elegí paciente o autocultivador', campo: 'reprocann_type' };
  const plan = str(fd, 'plan_solicitado');
  if (!plan || !PLANES.some((p) => p.value === plan)) return { error: 'Elegí un plan', campo: 'plan_solicitado' };
  if (tipo === 'autocultivador' && plan === 'medicinal') {
    return { error: 'El plan Medicinal no aplica al autocultivo', campo: 'plan_solicitado' };
  }
  const adicionales = fd
    .getAll('adicionales_solicitados')
    .map(String)
    .filter((a) => ADICIONALES.some((o) => o.value === a));

  const reprocann = str(fd, 'reprocann');
  if (reprocann !== 'vigente' && reprocann !== 'tramite' && reprocann !== 'no') {
    return { error: 'Indicá si tiene REPROCANN', campo: 'reprocann' };
  }
  const vigente = reprocann === 'vigente';
  if (vigente && (!str(fd, 'repr_num') || !str(fd, 'repr_exp'))) {
    return { error: 'Completá el número y el vencimiento de la credencial', campo: !str(fd, 'repr_num') ? 'repr_num' : 'repr_exp' };
  }

  // Indicación médica: solo el médico es obligatorio (diagnóstico, producto
  // y dosis son opcionales).
  const faltaMedico = ['doctor'].find((c) => !str(fd, c));
  if (faltaMedico) return { error: 'Completá los datos de la indicación médica', campo: faltaMedico };
  const dosis = str(fd, 'dosis_mensual');
  if (dosis && !(Number(dosis) >= 0)) return { error: 'La dosis mensual tiene que ser un número', campo: 'dosis_mensual' };

  if (fd.get('consiente_datos') !== 'on') {
    return { error: 'Falta aceptar el tratamiento de datos personales', campo: 'consiente_datos' };
  }

  // Documentos: los mismos que la 2ª parte, armados en el servidor con lo
  // que se cargó en este formulario.
  const fecha = new Date();
  const datosDoc = {
    club: tenant.name as string,
    nombreCompleto: `${apellido} ${nombre}`,
    dni,
    fechaNacimiento: birth,
    nacionalidad: str(fd, 'nacionalidad'),
    estadoCivil: str(fd, 'estado_civil'),
    domicilioReal: str(fd, 'address'),
    localidad: str(fd, 'localidad'),
    provincia: str(fd, 'provincia'),
    codigoPostal: str(fd, 'codigo_postal'),
    telefono: str(fd, 'phone'),
    email: str(fd, 'email'),
    cuil: str(fd, 'cuil_cuit'),
    tipo,
    fecha,
  };
  const documentos = documentosParaSocio(tenant.documentos_adhesion, tipo === 'autocultivador').map((d) => ({
    titulo: d.titulo,
    texto: aplicarDatosEtapa2(personalizarDocumento(d.texto, datosDoc), {
      plan,
      adicionales,
      reprocann,
      credencial: str(fd, 'repr_num'),
      vencimiento: str(fd, 'repr_exp'),
      medico: str(fd, 'doctor'),
      especialidad: str(fd, 'especialidad_institucion'),
      diagnostico: str(fd, 'patologia'),
      producto: str(fd, 'producto_prescripto'),
      dosis,
      unidad: str(fd, 'dosis_unidad'),
    }),
  }));
  const sinAceptar = documentos.findIndex((_, i) => fd.get(`acepta_doc_${i}`) !== 'on');
  if (sinAceptar >= 0) return { error: 'Falta leer y aceptar todos los documentos', campo: `acepta_doc_${sinAceptar}` };
  const firma = String(fd.get('firma_data_url') ?? '');
  if (!firma.startsWith('data:image/png;base64,')) return { error: 'Falta la firma', campo: 'firma_data_url' };

  const ahora = fecha.toISOString();
  const { data: socio, error } = await admin
    .from('members')
    .insert({
      tenant_id: tenant.id,
      name: `${apellido} ${nombre}`,
      nombre_pila: nombre,
      dni,
      birth,
      phone: str(fd, 'phone'),
      email: str(fd, 'email'),
      address: str(fd, 'address'),
      nacionalidad: str(fd, 'nacionalidad'),
      estado_civil: str(fd, 'estado_civil'),
      cuil_cuit: str(fd, 'cuil_cuit'),
      localidad: str(fd, 'localidad'),
      provincia: str(fd, 'provincia'),
      codigo_postal: str(fd, 'codigo_postal'),
      plan_solicitado: plan,
      adicionales_solicitados: adicionales,
      reprocann,
      reprocann_type: tipo,
      repr_num: vigente ? str(fd, 'repr_num') : null,
      repr_exp: vigente ? str(fd, 'repr_exp') : null,
      tramite_reprocann: reprocann === 'no' ? 'acompanado' : null,
      doctor: str(fd, 'doctor'),
      matricula: str(fd, 'matricula'),
      especialidad_institucion: str(fd, 'especialidad_institucion'),
      patologia: str(fd, 'patologia'),
      producto_prescripto: str(fd, 'producto_prescripto'),
      dosis_mensual: dosis ? Number(dosis) : null,
      dosis_unidad: str(fd, 'dosis_unidad'),
      consiente_datos: true,
      consiente_estatuto: true,
      consiente_veracidad: true,
      status: vigente ? 'valid' : 'pending',
      etapa2_completada_at: ahora,
      derivado_clinicann_at: reprocann === 'no' ? ahora : null,
      alta_canal: 'sede',
      alta_asistida_por: responsable.slice(0, 120),
    })
    .select('id, member_number')
    .single();

  if (error || !socio) {
    if (error?.code === '23505') {
      return {
        error: 'Ya hay un socio o una solicitud con ese DNI. Buscalo en Socios para completar su ficha.',
        campo: 'dni',
      };
    }
    return { error: 'No se pudo guardar el alta. Probá de nuevo.' };
  }

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const userAgent = `${(h.get('user-agent') ?? '').slice(0, 400)} · alta en sede, asistió ${responsable}`.slice(0, 500);
  await admin.from('member_aceptaciones').insert(
    documentos.map((d, i) => ({
      tenant_id: tenant.id,
      member_id: socio.id,
      orden: i,
      documento_titulo: d.titulo,
      documento_texto: d.texto,
      ip,
      user_agent: userAgent,
    })),
  );
  await guardarDocumentos(admin, tenant.id, socio.id, fd, DOCUMENT_FIELDS_ETAPA2);
  await guardarFirma(admin, tenant.id, socio.id, firma);

  revalidatePath('/panel/socios');
  revalidatePath('/panel', 'layout');
  return {
    ok: true,
    nombre,
    numero: (socio.member_number as number | null) ?? null,
    validado: vigente,
    derivado: reprocann === 'no',
  };
}
