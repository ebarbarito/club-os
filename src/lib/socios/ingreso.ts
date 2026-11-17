import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  BLOQUEO_MINUTOS,
  MAX_INTENTOS,
  hashClave,
  normalizarProvisoria,
  soloDigitos,
  verificarClave,
} from './clave';

// Ingreso del socio con DNI y contraseña (o la clave provisoria del mail).
// Lo usan el sitio de socios y los pedidos en la tablet de la sede.

export type SocioDni = { id: string; name: string | null; email: string | null; status: string };

export async function socioPorDni(tenantId: string, dni: string): Promise<SocioDni | null> {
  const { data } = await createAdminClient().rpc('socio_por_dni', { p_tenant: tenantId, p_dni: dni });
  const fila = Array.isArray(data) ? data[0] : null;
  return (fila as SocioDni | undefined) ?? null;
}

export type ResultadoIngreso =
  | { error: string }
  | { ok: true; socio: SocioDni; conProvisoria: boolean };

export async function verificarIngreso(tenantId: string, dniCrudo: string, clave: string): Promise<ResultadoIngreso> {
  const dni = soloDigitos(dniCrudo);
  if (dni.length < 6 || !clave) return { error: 'Completá tu DNI y tu contraseña.' };

  const incorrecto = { error: 'DNI o contraseña incorrectos.' };
  const bloqueado = { error: `Hubo demasiados intentos. Probá de nuevo en ${BLOQUEO_MINUTOS} minutos o pedí una clave nueva.` };
  const socio = await socioPorDni(tenantId, dni);
  if (!socio || socio.status !== 'valid') return incorrecto;

  const admin = createAdminClient();
  const { data: acceso } = await admin
    .from('member_accesos')
    .select('password_hash, clave_temp_hash, clave_temp_expira, intentos_fallidos, bloqueado_hasta')
    .eq('member_id', socio.id)
    .maybeSingle();
  if (!acceso) return incorrecto;

  const ahora = Date.now();
  if (acceso.bloqueado_hasta && new Date(acceso.bloqueado_hasta).getTime() > ahora) return bloqueado;

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
    return bloquear ? bloqueado : incorrecto;
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

  return { ok: true, socio, conProvisoria };
}

export async function guardarClaveDefinitiva(memberId: string, clave: string): Promise<{ error?: string }> {
  const ahora = new Date().toISOString();
  const { error } = await createAdminClient()
    .from('member_accesos')
    .update({
      password_hash: await hashClave(clave),
      password_at: ahora,
      clave_temp_hash: null,
      clave_temp_expira: null,
      updated_at: ahora,
    })
    .eq('member_id', memberId);
  return error ? { error: error.message } : {};
}

// Ticket firmado y de corta duración que identifica al socio durante un
// pedido en la tablet (no deja sesión ni cookie en el dispositivo compartido).
const TICKET_MINUTOS = 20;

function firma(datos: string) {
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'club-os').update(datos).digest('base64url');
}

export function emitirTicket(memberId: string, tenantId: string): string {
  const datos = `${memberId}.${tenantId}.${Date.now() + TICKET_MINUTOS * 60_000}`;
  return `${datos}.${firma(datos)}`;
}

export function leerTicket(ticket: string, tenantId: string): string | null {
  const partes = ticket.split('.');
  if (partes.length !== 4) return null;
  const [memberId, tenant, vence, sello] = partes;
  const esperado = Buffer.from(firma(`${memberId}.${tenant}.${vence}`));
  const recibido = Buffer.from(sello);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  if (tenant !== tenantId || Number(vence) < Date.now()) return null;
  return memberId;
}
