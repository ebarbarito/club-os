'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRequestBaseUrl, getRequestTenant } from '@/lib/tenant/request';
import { problemaClaveNueva, soloDigitos } from './clave';
import { cerrarSesion, crearSesion, getSocioSesion } from './sesion';
import { emitirClaveProvisoria, mailValido } from './acceso';
import { guardarClaveDefinitiva, socioPorDni, verificarIngreso } from './ingreso';

export type Estado = { error?: string; ok?: string } | null;

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
  const res = await verificarIngreso(tenant.id, String(formData.get('dni') ?? ''), String(formData.get('clave') ?? ''));
  if ('error' in res) return { error: res.error };
  await crearSesion(res.socio.id, tenant.id, res.conProvisoria);
  return redirect(res.conProvisoria ? '/socios/clave' : '/socios');
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

  const guardado = await guardarClaveDefinitiva(sesion.memberId, clave);
  if (guardado.error) return { error: guardado.error };
  const admin = createAdminClient();

  // Esta sesión sigue; las demás (otros dispositivos) se cierran.
  await admin.from('member_sesiones').update({ debe_cambiar_clave: false }).eq('id', sesion.sesionId);
  await admin.from('member_sesiones').delete().eq('member_id', sesion.memberId).neq('id', sesion.sesionId);

  return redirect('/socios?clave=ok');
}

export async function salir() {
  await cerrarSesion();
  redirect('/socios/ingresar');
}
