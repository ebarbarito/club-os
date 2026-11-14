'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRequestBaseUrl, getRequestTenant } from '@/lib/tenant/request';
import {
  BLOQUEO_MINUTOS,
  MAX_INTENTOS,
  hashClave,
  normalizarProvisoria,
  problemaClaveNueva,
  soloDigitos,
  verificarClave,
} from './clave';
import { cerrarSesion, crearSesion, getSocioSesion } from './sesion';
import { emitirClaveProvisoria, mailValido } from './acceso';

export type Estado = { error?: string; ok?: string } | null;

type SocioDni = { id: string; name: string | null; email: string | null; status: string };

async function socioPorDni(tenantId: string, dni: string): Promise<SocioDni | null> {
  const admin = createAdminClient();
  const { data } = await admin.rpc('socio_por_dni', { p_tenant: tenantId, p_dni: dni });
  const fila = Array.isArray(data) ? data[0] : null;
  return (fila as SocioDni | undefined) ?? null;
}

// "Recibir mi clave": manda una clave provisoria al mail del socio. La
// respuesta es siempre la misma, para no revelar quién es socio.
export async function pedirClave(_prev: Estado, formData: FormData): Promise<Estado> {
  const tenant = await getRequestTenant();
  if (!tenant) return { error: 'Club no encontrado' };
  const dni = soloDigitos(String(formData.get('dni') ?? ''));
  if (dni.length < 6) return { error: 'Ingresá tu número de DNI, sin puntos.' };

  const socio = await socioPorDni(tenant.id, dni);
  if (socio && socio.status === 'valid' && mailValido(socio.email)) {
    const res = await emitirClaveProvisoria(createAdminClient(), {
      tenant: { id: tenant.id, name: tenant.name },
      member: { id: socio.id, name: socio.name, email: socio.email },
      baseUrl: await getRequestBaseUrl(),
    });
    if (res.error) console.error('[socios] pedirClave', tenant.slug, res.error);
  }

  return {
    ok: 'Si tu DNI corresponde a un socio validado con mail registrado, en unos minutos te llega una clave provisoria. Revisá también la carpeta de spam. Si no te llega, escribinos por WhatsApp.',
  };
}

// Ingreso con DNI y contraseña (o la clave provisoria del mail).
export async function ingresar(_prev: Estado, formData: FormData): Promise<Estado> {
  const tenant = await getRequestTenant();
  if (!tenant) return { error: 'Club no encontrado' };
  const dni = soloDigitos(String(formData.get('dni') ?? ''));
  const clave = String(formData.get('clave') ?? '');
  if (dni.length < 6 || !clave) return { error: 'Completá tu DNI y tu contraseña.' };

  const incorrecto = { error: 'DNI o contraseña incorrectos.' };
  const socio = await socioPorDni(tenant.id, dni);
  if (!socio || socio.status !== 'valid') return incorrecto;

  const admin = createAdminClient();
  const { data: acceso } = await admin
    .from('member_accesos')
    .select('password_hash, clave_temp_hash, clave_temp_expira, intentos_fallidos, bloqueado_hasta')
    .eq('member_id', socio.id)
    .maybeSingle();
  if (!acceso) return incorrecto;

  const ahora = Date.now();
  if (acceso.bloqueado_hasta && new Date(acceso.bloqueado_hasta).getTime() > ahora) {
    return { error: `Hubo demasiados intentos. Probá de nuevo en ${BLOQUEO_MINUTOS} minutos o pedí una clave nueva.` };
  }

  let conProvisoria = false;
  let ok = await verificarClave(clave, acceso.password_hash);
  if (!ok && acceso.clave_temp_hash && acceso.clave_temp_expira && new Date(acceso.clave_temp_expira).getTime() > ahora) {
    ok = await verificarClave(normalizarProvisoria(clave), acceso.clave_temp_hash);
    conProvisoria = ok;
  }

  if (!ok) {
    const intentos = (acceso.intentos_fallidos ?? 0) + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await admin
      .from('member_accesos')
      .update({
        intentos_fallidos: bloquear ? 0 : intentos,
        bloqueado_hasta: bloquear ? new Date(ahora + BLOQUEO_MINUTOS * 60_000).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', socio.id);
    return bloquear
      ? { error: `Hubo demasiados intentos. Probá de nuevo en ${BLOQUEO_MINUTOS} minutos o pedí una clave nueva.` }
      : incorrecto;
  }

  await admin
    .from('member_accesos')
    .update({
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      ultimo_ingreso_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // La provisoria sirve una sola vez.
      ...(conProvisoria ? { clave_temp_hash: null, clave_temp_expira: null } : {}),
    })
    .eq('member_id', socio.id);

  await crearSesion(socio.id, tenant.id, conProvisoria);
  return redirect(conProvisoria ? '/socios/clave' : '/socios');
}

// Contraseña definitiva (obligatoria después de entrar con la provisoria).
export async function cambiarClave(_prev: Estado, formData: FormData): Promise<Estado> {
  const tenant = await getRequestTenant();
  if (!tenant) return { error: 'Club no encontrado' };
  const sesion = await getSocioSesion(tenant.id);
  if (!sesion) redirect('/socios/ingresar');

  const clave = String(formData.get('clave') ?? '');
  const repetir = String(formData.get('repetir') ?? '');
  const problema = problemaClaveNueva(clave, sesion.socio.dni ?? '');
  if (problema) return { error: problema };
  if (clave !== repetir) return { error: 'Las dos contraseñas no coinciden.' };

  const admin = createAdminClient();
  const ahora = new Date().toISOString();
  const { error } = await admin
    .from('member_accesos')
    .update({
      password_hash: await hashClave(clave),
      password_at: ahora,
      clave_temp_hash: null,
      clave_temp_expira: null,
      updated_at: ahora,
    })
    .eq('member_id', sesion.memberId);
  if (error) return { error: error.message };

  // Esta sesión sigue; las demás (otros dispositivos) se cierran.
  await admin.from('member_sesiones').update({ debe_cambiar_clave: false }).eq('id', sesion.sesionId);
  await admin.from('member_sesiones').delete().eq('member_id', sesion.memberId).neq('id', sesion.sesionId);

  return redirect('/socios?clave=ok');
}

export async function salir() {
  await cerrarSesion();
  redirect('/socios/ingresar');
}
